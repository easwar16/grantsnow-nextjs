import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("button", { name: "Enter fixture workspace" }).click();
});

test("Ethics listing opens an application and its recycle bin", async ({
  page,
}) => {
  await page.goto("/ethics");
  await expect(page.locator("#ethics-applications")).toContainText("ETH_808");
  await page.locator("#ethics-recycle").click();
  await expect(page.locator("#ethics-deleted-applications")).toContainText(
    "ETH_807",
  );
  await page.locator("#ethics-recycle-dialog-close").click();
  await page.locator("#ethics-open-939").click();
  await expect(page.locator("#ethics-overview")).toContainText(
    "Research ethics application",
  );
  await expect(page.locator("#ethics-overview-people")).toContainText("Sam Taylor");
});

test("Ethics listing follows VBCS filters and date display", async ({
  page,
}) => {
  await page.goto("/ethics");
  const card = page.locator("#ethics-application-939");
  await expect(card).toContainText("Response Status : Draft");
  await expect(card).toContainText("20-Oct-2026");
  await expect(card).not.toContainText("2026-10-20T");
  await expect(page.locator("#ethics-type-filter")).toContainText("Individual");
  const title = await page.locator("#ethics-title").boundingBox();
  const risk = await page.locator("#ethics-risk").boundingBox();
  expect(title && risk && title.y < risk.y).toBe(true);
  await expect(page.locator("#ethics-filter-form")).not.toContainText(
    "Apply filters",
  );
  await expect(page.locator("#ethics-tab-ea_access")).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("Ethics clone reads server options and Delete requires the draft row", async ({ page }) => {
  await page.goto("/ethics");
  await page.locator("#ethics-clone-939").click();
  await expect(page.locator("#ethics-clone-dialog")).toContainText("Setup");
  await page.locator("#ethics-clone-submit").click();
  await expect(page.locator("#ethics-clone-dialog")).toHaveCount(0);
  await page.locator("#ethics-delete-939").click();
  await expect(page.locator("#ethics-delete-confirm")).toContainText("ETH_808");
  await page.locator("#ethics-delete-confirm-cancel").click();
  const forged = await page.request.delete("/api/ethics/actions/delete?id=9999&access=EA_ACCESS");
  expect(forged.status()).toBe(403);
});

test("Ethics Linked Records reads the shared object link dialog", async ({ page }) => {
  await page.goto("/ethics");
  await page.locator("#ethics-links-939").click();
  await expect(page.locator("#ethics-linked-dialog")).toContainText("Linked Objects");
  await expect(page.locator("#ethics-linked-dialog-body")).toBeVisible();
});

test("New Ethics draft uses its form metadata before saving", async ({
  page,
}) => {
  await page.goto("/ethics");
  await page.locator("#ethics-create").click();
  await expect(page).toHaveURL(/\/ethics\/new$/);
  await page.locator("#ethics-new-project-title").fill("Fixture ethics draft");
  await page.locator("#ethics-new-org-trigger").click();
  await page
    .getByRole("option", { name: "Faculty of Science", exact: true })
    .click();
  await page.locator("#ethics-new-form-type-trigger").click();
  await page
    .getByRole("option", { name: "Standard Ethics Form", exact: true })
    .click();
  await page.locator("#ethics-new-type").getByLabel("Individual").check();
  await page.locator("#ethics-new-participant-picker-field").fill("Sam Taylor");
  await page.getByRole("option", { name: /Sam Taylor/ }).click();
  await page.locator("#ethics-new-participant-picker-field").press("Escape");
  await page.locator("#ethics-new-supervisor-trigger").click();
  await page.getByRole("option", { name: "Alex Morgan", exact: true }).click();
  await expect(page.locator("#ethics-new-save")).toBeEnabled();
  await page.locator("#ethics-new-save").click();
  await page.locator("#ethics-creator-warning-confirm").click();
  await expect(page).toHaveURL(/\/ethics\/941\?access=EA_ACCESS$/);
  await expect(page.locator("#ethics-overview")).toContainText(
    "Fixture ethics draft",
  );
});

test("Ethics admin answer saves a participant response after draft creation", async ({ page }) => {
  await page.goto("/ethics/new");
  await page.locator("#ethics-new-project-title").fill("Admin answered Ethics draft");
  await page.locator("#ethics-new-org-trigger").click();
  await page.getByRole("option", { name: "Faculty of Science", exact: true }).click();
  await page.locator("#ethics-new-form-type-trigger").click();
  await page.getByRole("option", { name: "Standard Ethics Form", exact: true }).click();
  await page.locator("#ethics-new-type").getByLabel("Individual").check();
  await page.locator("#ethics-new-participant-picker-field").fill("Alex Morgan");
  await page.getByRole("option", { name: /Alex Morgan/ }).click();
  await page.locator("#ethics-new-participant-picker-field").press("Escape");
  await page.locator("#ethics-new-response").getByRole("switch", { name: "Application" }).click();
  await expect(page.locator("#ethics-new-response")).toContainText("Research purpose");
  await page.locator("#ethics-new-response").getByRole("textbox", { name: "Research purpose" }).fill("My research plan");
  await page.locator("#ethics-new-save").click();
  await expect(page).toHaveURL(/\/ethics\/941\?access=EA_ACCESS/);
});

test("Existing Ethics draft opens setup edit and preserves the record after save", async ({ page }) => {
  await page.goto("/ethics/939?access=EA_ACCESS");
  await page.locator("#ethics-edit-setup").click();
  await expect(page).toHaveURL(/\/ethics\/939\/edit\?access=EA_ACCESS/);
  await expect(page.locator("#ethics-new-project-title")).toHaveValue("Research ethics application");
  await expect(page.locator("#ethics-new-participant-picker-field")).toHaveValue(/Alex Morgan|Sam Taylor/);
  await page.locator("#ethics-new-project-title").fill("Revised ethics application");
  await page.locator("#ethics-new-save").click();
  await expect(page).toHaveURL(/\/ethics\/939\?access=EA_ACCESS/);
  const forged = await page.request.post("/api/ethics/actions/update", {
    data: { id: "9999", access: "EA_ACCESS", title: "Forged", org: "203", formType: "STANDARD", ethicsType: "INDIVIDUAL" },
  });
  expect(forged.status()).toBe(403);
});

test("In-progress Ethics setup allows guarded force edit", async ({ page }) => {
  await page.goto("/ethics/940?access=EA_ACCESS");
  await expect(page.locator("#ethics-edit-setup")).toBeVisible();
  await page.locator("#ethics-edit-setup").click();
  await expect(page.locator("#ethics-new-org-trigger")).toBeDisabled();
  await expect(page.locator("#ethics-new-form-type-trigger")).toBeDisabled();
  await expect(page.locator("#ethics-new-save")).toHaveCount(0);
  await page.locator("#ethics-new-submit").click();
  await expect(page).toHaveURL(/\/ethics\/940\?access=EA_ACCESS/);
});

test("Completed Ethics links and unlinks references through scoped routes", async ({ page }) => {
  await page.goto("/ethics/942?access=EA_ACCESS");
  await expect(page.locator("#ethics-link-reference")).toBeVisible();
  await page.locator("#ethics-link-reference").click();
  await page.locator("#ethics-link-type-trigger").click();
  await page.getByRole("option", { name: "Proposal", exact: true }).click();
  await page.locator("#ethics-link-objects-field").fill("Example proposal");
  await page.getByRole("option", { name: /Example proposal/ }).click();
  await page.locator("#ethics-link-objects-field").press("Escape");
  await page.locator("#ethics-link-submit").click();
  await expect(page.locator("#ethics-link-dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Unlink P_6718" }).click();
  await page.locator("#ethics-unlink-confirm-confirm").click();
  await expect(page.locator("#ethics-overview-references")).toBeVisible();
});

test("In-progress Ethics response exposes finalize and server-scoped print", async ({ page }) => {
  await page.goto("/ethics/940?access=EA_ACCESS&tab=ethics-responses&participant=1940");
  await expect(page.locator("#ethics-print")).toContainText("Print");
  await expect(page.locator("#ethics-record-finalize")).toBeVisible();
  const options = await page.request.get("/api/ethics/940/print?access=EA_ACCESS&participant=1940");
  expect(options.status()).toBe(200);
});

test("Ethics History loads on a direct URL refresh", async ({ page }) => {
  await page.goto("/ethics/939?access=EA_ACCESS&tab=ethics-history");
  await expect(page.locator("#ethics-history")).toContainText("Ethics Status History");
  await expect(page.locator("#ethics-history")).toContainText("Alex Morgan");
  await page.reload();
  await expect(page.locator("#ethics-history")).toContainText("Ethics Status History");
});

test("Ethics Documents use the stakeholder-scoped attachment host", async ({ page }) => {
  await page.goto("/ethics/939?access=EA_ACCESS&tab=ethics-attachments");
  await expect(page.locator("#ethics-attachments")).toBeVisible();
  await expect(page.locator("#ethics-attachments")).not.toContainText("Attachments unavailable");
});

test("Ethics participant selection survives a direct refresh and changes the document scope", async ({ page }) => {
  await page.goto("/ethics/939?access=EA_ACCESS&tab=ethics-attachments&participant=1941");
  await expect(page.locator("#ethics-participants")).toContainText("Sam Taylor");
  await expect(page.locator("#ethics-participants a[aria-current='page']")).toContainText("Sam Taylor");
  await expect(page.locator("#ethics-attachments")).toBeVisible();
  await page.reload();
  await expect(page.locator("#ethics-participants a[aria-current='page']")).toContainText("Sam Taylor");
  await page.locator("#ethics-record-tabs").getByRole("link", { name: /History/ }).click();
  await expect(page).toHaveURL(/participant=1941/);
  await expect(page.locator("#ethics-history")).toBeVisible();
});

test("Ethics rejects a forged participant on record and attachment reads", async ({ page }) => {
  await page.goto("/ethics/939?access=EA_ACCESS&tab=ethics-attachments&participant=9999");
  await expect(page.getByText("Ethics participant unavailable")).toBeVisible();
  const file = await page.request.get("/api/files?host=ethics&record=939&participant=9999");
  expect(file.status()).toBe(403);
  const approval = await page.request.post("/api/ethics/939/workflow/EA_ACCESS/9999", {
    data: { action: "approve" },
  });
  expect(approval.status()).toBe(403);
  const finalize = await page.request.post("/api/ethics/939/finalize", {
    data: { access: "EA_ACCESS", participant: "9999", page: "ethics-responses", finalize: true },
  });
  expect(finalize.status()).toBe(403);
  const link = await page.request.post("/api/ethics/actions/link", {
    data: { id: "939", access: "EA_ACCESS", type: "PROPOSAL", objects: ["6718"] },
  });
  expect(link.status()).toBe(403);
  const unlink = await page.request.delete("/api/ethics/actions/unlink?id=939&access=EA_ACCESS&relationId=1&page=ethics-general-overview");
  expect(unlink.status()).toBe(403);
  const autoSubmit = await page.request.post("/api/ethics/939/auto-submit", {
    data: { access: "EA_ACCESS", participant: "1941" },
  });
  expect(autoSubmit.status()).toBe(403);
  const forgedAttribute = await page.request.post("/api/ethics/actions/create", {
    data: { title: "Fixture", org: "1", formType: "EA", ethicsType: "INDIVIDUAL",
      attributes: { attribute_99: "forged" } },
  });
  expect([400, 403]).toContain(forgedAttribute.status());
});

test("Ethics Responses load the selected stakeholder's dynamic answers", async ({ page }) => {
  await page.goto("/ethics/939?access=EA_ACCESS&tab=ethics-responses&participant=1941");
  await expect(page.locator("#ethics-responses")).toContainText("Research purpose");
  await expect(page.locator("#ethics-responses").getByRole("textbox", { name: "Research purpose" })).toHaveValue("Participant two response");
  await expect(page.locator("#ethics-response-save")).toHaveCount(0);
  await page.goto("/ethics/939?access=RESPONDENT_ACCESS&tab=ethics-responses&participant=1940");
  await expect(page.locator("#ethics-responses").getByRole("textbox", { name: "Research purpose" })).toHaveValue("Participant one response");
  await expect(page.locator("#ethics-response-edit")).toBeVisible();
  await page.locator("#ethics-response-edit").click();
  await expect(page.locator("#ethics-response-save")).toBeVisible();
  await page.locator("#ethics-response-cancel").click();
  await expect(page.locator("#ethics-response-save")).toHaveCount(0);
});

test("Ethics historical response is read-only and survives direct refresh", async ({ page }) => {
  await page.goto("/ethics/939?access=RESPONDENT_ACCESS&tab=ethics-responses&participant=1940&version=1");
  await expect(page.locator("#ethics-response-version")).toHaveValue("1");
  await expect(page.locator("#ethics-responses").getByRole("textbox", { name: "Research purpose" })).toHaveValue("Historical participant 1940 response");
  await expect(page.locator("#ethics-response-save")).toHaveCount(0);
  await expect(page.locator("#ethics-response-edit")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#ethics-response-version")).toHaveValue("1");
  const forged = await page.request.post("/api/dynamic-form", {
    data: { target: { objectType: "ETHICS", slot: "ETHICS", parentId: "939", objectId: "1940", version: 1 }, answers: [] },
  });
  expect(forged.status()).toBe(403);
});

test("Ethics Approvals load on a selected participant deep link", async ({ page }) => {
  await page.goto("/ethics/939?access=EA_ACCESS&tab=ethics-approvals&participant=1941");
  await expect(page.locator("#ethics-approvals")).toBeVisible();
  await expect(page.locator("#ethics-workflow")).toBeVisible();
  await page.reload();
  await expect(page.locator("#ethics-workflow")).toBeVisible();
});
