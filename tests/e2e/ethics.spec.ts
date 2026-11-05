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
  await expect(page.locator("#ethics-new-save")).toBeEnabled();
  await page.locator("#ethics-new-save").click();
  await expect(page).toHaveURL(/\/ethics\/941\?access=EA_ACCESS$/);
  await expect(page.locator("#ethics-overview")).toContainText(
    "Fixture ethics draft",
  );
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
