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
  await page.goto("/due-diligence/949?access=DDA_ACCESS&tab=duediligence-responses");
  await expect(page.getByText("You do not have access to this section.")).toBeVisible();
  await page.goto("/due-diligence/949?access=RESPONDENT_ACCESS&tab=duediligence-history");
  await expect(page.getByText("This application could not be opened with your current access.")).toBeVisible();
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
  await expect(page).toHaveURL(/\/due-diligence\/951\?access=DDA_ACCESS$/);
  await expect(page.locator("#due-diligence-overview")).toContainText(
    "Fixture due diligence draft",
  );
});
