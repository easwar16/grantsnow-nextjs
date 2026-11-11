import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("button", { name: "Enter fixture workspace" }).click();
});

test("Due Diligence listing opens a scoped record and recycle bin", async ({
  page,
}) => {
  await page.goto("/due-diligence");
  await expect(page.locator("#due-diligence-applications")).toContainText(
    "DD_808",
  );
  await expect(page.locator("#due-diligence-applications")).not.toContainText(
    "ETH_808",
  );
  await page.locator("#due-diligence-links-949").click();
  await expect(page.locator("#due-diligence-linked-dialog")).toContainText("No Linked Data Found");
  await page.locator("#due-diligence-linked-dialog-close").click();
  await page.locator("#due-diligence-recycle").click();
  await expect(
    page.locator("#due-diligence-deleted-applications"),
  ).toContainText("DD_807");
  await page.locator("#due-diligence-recycle-dialog-close").click();
  await page.locator("#due-diligence-open-949").click();
  await expect(page.locator("#due-diligence-overview")).toContainText(
    "Supplier due diligence application",
  );
});

test("record child tabs enforce the current record grant on direct entry and refresh", async ({
  page,
}) => {
  await page.goto("/due-diligence/949?access=DDA_ACCESS&tab=duediligence-history");
  await expect(page.locator("#due-diligence-history")).toBeVisible();
  await page.reload();
  await expect(page.locator("#due-diligence-history")).toBeVisible();
  await page.goto("/due-diligence/949?access=DDA_ACCESS&tab=duediligence-attachments");
  await expect(page.locator("#due-diligence-attachments")).toBeVisible();
  await expect(page.locator("#due-diligence-attachments")).not.toContainText("Attachments unavailable");
  await page.reload();
  await expect(page.locator("#due-diligence-attachments")).toBeVisible();
  await page.goto("/due-diligence/949?access=DDA_ACCESS&tab=duediligence-responses");
  await expect(page.locator("#due-diligence-responses")).toBeVisible();
  await expect(page.locator("#due-diligence-response-save")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#due-diligence-responses")).toBeVisible();
  await page.goto("/due-diligence/949?access=DDA_ACCESS&tab=duediligence-responses&respondent=999");
  await expect(page.getByText("You do not have access to this response.")).toBeVisible();
  await page.goto("/due-diligence/949?access=DDA_ACCESS&tab=duediligence-approvals");
  await expect(page.locator("#due-diligence-approvals")).toBeVisible();
  await page.reload();
  await expect(page.locator("#due-diligence-approvals")).toBeVisible();
  await page.goto("/due-diligence/949?access=DDA_ACCESS&tab=ungranted");
  await expect(page.getByText("You do not have access to this section.")).toBeVisible();
  await page.goto("/due-diligence/949?access=RESPONDENT_ACCESS&tab=duediligence-responses");
  await expect(page.locator("#due-diligence-response-edit")).toBeVisible();
  await page.locator("#due-diligence-response-edit").click();
  await expect(page.locator("#due-diligence-response-cancel")).toBeVisible();
  await page.getByRole("switch", { name: "Application" }).click();
  await page.getByRole("textbox", { name: "Assessment note" }).fill("Fixture assessment");
  page.once("dialog", (dialog) => void dialog.dismiss());
  await page.locator('#due-diligence-record-tabs a[href*="duediligence-history"]').click({ noWaitAfter: true, timeout: 10000 });
  await expect(page.locator("#due-diligence-responses")).toBeVisible();
  await page.locator("#due-diligence-response-save").click();
  await expect(page.getByText("Response saved.")).toBeVisible();
  await expect(page.locator("#due-diligence-response-edit")).toBeVisible();
  await page.goto("/due-diligence/949?access=APPROVER_ACCESS&tab=duediligence-history");
  await expect(page.getByText("This application could not be opened with your current access.")).toBeVisible();
});

test("completed response versions are read-only and scoped to known versions", async ({ page }) => {
  await page.goto("/due-diligence/950?access=DDA_ACCESS&tab=duediligence-responses&version=1");
  await expect(page.locator("#due-diligence-response-version")).toHaveValue("1");
  await expect(page.getByRole("textbox", { name: "Assessment note" })).toHaveValue("Historical due diligence version 1");
  await expect(page.getByRole("textbox", { name: "Assessment note" })).toBeDisabled();
  await expect(page.locator("#due-diligence-response-edit")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Assessment note" })).toHaveValue("Historical due diligence version 1");
  await page.goto("/due-diligence/950?access=DDA_ACCESS&tab=duediligence-responses&version=99");
  await expect(page.getByText("Response version unavailable")).toBeVisible();
});

test("completed record links a validated reference and rejects forged choices", async ({ page }) => {
  await page.goto("/due-diligence/950?access=DDA_ACCESS&tab=duediligence-responses");
  await expect(page.locator("#due-diligence-link-reference")).toBeVisible();
  const types = await page.request.get("/api/due-diligence/actions/reference-types?id=950&access=DDA_ACCESS");
  expect(types.status()).toBe(200);
  const link = (id: string, objectId: string) => page.evaluate(async ({ id, objectId }) => {
    const response = await fetch("/api/due-diligence/actions/reference-link", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, access: "DDA_ACCESS", type: "PROPOSAL", objects: [objectId] }),
    });
    return response.status;
  }, { id, objectId });
  expect(await link("950", "999")).toBe(400);
  expect(await link("950", "6718")).toBe(200);
  expect(await link("949", "6718")).toBe(403);
});

