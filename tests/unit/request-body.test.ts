import { expect, it } from "vitest";
import { readText } from "@/server/http/body";
/** A chunked request: no content-length, so only the byte count can stop it. */
const chunked = (parts: string[]) => {
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      if (pulled === parts.length) return c.close();
      c.enqueue(new TextEncoder().encode(parts[pulled++]));
    },
  });
  return {
    request: new Request("http://localhost/api/x", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit),
    pulled: () => pulled,
  };
};
it("reads a body within the cap, counting bytes not characters", async () => {
  expect(await readText(chunked(['{"a":', "1}"]).request, 7)).toBe('{"a":1}');
  // "é" is two bytes: 4 characters, 5 bytes.
  await expect(readText(chunked(["éabc"]).request, 4)).rejects.toMatchObject({
    status: 413,
  });
});
it("stops reading a chunked body as soon as it passes the cap", async () => {
  const big = chunked(Array.from({ length: 1000 }, () => "x".repeat(1024)));
  await expect(readText(big.request, 4096)).rejects.toMatchObject({
    status: 413,
  });
  expect(big.pulled()).toBeLessThan(10);
});
it("treats a missing body as empty", async () => {
  expect(
    await readText(
      new Request("http://localhost/api/x", { method: "POST" }),
      10,
    ),
  ).toBe("");
});
