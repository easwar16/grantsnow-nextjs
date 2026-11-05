import { expect, test, type Page } from "@playwright/test";

async function choose(page: Page, id: string, label: string) {
  await page.locator(`#${id}-trigger`).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

async function choosePi(page: Page, name: string) {
  await page.locator("#proposal-new-change-pi").click();
  await expect(page.locator("#proposal-new-pi-dialog")).toBeVisible();
  await page.locator("#proposal-new-pi-list").getByText(name).click();
  await page.locator("#proposal-new-pi-okay").click();
  await expect(page.locator("#proposal-new-pi-full-name")).toContainText(name);
}

test("hamburger reveals the navigation drawer", async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("button", { name: "Enter fixture workspace" }).click();
  await page.locator("#shell-menu-button").click();
  await expect(page.locator("#navigation-drawer")).toBeVisible();
  await expect(page.locator("#navigation-drawer")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("Proposal listing creates a Grant App from the VBCS entry action", async ({
  page,
}) => {
  await page.goto("/home");
  await page.getByRole("button", { name: "Enter fixture workspace" }).click();
  await page.goto("/proposals");
  await expect(page.locator("#proposals-create")).toBeEnabled();
  await page.locator("#proposals-create").click();
  await expect(page).toHaveURL(/\/proposals\/new\/PROPOSAL$/);
  await expect(
    page.getByRole("heading", { name: "Create New Proposal" }),
  ).toBeVisible();
  await choosePi(page, "Alex Morgan");
  await expect(
    page.getByRole("heading", { name: "Research partner details" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sub-proposal details" }),
  ).toBeVisible();
  await page.locator("#proposal-new-create").click();
  await expect(page.locator("#proposal-new-add-sponsor-trigger")).toBeFocused();
  await expect(page.locator("#proposal-new-sponsor-editor")).toContainText(
    "Primary sponsor must be selected",
  );
  await expect(page.locator("#toast-stack")).not.toContainText(
    "Invalid Proposal details.",
  );
  await choose(page, "proposal-new-add-sponsor", "Research Council");
  await page.locator("#proposal-new-create").click();
  await expect(
    page.locator("#proposal-new-edit-full-project-title"),
  ).toBeFocused();
  await expect(
    page.locator("#proposal-new-summary-full-project-title"),
  ).toContainText("Full Project Title is required");
  await page
    .locator("#proposal-new-edit-full-project-title")
    .fill("Fixture created Grant App");
  await choose(page, "proposal-new-edit-activity-type", "Cash");
  await choose(page, "proposal-new-edit-proposal-stage", "Single");
  await choose(page, "proposal-new-edit-proposal-type", "Standard Proposal");
  await choose(page, "proposal-new-edit-proposal-category", "Research");
  await page.locator("#proposal-new-edit-start-date").fill("02-Oct-2026");
  await page.locator("#proposal-new-edit-start-date").blur();
  await page.locator("#proposal-new-edit-end-date").fill("01-Jan-2028");
  await page.locator("#proposal-new-edit-end-date").blur();
  await choose(page, "proposal-new-edit-cost-model", "Example cost model");
  await choose(page, "proposal-new-edit-assigned-to", "Alex Morgan");
  await page
    .locator("#proposal-new-edit-opportunity-title")
    .fill("Fixture opportunity");
  await page
    .locator("#proposal-new-edit-opportunity-url")
    .fill("https://example.org/opportunity");
  await expect(page.locator("#proposal-new-sponsor-editor")).toContainText(
    "Research Council",
  );
  await page
    .getByRole("textbox", { name: "Project title", exact: true })
    .fill("Fixture project");
  await page.locator("#proposals-summary-field-3").fill("1200");
  await choose(page, "proposal-new-attributes-attribute-1", "P1");
  await page.locator("#proposal-new-attributes-attribute-3").fill("AB123");
  await expect(page.locator("#proposal-new-create-bottom")).toBeVisible();
  await page.locator("#proposal-new-create-bottom").click();
  await expect(page).toHaveURL(/\/proposals\/PROPOSAL\/\d+$/);
  await expect(page.locator("#toast-stack")).toContainText(
    "Proposal created successfully",
  );
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
  await choosePi(page, "Alex Morgan");
  await page
    .locator("#proposal-new-edit-full-project-title")
    .fill("Fixture created outline");
  await choose(page, "proposal-new-edit-activity-type", "Cash");
  await choose(page, "proposal-new-edit-proposal-stage", "Single");
  await choose(page, "proposal-new-edit-proposal-type", "Standard Proposal");
  await choose(page, "proposal-new-edit-proposal-category", "Research");
  await page.locator("#proposal-new-edit-start-date").fill("02-Oct-2026");
  await page.locator("#proposal-new-edit-start-date").blur();
  await page.locator("#proposal-new-edit-end-date").fill("01-Jan-2028");
  await page.locator("#proposal-new-edit-end-date").blur();
  await choose(page, "proposal-new-edit-cost-model", "Example cost model");
  await choose(page, "proposal-new-edit-assigned-to", "Alex Morgan");
  await page
    .locator("#proposal-new-edit-opportunity-title")
    .fill("Fixture outline opportunity");
  await page
    .locator("#proposal-new-edit-opportunity-url")
    .fill("https://example.org/outline");
  await choose(page, "proposal-new-add-sponsor", "Research Council");
  await page
    .getByRole("textbox", { name: "Project title", exact: true })
    .fill("Fixture outline project");
  await page.locator("#proposals-summary-field-3").fill("1200");
  const createPath = "**/api/proposals/actions/create";
  const rejectCreate = async (route: import("@playwright/test").Route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "BUSINESS",
          message: "TEST-42 : Oracle said no",
          action: "Choose a different title.",
        },
      }),
    });
  };
  await page.route(createPath, rejectCreate);
  await page.locator("#proposal-new-create").click();
  await expect(page.locator("#toast-stack")).toContainText(
    "TEST-42 : Oracle said no",
  );
  await expect(page.locator("#toast-stack")).toContainText(
    "Choose a different title.",
  );
  await page.unroute(createPath, rejectCreate);
  await page.locator("#proposal-new-create").click();
  await expect(page).toHaveURL(/\/proposals\/OUTLINE_PROPOSAL\/\d+$/);
  await expect(page.locator("#toast-stack")).toContainText(
    "OP created successfully",
  );
  await expect(page.getByText("Fixture created outline").first()).toBeVisible();
});

test("Outline entry offers approved AOIs for conversion", async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("button", { name: "Enter fixture workspace" }).click();
  await page.goto("/proposals");
  await page.locator("#proposals-create-outline").click();
  await expect(page.locator("#proposals-outline-from-aoi")).toBeVisible();
  await page.locator("#proposals-outline-from-aoi").click();
  await expect(page.locator("#proposals-approved-aoi-list")).toBeVisible();
  await expect(page.locator("#proposals-approved-aoi-1002")).toBeVisible();
  await expect(page.locator("#proposals-approved-aoi-1000")).toHaveCount(0);
  await page.locator("#proposals-approved-aoi-create-1002").click();
  await expect(page).toHaveURL(
    /\/proposals\/new\/OUTLINE_PROPOSAL\?sourceRequestId=1002/,
  );
  await expect(
    page.locator("#proposal-new-edit-full-project-title"),
  ).toBeVisible();
});