test("submitted record gates print choices and page finalization by stakeholder", async ({ page }) => {
  await page.goto("/due-diligence/950?access=DDA_ACCESS&tab=duediligence-responses");
  await expect(page.locator("#due-diligence-print")).toBeVisible();
  await page.locator("#due-diligence-print button").first().click();
  await expect(page.getByRole("menuitem", { name: "Due Diligence Response" })).toBeVisible();
  const reportDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Due Diligence Response" }).click();
  expect((await reportDownload).suggestedFilename()).toBe("report.pdf");
  await expect(page.locator("#due-diligence-record-finalize")).toBeVisible();
  const statuses = await page.evaluate(async () => {
    const send = async (path: string, body: unknown) => (await fetch(path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })).status;
    return {
      print: await send("/api/due-diligence/950/print", { access: "DDA_ACCESS", respondent: "1951", code: "forged" }),
      finalize: await send("/api/due-diligence/950/finalize", {
        access: "DDA_ACCESS", respondent: "999", page: "duediligence-responses", finalize: true,
      }),
    };
  });
  expect(statuses).toEqual({ print: 400, finalize: 403 });
  await page.locator("#due-diligence-record-finalize").click();
  await expect(page.locator("#due-diligence-record-finalize")).toBeChecked();
  await page.reload();
  await expect(page.locator("#due-diligence-record-finalize")).toBeChecked();
  await expect(page.locator("#due-diligence-auto-submit")).toBeVisible();
  const submitted = page.waitForResponse((response) => response.url().includes("/api/due-diligence/actions/auto-submit"));
  await page.locator("#due-diligence-auto-submit").click();
  expect((await submitted).status()).toBe(200);
  await expect(page.locator("#due-diligence-auto-submit")).toBeEnabled();
});

test("Draft clone uses configured object selections and delete asks for confirmation", async ({
  page,
}) => {
  await page.goto("/due-diligence");
  await page.locator("#due-diligence-clone-949").click();
  await expect(page.locator("#due-diligence-clone-SETUP")).toBeChecked();
  await page.locator("#due-diligence-clone-RESPONSES").check();
  await page.locator("#due-diligence-clone-submit").click();
  await expect(page.locator("#due-diligence-clone-dialog")).toHaveCount(0);
  await page.locator("#due-diligence-delete-949").click();
  await expect(page.getByText("Delete Draft DD_808?")).toBeVisible();
  await page.locator("#due-diligence-delete-confirm-cancel").click();
  await expect(page.locator("#due-diligence-open-949")).toBeVisible();
});

test("New Due Diligence draft uses its own form metadata and save payload", async ({
  page,
}) => {
  await page.goto("/due-diligence");
  await page.locator("#due-diligence-create").click();
  await expect(page).toHaveURL(/\/due-diligence\/new$/);
  await page
    .locator("#due-diligence-new-project-title")
    .fill("Fixture due diligence draft");
  await page.locator("#due-diligence-new-org-trigger").click();
  await page
    .getByRole("option", { name: "Faculty of Science", exact: true })
    .click();
  await page.locator("#due-diligence-new-form-type-trigger").click();
  await page
    .getByRole("option", { name: "Standard Due Diligence Form", exact: true })
    .click();
  await page.locator("#due-diligence-new-type").getByLabel("Standard").check();
  await page
    .locator("#due-diligence-new-participant-picker-field")
    .fill("Sam Taylor");
  await page.getByRole("option", { name: /Sam Taylor/ }).click();
  await page
    .locator("#due-diligence-new-participant-picker-field")
    .press("Escape");
  await page.locator("#due-diligence-new-supervisor-trigger").click();
  await page.getByRole("option", { name: "Alex Morgan", exact: true }).click();
  await expect(page.locator("#due-diligence-new-save")).toBeEnabled();
  await page.locator("#due-diligence-new-save").click();
  await expect(page.locator("#due-diligence-creator-warning")).toBeVisible();
  await page.locator("#due-diligence-creator-warning-confirm").click();
  await expect(page).toHaveURL(/\/due-diligence\/951\?access=DDA_ACCESS$/);
  await expect(page.locator("#due-diligence-overview")).toContainText(
    "Fixture due diligence draft",
  );
});

