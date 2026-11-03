import { expect, test, type Page } from "@playwright/test";

async function choose(page: Page, id: string, label: string) {
  await page.locator(`#${id}-trigger`).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

test("Proposal listing creates a Grant App from the VBCS entry action", async ({
  page,
}) => {
  await page.goto("/home");
  await page.getByRole("button", { name: "Enter fixture workspace" }).click();
  await page.goto("/proposals");
  await expect(page.locator("#proposals-create")).toBeEnabled();
  await page.locator("#proposals-create").click();
  await expect(page).toHaveURL(/\/proposals\/new\/PROPOSAL$/);
  await choose(page, "proposal-new-pi-select", "Alex Morgan");
  await page.locator("#proposal-new-title").fill("Fixture created Grant App");
  await choose(page, "proposal-new-activity", "Cash");
  await choose(page, "proposal-new-stage", "Single");
  await choose(page, "proposal-new-type", "Standard Proposal");
  await page.locator("#proposal-new-start").fill("02-Oct-2026");
  await page.locator("#proposal-new-end").fill("01-Jan-2028");
  await choose(page, "proposal-new-cost", "Example cost model");
  await choose(page, "proposal-new-sponsor", "Research Council");
  await page.locator("#proposal-new-save").click();
  await expect(page).toHaveURL(/\/proposals\/PROPOSAL\/\d+$/);
  await expect(
    page.getByText("Fixture created Grant App").first(),
  ).toBeVisible();
});

test("Outline entry opens the VBCS options and the fresh outline form", async ({
  page,
}) => {
  await page.goto("/home");
  await page.getByRole("button", { name: "Enter fixture workspace" }).click();
  await page.goto("/proposals");
  await expect(page.locator("#proposals-create-outline")).toBeEnabled();
  await page.locator("#proposals-create-outline").click();
  await expect(page.locator("#proposals-outline-options")).toBeVisible();
  await page.locator("#proposals-outline-new").click();
  await expect(page).toHaveURL(/\/proposals\/new\/OUTLINE_PROPOSAL$/);
  await choose(page, "proposal-new-pi-select", "Alex Morgan");
  await page.locator("#proposal-new-title").fill("Fixture created outline");
  await choose(page, "proposal-new-activity", "Cash");
  await choose(page, "proposal-new-stage", "Single");
  await choose(page, "proposal-new-type", "Standard Proposal");
  await page.locator("#proposal-new-start").fill("02-Oct-2026");
  await page.locator("#proposal-new-end").fill("01-Jan-2028");
  await choose(page, "proposal-new-cost", "Example cost model");
  await choose(page, "proposal-new-sponsor", "Research Council");
  await page.locator("#proposal-new-save").click();
  await expect(page).toHaveURL(/\/proposals\/OUTLINE_PROPOSAL\/\d+$/);
  await expect(page.getByText("Fixture created outline").first()).toBeVisible();
});
