import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  exclusiveLocation,
  oicDelete,
  oicDownload,
  oicUpload,
  storageSafeName,
} from "@/server/oic/connection";
const fetchMock = vi.fn();
beforeEach(() => {
  for (const [key, value] of Object.entries({
    NODE_ENV: "development",
    APP_ENV: "development",
    FIXTURE_MODE: "false",
    OIC_BASE_URL: "https://oic.example",
    GN_OIC_USER: "user",
    GN_OIC_PASSWORD: "secret",
    WRITES_ENABLED: "true",
  }))
    vi.stubEnv(key, value);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response("", { status: 200 }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("uploads raw bytes as octet-stream with Basic auth and the file name, never a session token", async () => {
  await oicUpload(
    "DEV/1/OPPORTUNITIES-EOI/AOI_1/SLOT/a.pdf",
    new Uint8Array([1, 2]),
  );
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe(
    "https://oic.example/ic/api/integration/v1/flows/rest/UPLOAD_OBJECT/1.0/objectstorage",
  );
  expect(init).toMatchObject({
    method: "PUT",
    redirect: "error",
    headers: {
      Authorization: `Basic ${Buffer.from("user:secret").toString("base64")}`,
      file_name: "DEV/1/OPPORTUNITIES-EOI/AOI_1/SLOT/a.pdf",
      "Content-Type": "application/octet-stream",
    },
  });
  expect(JSON.stringify(init.headers)).not.toMatch(/token/i);
});
it("sends nothing while writes are off, but downloads still work", async () => {
  vi.stubEnv("WRITES_ENABLED", "false");
  await expect(oicUpload("a/b.pdf", new Uint8Array())).rejects.toMatchObject({
    code: "WRITES_DISABLED",
  });
  await expect(oicDelete("a/b.pdf")).rejects.toMatchObject({
    code: "WRITES_DISABLED",
  });
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockImplementation(
    async () =>
      new Response(new Uint8Array([7]), {
        headers: { "content-type": "application/pdf" },
      }),
  );
  await expect(oicDownload("a/b.pdf")).resolves.toMatchObject({
    contentType: "application/pdf",
  });
});
it("rejects path traversal and empty segments before calling OIC", async () => {
  for (const bad of ["../x", "/abs", "a//b", "a/../b", ""])
    await expect(oicDownload(bad)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  expect(fetchMock).not.toHaveBeenCalled();
});
it("treats an HTML reply as an error page, not the file", async () => {
  fetchMock.mockImplementation(
    async () =>
      new Response("<html>login</html>", {
        headers: { "content-type": "text/html" },
      }),
  );
  await expect(oicDownload("a/b.pdf")).rejects.toMatchObject({
    code: "UPSTREAM",
  });
});
it("reports the OIC status in the error and stays unconnected without credentials", async () => {
  fetchMock.mockImplementation(async () => new Response("", { status: 415 }));
  await expect(oicUpload("a/b.pdf", new Uint8Array())).rejects.toMatchObject({
    message: "The file couldn't be stored (file storage answered 415).",
  });
  vi.stubEnv("GN_OIC_PASSWORD", "");
  await expect(oicDownload("a/b.pdf")).rejects.toMatchObject({
    message: "File storage is not connected in this environment.",
  });
});
it("percent-encodes only non-Latin-1 characters in the header name", () => {
  expect(storageSafeName("a/Résumé.pdf")).toBe("a/Résumé.pdf");
  expect(storageSafeName("a/报告.pdf")).toBe(
    `a/${encodeURIComponent("报")}${encodeURIComponent("告")}.pdf`,
  );
});
it("refuses a second upload to the same object while the first runs, and frees it after", async () => {
  let finish = () => {};
  const first = exclusiveLocation(
    "I/1/A/1/f.pdf",
    () => new Promise<void>((resolve) => (finish = resolve)),
  );
  await expect(
    exclusiveLocation("I/1/A/1/f.pdf", async () => "second"),
  ).rejects.toMatchObject({ status: 409 });
  expect(await exclusiveLocation("I/1/A/1/g.pdf", async () => "other")).toBe(
    "other",
  );
  finish();
  await first;
  await expect(
    exclusiveLocation("I/1/A/1/f.pdf", async () => {
      throw new Error("upload failed");
    }),
  ).rejects.toThrow("upload failed");
  expect(await exclusiveLocation("I/1/A/1/f.pdf", async () => "again")).toBe(
    "again",
  );
});