test("response and approval APIs reject unscoped stakeholder reads and writes", async ({ page }) => {
  const newForm = await page.request.get(
    "/api/dynamic-form?objectType=DUE_DILIGENCE&slot=DUE_DILIGENCE&formType=STANDARD",
  );
  expect(newForm.status()).toBe(200);
  expect((await newForm.json()).forms[0].formId).toBe(84);
  const badNewForm = await page.request.get(
    "/api/dynamic-form?objectType=DUE_DILIGENCE&slot=DUE_DILIGENCE&formType=UNKNOWN",
  );
  expect(badNewForm.status()).toBe(400);
  const form = new URLSearchParams({
    objectType: "DUE_DILIGENCE",
    slot: "DUE_DILIGENCE",
    parentId: "949",
    objectId: "999",
  });
  const deniedForm = await page.request.get(`/api/dynamic-form?${form}`);
  expect(deniedForm.status()).toBe(403);
  const deniedSave = await page.evaluate(async () => {
    const response = await fetch("/api/dynamic-form", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: { objectType: "DUE_DILIGENCE", slot: "DUE_DILIGENCE", parentId: "949", objectId: "999" },
        answers: [],
      }),
    });
    return response.status;
  });
  expect(deniedSave).toBe(403);
  const deniedWorkflow = await page.request.get("/api/due-diligence/949/workflow/DDA_ACCESS/999");
  expect(deniedWorkflow.status()).toBe(403);
  const comments = await page.request.get(
    "/api/objects/comments?type=DUE_DILIGENCE&id=949&page=duediligence-responses&sec=1950",
  );
  expect(comments.status()).toBe(200);
  const wrongComments = await page.request.get(
    "/api/objects/comments?type=DUE_DILIGENCE&id=949&page=duediligence-responses&sec=999",
  );
  expect(wrongComments.status()).toBe(403);
});

test("submission validates participants and supervisor before writing", async ({ page }) => {
  await page.goto("/due-diligence/new");
  await page.locator("#due-diligence-new-project-title").fill("Submission validation");
  await page.locator("#due-diligence-new-org-trigger").click();
  await page.getByRole("option", { name: "Faculty of Science", exact: true }).click();
  await page.locator("#due-diligence-new-form-type-trigger").click();
  await page.getByRole("option", { name: "Standard Due Diligence Form", exact: true }).click();
  await page.locator("#due-diligence-new-type").getByLabel("Standard").check();
  await page.locator("#due-diligence-new-submit").click();
  await expect(page.locator("#due-diligence-new-error")).toContainText("at least one participant");
  await expect(page).toHaveURL(/\/due-diligence\/new$/);
});

test("Draft Setup opens from the record and saves under its scoped id", async ({ page }) => {
  await page.goto("/due-diligence/949?access=DDA_ACCESS");
  await page.locator("#due-diligence-edit-setup").click();
  await expect(page).toHaveURL(/\/due-diligence\/949\/edit\?access=DDA_ACCESS/);
  await expect(page.locator("#due-diligence-new-project-title")).toHaveValue(
    "Supplier due diligence application",
  );
  await page.locator("#due-diligence-new-project-title").fill("Updated supplier review");
  await expect(page.locator("#due-diligence-new-save")).toBeEnabled();
  await page.locator("#due-diligence-new-save").click();
  await expect(page).toHaveURL(/\/due-diligence\/949\?access=DDA_ACCESS/);
});

test("Proposal Due Diligence Link keeps object access and refreshes the tab", async ({ page }) => {
  await page.goto("/proposals/OUTLINE_PROPOSAL/1000/due-diligence");
  await expect(page.locator("#parent-due-diligence-create")).toBeVisible();
  await page.locator("#parent-due-diligence-link").click();
  await expect(page.locator("#parent-due-diligence-candidates")).toContainText("DD_808");
  await page.locator("#parent-due-diligence-candidates").getByRole("button", { name: "Link" }).first().click();
  await expect(page.getByText("Due Diligence record linked.")).toBeVisible();
});

test("Award Due Diligence tab exposes its own Create and Link grants", async ({ page }) => {
  await page.goto("/awards/5000/due-diligence");
  await expect(page.locator("#award-record-due-diligence")).toBeVisible();
  await expect(page.locator("#parent-due-diligence-create")).toHaveAttribute(
    "href", /\/due-diligence\/new\?parentType=AWARD&parentId=5000/,
  );
  await page.locator("#parent-due-diligence-link").click();
  await expect(page.locator("#parent-due-diligence-candidates")).toContainText("DD_808");
  await page.locator("#parent-due-diligence-candidates").getByRole("button", { name: "Link" }).first().click();
  await expect(page.getByText("Due Diligence record linked.")).toBeVisible();
});
