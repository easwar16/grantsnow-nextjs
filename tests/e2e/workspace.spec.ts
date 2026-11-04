import { test, expect, type Locator } from "@playwright/test";
import { doneKey, guides } from "../../src/features/guides/registry";

// Guides auto-start on their page and their overlay takes the clicks; journeys run with every guide finished.
const finished = guides.map(doneKey);
test.beforeEach(async ({ page }) => {
  await page.addInitScript((keys) => {
    for (const k of keys) localStorage.setItem(k, "Y");
  }, finished);
});
/** Scroll a list to its end until the next-page request shows (a scroll before hydration goes unhandled). */
async function nextPageOnScroll(list: Locator, signal: Locator) {
  await expect(async () => {
    await list.evaluate((e) => {
      e.scrollTop = 0;
      e.scrollTop = e.scrollHeight;
    });
    await expect(signal).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20000 });
}
async function navigateProposals(page: import("@playwright/test").Page) {
  await page
    .getByRole("button", { name: "Application Navigation Drawer" })
    .click();
  await page.getByRole("link", { name: "Proposals", exact: true }).click();
}
async function login(page: import("@playwright/test").Page) {
  await page.goto("/home");
  await expect(
    page.getByRole("button", { name: "Enter fixture workspace" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enter fixture workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Example Research University" }),
  ).toBeVisible();
}
test("Draft Proposal exposes Edit, editable summary fields, and Cancel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 2048, height: 1190 });
  await login(page);
  await page.goto("/proposals/OUTLINE_PROPOSAL/1000");
  await expect(
    page.locator("#proposals-summary-tab [aria-label='Finalized']"),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit Proposal" })).toBeVisible();
  await page.getByRole("link", { name: "Edit Proposal" }).click();
  await expect(page).toHaveURL(/mode=edit/);
  await expect(page.getByRole("link", { name: "Edit Proposal" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  await expect(page.getByRole("button", { name: "AI Summary" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Comments" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Audit Trail" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Full Project Title" }),
  ).toHaveValue(/Climate resilient communities/);
  await expect(
    page.getByRole("textbox", { name: "Project description" }),
  ).toHaveValue(/Synthetic project description/);
  await expect(
    page.getByRole("combobox", { name: "Activity type" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Funder Type" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Add Funder" }),
  ).toBeVisible();
  await expect(page.locator("#proposal-1000-pi-editor")).toHaveCSS(
    "grid-template-columns",
    /px .*px .*px .*px/,
  );
  await page.screenshot({ path: "test-results/proposal-edit-expanded.png" });
  await page.getByRole("button", { name: "Change PI" }).click();
  const piDialog = page.getByRole("dialog", {
    name: "Search for Principal Investigator",
  });
  await expect(piDialog).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Search for Principal Investigator" }),
  ).toBeHidden();
  await expect(piDialog).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "test-results/proposal-pi-dialog.png" });
  await page.getByRole("searchbox", { name: "Search" }).fill("Sam");
  await page.locator("#proposal-1000-pi-candidate-102").click();
  await page.getByRole("button", { name: "Okay" }).click();
  await expect(page.locator("#proposal-1000-pi-full-name")).toContainText(
    "Sam Taylor",
  );
  const deleteSponsor = page.getByRole("button", {
    name: "Delete Research Council",
  });
  await expect(deleteSponsor).toBeEnabled();
  await deleteSponsor.click();
  await expect(page.getByRole("dialog", { name: "Warning" })).toContainText(
    "remove this record permanently",
  );
  await page.locator("#proposal-1000-delete-sponsor-dialog-cancel").click();
  await expect(deleteSponsor).toBeVisible();
  await deleteSponsor.click();
  await page
    .getByRole("dialog", { name: "Warning" })
    .getByRole("button", {
      name: "Yes",
    })
    .click();
  await expect(deleteSponsor).toHaveCount(0);
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/proposals\/OUTLINE_PROPOSAL\/1000$/);
  await expect(
    page.getByRole("textbox", { name: "Full Project Title" }),
  ).toHaveCount(0);
});
test("Draft Proposal Save completes in the fixture workspace", async ({
  page,
}) => {
  await login(page);
  let dynamicSaves = 0;
  await page.route("**/api/dynamic-form", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    dynamicSaves += 1;
    await route.fulfill({ status: 503, body: "Dynamic form unavailable" });
  });
  await page.goto("/proposals/OUTLINE_PROPOSAL/1000?mode=edit");
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await page
    .getByRole("textbox", { name: "Full Project Title" })
    .fill("Climate resilient communities — fixture save");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/proposals\/OUTLINE_PROPOSAL\/1000$/);
  expect(dynamicSaves).toBe(0);
  await expect(page.locator("#proposal-1000-edit-error")).toHaveCount(0);
});
test("Proposal Summary partner editors follow the VBCS Yes/No flow", async ({
  page,
}) => {
  await login(page);
  await page.goto("/proposals/PROPOSAL/1004?mode=edit");
  const partners = page.locator("#proposal-1004-research-partners");
  const subproposals = page.locator("#proposal-1004-subproposals");
  await expect(partners).toBeVisible();
  await expect(subproposals).toBeVisible();
  await partners.getByRole("radio", { name: "Yes" }).check();
  await expect(
    partners.getByRole("combobox", { name: "Add Research partners" }),
  ).toBeVisible();
  await subproposals.getByRole("radio", { name: "Yes" }).check();
  await expect(
    subproposals.getByRole("combobox", { name: "Sub-proposal type" }),
  ).toBeVisible();
  await expect(
    subproposals.getByRole("combobox", { name: "Add Subproject" }),
  ).toBeDisabled();
});
test("Contracts listing filters, paging and guarded Summary", async ({
  page,
}) => {
  await login(page);
  await page.goto("/contracts");
  await expect(page.locator("#contracts-new")).toBeVisible();
  const contractToggleRight = await page
    .locator("#contracts-toolbar label[for='contract-filter-toggle']")
    .evaluate((element) => element.getBoundingClientRect().right);
  const contractNewLeft = await page
    .locator("#contracts-new")
    .evaluate((element) => element.getBoundingClientRect().left);
  expect(contractNewLeft - contractToggleRight).toBeLessThan(24);
  await expect(
    page.getByRole("heading", { name: "Contracts", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("10 of 24")).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: "Sort ascending" })
      .locator(".oj-ux-ico-arrow-circle-down"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/contracts-list.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2")).toBeVisible();
  await page.getByRole("link", { name: "Draft", exact: true }).click();
  await expect(page).toHaveURL(/status=DRFT/);
  await expect(page.getByText("8 of 8")).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page).toHaveURL(/\/contracts$/);
  const referenceNumber = page.getByRole("textbox", {
    name: "Reference Object Number",
  });
  await referenceNumber.fill("P_100");
  await referenceNumber.press("Enter");
  await expect(page).toHaveURL(/referenceNumber=P_100/);
  await expect(page.getByText("1 of 1")).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page).toHaveURL(/\/contracts$/);
  await expect(referenceNumber).toHaveValue("");
  await page
    .getByRole("link", {
      name: "Research collaboration agreement 1",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("region", { name: "Contract Summary" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Contract Summary" })
      .getByText("Research collaboration agreement 1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Testing Text box" }),
  ).toHaveValue("Synthetic contract note");
  await expect(
    page.getByRole("link", { name: "Download Standard Template" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "View contract" })).toBeVisible();
  const [tagsDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Get Placeholder Tags" }).click(),
  ]);
  expect(tagsDownload.suggestedFilename()).toBe("Placeholder Variables.xlsx");
  await page.getByRole("button", { name: "Comments", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Comments" })).toContainText(
    "Please confirm the funder deadline.",
  );
  // The fixture's page has no edit right, so there is no composer (owner: hidden, not disabled).
  await expect(page.getByRole("button", { name: "Send" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/contracts-comments.png" });
  await page.getByRole("button", { name: "Close drawer" }).click();
  await expect(page).toHaveURL(/\/contracts\/1300$/);
  await page.getByRole("button", { name: "Open Audit Trail" }).click();
  await expect(page.getByRole("dialog", { name: "Audit Trail" })).toContainText(
    "UPDATED",
  );
  await page.getByRole("tab", { name: "UPDATED" }).click();
  await expect(page.getByRole("tab", { name: "UPDATED" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("tab", { name: "NEW VERSION CREATED" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "NEW VERSION CREATED" }).click();
  await expect(page.getByRole("dialog", { name: "Audit Trail" })).toContainText(
    "C_1300.pdf",
  );
  await page.screenshot({ path: "test-results/contracts-audit.png" });
  await page.getByRole("button", { name: "Close drawer" }).click();
  await expect(page).toHaveURL(/\/contracts\/1300$/);
  await page.screenshot({
    path: "test-results/contracts-summary.png",
    fullPage: true,
  });
});
test("Proposal and Contract filters fit and align on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/contracts");
  const contractFields = [
    "#contracts-filter-number",
    "#contracts-filter-sort",
    "#contracts-filter-contractType",
    "#contracts-filter-orgUnit",
    "#contracts-filter-reference",
  ];
  await expect(page.locator("#contracts-filter-sort-trigger")).toBeVisible();
  expect(
    await page
      .locator("#contracts-filter-sort [data-part='field']")
      .evaluate((field) => getComputedStyle(field).borderTopWidth),
  ).toBe("0px");
  for (const label of ["Date Sort", "Contract Type", "Org Unit"]) {
    await expect(
      page.locator("#contracts-filter-form").getByText(label),
    ).toBeVisible();
  }
  const contractRects = await page
    .locator(contractFields.join(", "))
    .evaluateAll((fields) =>
      fields.map((field) => {
        const { left, right } =
          field.closest("label")?.getBoundingClientRect() ??
          field.getBoundingClientRect();
        return { left, right };
      }),
    );
  for (const rect of contractRects) {
    expect(rect.left).toBeCloseTo(contractRects[0].left, 0);
    expect(rect.right).toBeGreaterThanOrEqual(contractRects[0].right - 24);
    expect(rect.right).toBeLessThanOrEqual(contractRects[0].right);
    expect(rect.right).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: "test-results/contracts-filters-phone.png" });

  await page.goto("/proposals");
  await expect(page.getByRole("combobox", { name: "Date Sort" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Direction" })).toHaveCount(
    0,
  );
  await page.locator("#proposals-direction").click();
  await expect(page.locator("#proposals-direction")).toHaveAttribute(
    "aria-label",
    "Sort descending",
  );
  await page.locator("#proposals-direction").click();
  await expect(page.locator("#proposals-create")).toBeVisible();
  await expect(page.locator("#proposals-create-outline")).toBeVisible();
  await expect(page.locator("#proposals-recycle-bin")).toBeVisible();
  await expect(
    page.locator("#proposal-outline-proposal-1000-link"),
  ).toBeVisible();
  await expect(
    page.locator("#proposal-outline-proposal-1000-share"),
  ).toBeVisible();
  await expect(
    page.locator("#proposal-outline-proposal-1000-clone"),
  ).toBeVisible();
  await expect(
    page.locator("#proposal-outline-proposal-1000-delete"),
  ).toBeVisible();
  // Not a draft: Delete is hidden, not disabled (owner, 2026-11-03).
  await expect(page.locator("#proposal-proposal-1001-delete")).toHaveCount(0);
  await expect(page.locator("#proposals-advanced-toggle")).toBeVisible();
  await expect(page.getByText("Advanced Query")).toHaveCount(1);
  await page.locator("#proposals-advanced-toggle").click();
  await expect(page.locator("#proposals-advanced")).toBeVisible();
  await expect(
    page.locator("#proposal-filters").getByText("Advanced Query"),
  ).toHaveCount(0);
  await expect(
    page.locator("#proposals-advanced-attribute-trigger"),
  ).toBeVisible();
  await page.locator("#proposals-advanced-attribute-trigger").click();
  await page.getByRole("option", { name: "Proposal Title" }).click();
  await page.locator("#proposals-advanced-operator-trigger").click();
  await page.getByRole("option", { name: "Contains (LIKE)" }).click();
  await page.locator("#proposals-advanced-value").fill("climate");
  await page.locator("#proposals-advanced-add").click();
  await expect(page).toHaveURL(/conditions=/);
  await expect(page.locator("#proposals-advanced-conditions")).toBeVisible();
  await expect(
    page.locator("#proposal-outline-proposal-1000-link"),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/proposals-advanced-query.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#proposals-advanced-close").click();
  await expect(page.locator("#proposals-advanced")).toHaveCount(0);
  await expect(
    page.locator("#proposals-filter-investigator-trigger"),
  ).toBeVisible();
  expect(
    await page
      .locator("#proposals-filter-investigator [data-part='field']")
      .evaluate((field) => getComputedStyle(field).borderTopWidth),
  ).toBe("0px");
  await expect(page.getByText("Rows per page")).toHaveCount(0);
  const proposalRects = await page
    .locator(".filter-panel > .inside-field")
    .evaluateAll((fields) =>
      fields.map((field) => {
        const { left, right } = field.getBoundingClientRect();
        return { left, right };
      }),
    );
  expect(proposalRects.length).toBeGreaterThan(1);
  for (const rect of proposalRects) {
    expect(rect.left).toBeCloseTo(proposalRects[0].left, 0);
    expect(rect.right).toBeCloseTo(proposalRects[0].right, 0);
    expect(rect.right).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: "test-results/proposals-filters-phone.png" });
  await page.setViewportSize({ width: 904, height: 986 });
  await page.getByRole("button", { name: "Close filters" }).click();
  await expect(page.locator("#proposal-filters-panel")).toHaveAttribute(
    "data-collapsed",
    "true",
  );
  await page.getByRole("button", { name: "Open filters" }).click();
  await expect(page.locator("#proposal-filters-panel")).not.toHaveAttribute(
    "data-collapsed",
    "true",
  );
  await expect(page.locator("#proposal-filters-panel")).toHaveCSS(
    "width",
    "240px",
  );
  const desktopSidebar = await page
    .locator("#proposal-filters")
    .evaluate((element) => element.getBoundingClientRect().right);
  const desktopFields = await page
    .locator(".filter-panel > .inside-field")
    .evaluateAll((fields) =>
      fields.map((field) => {
        const { left, right } = field.getBoundingClientRect();
        return { left, right };
      }),
    );
  for (const rect of desktopFields) {
    expect(rect.left).toBeCloseTo(6, 0);
    expect(rect.right).toBeLessThanOrEqual(desktopSidebar - 6);
  }
  await expect(page.locator(".category-options label")).toHaveCount(5);
  const categoryChoices = await page
    .locator(".category-options label")
    .evaluateAll((labels) =>
      labels.map((label) => {
        const { top, bottom } = label.getBoundingClientRect();
        return { top, bottom };
      }),
    );
  for (let index = 1; index < categoryChoices.length; index++) {
    expect(categoryChoices[index].top).toBeGreaterThan(
      categoryChoices[index - 1].bottom,
    );
  }
  await page.screenshot({ path: "test-results/proposals-filters-desktop.png" });
});
test("Contracts status and results stream before a slow filter lookup", async ({
  page,
}) => {
  test.skip(
    !process.env.GRANTSNOW_FIXTURE_DELAY_CONTRACT_LOOKUPS_MS,
    "Requires the isolated slow lookup fixture",
  );
  await login(page);
  await page.goto("/contracts", { waitUntil: "commit" });
  await expect(
    page.getByRole("link", { name: "Draft", exact: true }),
  ).toBeVisible();
  // Lookups are held per session (as VBCS holds them), so an earlier journey may already have read this one; the
  // list must not wait for it either way.
  await expect(page.getByText("10 of 24")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Contract Type" }),
  ).not.toHaveAttribute("aria-busy", "true");
});
test("Contract workflow keeps the record header and loads its route with a slow history", async ({
  page,
}) => {
  test.skip(
    !process.env.GRANTSNOW_FIXTURE_DELAY_CONTRACT_HISTORY_MS,
    "Requires the isolated slow history fixture",
  );
  await login(page);
  await page.goto("/contracts/1301");
  const header = page.getByRole("link", { name: "← List" }).locator("..");
  await header.evaluate((element) => {
    element.dataset.persistCheck = "kept";
  });
  await page.getByRole("link", { name: "Contracts Workflow" }).click();
  await expect(page).toHaveURL(/\/contracts\/1301\/workflow$/);
  await expect(header).toHaveAttribute("data-persist-check", "kept");
  await expect(
    page
      .getByRole("navigation", { name: "Contract sections" })
      .locator('[aria-current="page"]'),
  ).toContainText("Contracts Workflow");
  // The shared workflow reads the route and its history together, as the legacy fragment does.
  await expect(
    page.getByRole("heading", { name: "Approval Route" }),
  ).toBeVisible();
  await expect(
    page.locator("#contract-1301-workflow-history-table tbody tr"),
  ).toHaveCount(2);
});
test("Contracts creation fields and scoped Workflow navigation", async ({
  page,
}) => {
  await login(page);
  await page.goto("/contracts");
  await page.getByRole("link", { name: "New Contract" }).click();
  await expect(
    page.getByRole("heading", { name: "Contract Detail" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: /Contract Type/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add Deadline Date" }).click();
  const dialog = page.getByRole("dialog", { name: "Add new Deadline" });
  await expect(
    dialog.getByRole("textbox", { name: "Deadline Date *" }),
  ).toBeDisabled();
  // The searchable Select (every dropdown): open it and pick the first type.
  await dialog.getByRole("combobox", { name: /Deadline Type/ }).click();
  await page.getByRole("option").first().click();
  await expect(
    dialog.getByRole("textbox", { name: "Deadline Date *" }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.goto("/contracts/1301");
  await expect(page.getByRole("region", { name: "Test" })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Testing Text box" }),
  ).toHaveValue("Synthetic contract note");
  await page.getByRole("link", { name: "Workflow" }).click();
  await expect(
    page.getByRole("heading", { name: "Approval Route" }),
  ).toBeVisible();
  await expect(page.locator('ol[id$="-stages"] li').first()).toContainText(
    "Contract Approval",
  );
  await page.getByRole("button", { name: "Graph View" }).click();
  await expect(page.locator(".Treant-loaded .node")).toHaveCount(3);
  await expect
    .poll(() => page.locator(".Treant-loaded svg path").count())
    .toBeGreaterThan(2);
  await page.screenshot({ path: "test-results/contracts-workflow-graph.png" });
  await page.getByRole("button", { name: "Card View" }).click();
  await expect(page.getByRole("button", { name: "Card View" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator('[id$="history-cards"] li').first()).toContainText(
    "Approved",
  );
  await page.locator('[id$="history-cards"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/contracts-workflow-cards.png" });
});
test("shared approval views render on an EOI host", async ({ page }) => {
  await login(page);
  await page.goto("/opportunities/eoi/1001/approvals");
  await expect(page.locator("#eoi-workflow")).toBeVisible();
  await page.getByRole("button", { name: "Graph View" }).click();
  await expect(page.locator("#eoi-workflow .Treant-loaded .node")).toHaveCount(
    3,
  );
  await page.getByRole("button", { name: "Card View" }).click();
  await expect(
    page.locator('#eoi-workflow [id$="history-cards"] li').first(),
  ).toBeVisible();
});
test("Contracts History, Signers and Delegation use the shared subflow shell", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 1170 });
  await login(page);
  await page.goto("/contracts/1301/history");
  await expect(
    page.getByRole("region", { name: "Contract Summary" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Contract History" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Status" })).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Transaction No." }),
  ).toBeVisible();
  await expect(page.locator("#contract-history-table tbody tr")).toHaveCount(3);
  await page.screenshot({ path: "test-results/contracts-history.png" });
  await page.getByRole("button", { name: "Add Status" }).click();
  await expect(
    page.getByRole("dialog", { name: /Add New Status/i }),
  ).toBeVisible();
  await page.locator("#contract-history-dialog-cancel").click();
  await page.goto("/contracts/1301/signers");
  await expect(
    page.getByRole("region", { name: "Contract Summary" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Signers" })).toBeVisible();
  await expect(page.getByText("sam.taylor@example.org")).toBeVisible();
  await page.screenshot({ path: "test-results/contracts-signers.png" });
  await page.goto("/contracts/1301/delegation");
  await expect(
    page.getByRole("region", { name: "Contract Summary" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Delegation" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/contracts-delegation.png" });
  await page.getByRole("button", { name: "Add Delegation" }).click();
  await expect(
    page.getByRole("dialog", { name: "Add Delegation" }),
  ).toBeVisible();
  const personLabel = page
    .getByRole("dialog", { name: "Add Delegation" })
    .getByText("Search by Name", { exact: false })
    .first();
  await expect(personLabel).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Search by Name" }),
  ).toBeVisible();
  expect(
    await personLabel.evaluate((element) => getComputedStyle(element).top),
  ).toBe("4px");
  await page.getByRole("combobox", { name: "Search by Name" }).click();
  await page.getByRole("option", { name: /Alex Morgan/ }).click();
  await expect(
    page.getByRole("listbox", { name: "Search by Name" }),
  ).toBeHidden();
  const selectedChip = page
    .getByRole("dialog", { name: "Add Delegation" })
    .locator('[data-part="field"] [class*="chip"]')
    .getByText("Alex Morgan", { exact: true });
  await expect(selectedChip).toBeVisible();
  const labelBounds = await personLabel.boundingBox();
  const chipBounds = await selectedChip.boundingBox();
  expect(
    labelBounds &&
      chipBounds &&
      labelBounds.y + labelBounds.height <= chipBounds.y,
  ).toBe(true);
  await page.screenshot({
    path: "test-results/contracts-delegation-dialog.png",
  });
  await page
    .getByRole("dialog", { name: "Add Delegation" })
    .getByRole("button", { name: "Close" })
    .click();
  const commentsRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === "/api/objects/comments" &&
      url.searchParams.get("page") === "contracts-delegation"
    );
  });
  await page.getByRole("button", { name: "Comments", exact: true }).click();
  await commentsRequest;
  await expect(page.getByRole("dialog", { name: "Comments" })).toContainText(
    "Please confirm the funder deadline.",
  );
});
test("login boundary, protected API, callback rejection and CSRF", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/proposals")).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth/logout", {
        headers: { origin: "https://evil.example" },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/proposals?search=climate");
  await expect(page).toHaveURL(/login/);
  await expect(page.locator("input[name=returnTo]")).toHaveValue(
    "/proposals?search=climate",
  );
  await page.goto("/api/auth/callback?code=invalid&state=invalid");
  await expect(page).toHaveURL(/LOGIN_FAILED/);
});
test("Home queues, organization/year filters, independent failure/retry, navigation", async ({
  page,
}) => {
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Proposals Approaching Deadlines" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Contracts Approaching Deadlines" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Insights", exact: true }).click();
  await page.getByRole("combobox", { name: "Dashboard organization" }).click();
  await page.getByRole("option", { name: "Faculty of Science" }).click();
  await expect(page).toHaveURL(/organization=203/);
  await page.getByRole("combobox", { name: "Years", exact: true }).click();
  await page.getByRole("option", { name: "2026", exact: true }).click();
  await expect(page).toHaveURL(/year=2026/);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/organization=203/);
  await page.getByRole("tab", { name: "Need Attention", exact: true }).click();
  const widget = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "Proposals Approaching Deadlines",
      exact: true,
    }),
  });
  let fail = true;
  await page.route("**/api/home/pApproachingDeadlines?**", async (route) => {
    if (fail)
      await route.fulfill({
        status: 502,
        json: { error: { code: "UPSTREAM", message: "Isolated test failure" } },
      });
    else await route.continue();
  });
  // The whole-institution scope has a second page; scrolling the queue requests it, and that request fails in isolation.
  await page.getByRole("combobox", { name: "Dashboard organization" }).click();
  await page
    .getByRole("option", { name: "Example Research University", exact: true })
    .click();
  await expect(page).toHaveURL(/organization=202/);
  await nextPageOnScroll(
    widget.locator(".attention-list"),
    widget.getByText("Isolated test failure"),
  );
  await expect(
    page.getByRole("heading", { name: "Contract Awaiting Your Approval" }),
  ).toBeVisible();
  fail = false;
  await widget.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(widget.getByText("Isolated test failure")).toHaveCount(0);
  await widget.getByRole("tab", { name: "Calendar View", exact: true }).click();
  // FullCalendar (D17) loads on first open of Calendar View.
  const title = widget.locator(".fc-toolbar-title");
  await expect(widget.locator(".fc-daygrid")).toBeVisible();
  const month = await title.textContent();
  await widget.getByRole("button", { name: "Previous Month" }).click();
  await expect(title).not.toHaveText(month ?? "");
  await widget.getByRole("tab", { name: "List View", exact: true }).click();
  await expect(widget.locator(".attention-list")).toBeVisible();
  await navigateProposals(page);
  await expect(
    page.getByRole("heading", { name: "Proposals", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/proposals-desktop.png",
    fullPage: true,
    caret: "initial",
  });
});
test("Proposal listing opens recycle and clone options from VBCS actions", async ({
  page,
}) => {
  await login(page);
  await page.goto("/proposals");
  await page.locator("#proposals-recycle-bin").click();
  await expect(page.getByRole("dialog", { name: "Recycle bin" })).toContainText(
    "No data to display.",
  );
  await page.locator("#proposals-recycle-dialog-close").click();
  await page.locator("#proposal-outline-proposal-1000-clone").click();
  await expect(
    page.getByRole("dialog", { name: "Clone proposal" }),
  ).toContainText("Costing & Pricing");
  await page.locator("#proposals-clone-dialog-close").click();
  await page.locator("#proposal-outline-proposal-1000-share").click();
  await page.locator("#proposals-share-as-document").click();
  await expect(
    page.getByRole("dialog", { name: "Share as document" }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Report" })).toBeVisible();
  await page.locator("#proposals-share-document-dialog-close").click();
  const shared = await page.evaluate(async () => {
    const response = await fetch("/api/proposals/actions/share-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "OUTLINE_PROPOSAL",
        id: "1000",
        report: "proposal-summary",
        emails: ["alex@example.test"],
      }),
    });
    return response.status;
  });
  expect(shared).toBe(200);
  const forbidden = await page.evaluate(async () => {
    const response = await fetch("/api/proposals/actions/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "PROPOSAL", id: "1001" }),
    });
    return response.status;
  });
  expect(forbidden).toBe(403);
});
test("listing search, filter, reset, scroll loading, back, reload, masked values", async ({
  page,
}) => {
  await login(page);
  await navigateProposals(page);
  await expect(
    page.locator(".listing-count").filter({ hasText: "10 of 37" }),
  ).toBeVisible();
  await page.locator(".proposal-cards").evaluate((list) => {
    list.scrollTop = list.scrollHeight;
    list.dispatchEvent(new Event("scroll"));
  });
  await expect(page.locator(".proposal-card")).toHaveCount(20);
  await page.reload();
  await expect(page.locator(".proposal-card")).toHaveCount(10);
  await page.getByLabel("Title", { exact: true }).fill("Climate");
  await page.getByLabel("Title", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/search=Climate/);
  await expect(
    page.locator(".listing-count").filter({ hasText: "10 of 10" }),
  ).toBeVisible();
  await page
    .getByRole("radio", { name: "Outline Proposal", exact: true })
    .check();
  await expect(page).toHaveURL(/type=OUTLINE_PROPOSAL/);
  await expect(page.locator(".proposal-card")).toHaveCount(4);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    page.locator(".listing-count").filter({ hasText: "10 of 37" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/OUTLINE_PROPOSAL/);
  await expect(page.locator(".proposal-card")).toHaveCount(4);
  await page.goForward();
  await expect(
    page.locator(".listing-count").filter({ hasText: "10 of 37" }),
  ).toBeVisible();
  await page.getByLabel("Proposal Number", { exact: true }).fill("NO-MATCH");
  await page.getByLabel("Proposal Number", { exact: true }).press("Enter");
  await expect(
    page.getByRole("heading", { name: "No matching proposals" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    page.locator(".listing-count").filter({ hasText: "10 of 37" }),
  ).toBeVisible();
});
test("failed listing recovery and late responses cannot replace current query", async ({
  page,
}) => {
  await login(page);
  await navigateProposals(page);
  let fail = true;
  await page.route("**/api/proposals?**", async (route) => {
    if (fail)
      await route.fulfill({
        status: 502,
        json: { error: { code: "UPSTREAM", message: "Test listing failure" } },
      });
    else await route.continue();
  });
  await page.getByLabel("Title", { exact: true }).fill("Climate");
  await page.getByLabel("Title", { exact: true }).press("Enter");
  await expect(page.getByText("Test listing failure")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.locator(".listing-count").filter({ hasText: "10 of 10" }),
  ).toBeVisible();
  await page.unroute("**/api/proposals?**");
  await page.route("**/api/proposals?**", async (route) => {
    if (route.request().url().includes("search=Digital")) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      try {
        await route.continue();
      } catch {
        /* Superseded requests may be canceled. */
      }
    } else await route.continue();
  });
  await page.getByLabel("Title", { exact: true }).fill("Digital");
  await page.getByLabel("Title", { exact: true }).press("Enter");
  await page.waitForRequest(
    (r) => r.url().includes("/api/proposals?") && r.url().includes("Digital"),
  );
  await page.getByLabel("Title", { exact: true }).fill("Sustainable");
  await page.getByLabel("Title", { exact: true }).press("Enter");
  await expect(
    page.locator(".listing-count").filter({ hasText: "9 of 9" }),
  ).toBeVisible();
  await expect(page.locator(".proposal-cards")).toContainText("Sustainable");
  await expect(page.locator(".proposal-cards")).not.toContainText("Digital");
});
test("narrow layout keyboard, private cache and no tokens in client payload; logout", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (/hydrated|hydration mismatch/i.test(message.text()))
      errors.push(message.text());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
    caret: "initial",
  });
  await navigateProposals(page);
  await expect(
    page.locator(".listing-count").filter({ hasText: "10 of 37" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close filters" }).click();
  await page.getByRole("button", { name: "Open filters" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("radio", { name: "Outline Proposal", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("health");
  await page.getByLabel("Title", { exact: true }).press("Enter");
  await expect(
    page.locator(".listing-count").filter({ hasText: "9 of 9" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const response = await page.request.get("/api/proposals");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.text()).not.toContain("fixture-backend-token");
  expect(await page.content()).not.toContain("fixture-backend-token");
  expect(
    (await context.cookies()).find((c) => c.name === "grantsnow-local")
      ?.httpOnly,
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => !k.startsWith("gn-guide:")),
    ),
  ).toEqual([]);
  await page.locator("#user-menu > summary").click();
  expect(
    (
      await page.request.post("/api/auth/renew", {
        headers: { origin: new URL(page.url()).origin },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("menuitem", { name: "Sign Out", exact: true }).click();
  await expect(page).toHaveURL(/SIGNED_OUT/);
  expect((await page.request.get("/api/proposals")).status()).toBe(401);
  expect(errors).toEqual([]);
});
test("Proposal Summary guards, safe navigation, announcements and dashboard keyboard tabs", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/proposals/PROPOSAL/1001")).status()).toBe(
    401,
  );
  expect(
    (await request.get("/api/proposals/PROPOSAL/..%2Fsession")).status(),
  ).toBeGreaterThanOrEqual(400);
  await login(page);
  await expect(
    page.getByText("Development workspace", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next announcement" }).click();
  await expect(
    page.getByText("Explore the Home dashboard and Proposal listing."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Need Attention", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Insights", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("tab", { name: "Insights", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "Application Navigation Drawer" })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Application Navigation Drawer" }),
  ).toBeFocused();
  await navigateProposals(page);
  await page.locator(".record-title a").first().click();
  await expect(page).toHaveURL(/proposals\/(PROPOSAL|OUTLINE_PROPOSAL)\/\d+/);
  await expect(
    page.getByRole("heading", { name: "Principal Investigator Details" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Proposal Details" }),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic project description for local UI verification."),
  ).toBeVisible();
  const result = await page.request.get("/api/proposals/PROPOSAL/1001");
  expect(result.status()).toBe(200);
  expect(result.headers()["cache-control"]).toContain("no-store");
  expect(await result.text()).not.toContain("fixture-backend-token");
  await page.screenshot({
    path: "test-results/proposal-summary.png",
    fullPage: true,
    caret: "initial",
  });
});

test("Proposal record keeps its header while shared read tabs load", async ({
  page,
}) => {
  await login(page);
  await page.goto("/proposals/PROPOSAL/1001");
  await expect(page.locator("#proposals-summary-tab")).toContainText(
    "Proposal Summary",
  );
  await expect(
    page.locator("#proposals-summary-tab [aria-label='Finalized']"),
  ).toBeVisible();
  await expect(page.locator("#proposal-1001-finalized-by")).toHaveText(
    "Module finalized: Mitchell Carole",
  );
  const heading = page.locator("#proposal-1001-heading");
  await expect(heading).toBeVisible();
  const title = await heading.getByRole("heading").textContent();
  await page.getByRole("link", { name: "Proposal Detail" }).click();
  await expect(page).toHaveURL(/\/dynamic-form-1$/);
  await expect(heading.getByRole("heading")).toHaveText(title ?? "");
  await page.getByRole("link", { name: "Approvals" }).click();
  await expect(page.locator("#proposal-1001-workflow")).toBeVisible();
  await page.screenshot({
    path: "test-results/proposal-approvals.png",
    fullPage: true,
  });
  expect(
    (
      await page.request.post("/api/proposals/PROPOSAL/1001/approvals")
    ).status(),
  ).toBe(405);
  await page.getByRole("link", { name: "History" }).click();
  await expect(page.locator("#proposal-1001-history-panel")).toBeVisible();
  await page.getByRole("link", { name: "Attachments" }).click();
  await expect(page.locator("#proposal-1001-attachments-panel")).toBeVisible();
  await page.getByRole("link", { name: "Contracts" }).click();
  await expect(page.locator("#proposal-1001-contracts")).toContainText(
    "No data to display.",
  );
  await page.getByRole("link", { name: "Delegation" }).click();
  await expect(page.locator("#proposal-1001-delegation-panel")).toBeVisible();
  await page.getByRole("button", { name: "Comments" }).click();
  await expect(page.getByRole("dialog", { name: "Comments" })).toBeVisible();
});

test("Proposal FEC Summary generates a filterable report and chart from the analysis response", async ({
  page,
}) => {
  await login(page);
  await page.goto("/proposals/PROPOSAL/1001/fec-summary");
  await expect(page.locator("#proposal-1001-fec-summary")).toBeVisible();
  await page.route(
    "**/api/proposals/PROPOSAL/1001/fec-summary",
    async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({
        query: "Annual cost trend analysis",
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [
            { YEAR: "2026", TOTAL_COST: 10 },
            { YEAR: "2027", TOTAL_COST: 20 },
          ],
          chart: { name: "Annual cost", types: ["bar", "line"] },
        }),
      });
    },
  );
  await page
    .locator("#proposal-1001-fec-query")
    .fill("Annual cost trend analysis");
  await page.locator("#proposal-1001-fec-generate").click();
  await expect(page.locator("#proposal-1001-fec-table tbody tr")).toHaveCount(
    2,
  );
  await expect(page.locator("#proposal-1001-fec-chart")).toBeVisible();
  await page.locator("#proposal-1001-fec-filter-YEAR").fill("2027");
  await expect(page.locator("#proposal-1001-fec-table tbody tr")).toHaveCount(
    1,
  );
  await expect(page.locator("#proposal-1001-fec-table tbody tr")).toContainText(
    "20",
  );
});

test("Proposal Budget keeps funding and category rows aligned as an expandable tree", async ({
  page,
}) => {
  await login(page);
  await page.goto("/proposals/PROPOSAL/1001/budget");
  const table = page.locator("#proposal-1001-budget-tree-1001-primary");
  const partner = page.locator("#proposal-1001-budget-tree-1001-42");
  await expect(partner).toContainText("Travel");
  await expect(partner).toContainText("£10.73");
  await expect(table).not.toContainText("Travel");
  await page.getByLabel("Show Year Split").check();
  await expect(
    partner.getByRole("columnheader", { name: "2026/27 (Indexed)" }),
  ).toBeVisible();
  await expect(
    table.getByRole("columnheader", { name: "2026/27 (Indexed)" }),
  ).toHaveCount(0);
  await expect(table).toContainText("Directly Allocated");
  await expect(table).toContainText("Alex Morgan");
  await table.getByRole("button", { name: "Directly Allocated" }).click();
  await expect(table.getByRole("row", { name: /Staff/ })).toHaveCount(0);
  await table.getByRole("button", { name: "Directly Allocated" }).click();
  await table.getByRole("button", { name: "Staff" }).click();
  await expect(table.getByRole("row", { name: /Alex Morgan/ })).toHaveCount(0);
  await table.getByRole("button", { name: "Staff" }).click();
  await expect(table.getByRole("row", { name: /Alex Morgan/ })).toBeVisible();
  await page.getByRole("button", { name: "Viability Checks" }).click();
  await expect(
    page.getByRole("dialog", { name: "Viability Checks" }),
  ).toContainText("Budget coverage");
  await expect(
    page.getByRole("dialog", { name: "Viability Checks" }),
  ).not.toContainText("DO-NOT-EXPOSE");
  await page.screenshot({
    path: "test-results/proposal-budget-tree.png",
    fullPage: true,
  });
});

test("Proposal Budget opens the VBCS staff and nonstaff costing flows", async ({
  page,
}) => {
  await login(page);
  await page.goto("/proposals/OUTLINE_PROPOSAL/1000/budget");
  const actions = page.locator("#proposal-1000-budget-add-actions");
  await expect(
    actions.getByRole("button", { name: "Add Staff Cost" }),
  ).toBeVisible();
  await expect(
    actions.getByRole("button", { name: "Add Non Staff Cost" }),
  ).toBeVisible();
  await expect(
    actions.getByRole("button", { name: "Add Research Partner Costs" }),
  ).toBeVisible();
  await actions.getByRole("button", { name: "Add Staff Cost" }).click();
  await expect(
    page.getByRole("dialog", { name: "Add Staff Cost" }),
  ).toContainText("Project role");
  const staff = page.getByRole("dialog", { name: "Add Staff Cost" });
  await staff.getByRole("combobox", { name: "Funding section" }).click();
  await page.getByRole("option", { name: "Directly Allocated" }).click();
  await staff.getByRole("combobox", { name: "Project role" }).click();
  await page.getByRole("option", { name: "Principal investigator" }).click();
  await staff.getByRole("combobox", { name: "Person" }).click();
  await page.getByRole("option", { name: "Alex Morgan" }).click();
  await staff.getByRole("textbox", { name: "Start date" }).fill("01-Jan-2027");
  await staff.getByRole("textbox", { name: "End date" }).fill("31-Dec-2027");
  await staff.getByRole("button", { name: "Save" }).click();
  await expect(staff).toHaveCount(0);
  await actions.getByRole("button", { name: "Add Non Staff Cost" }).click();
  await expect(
    page.getByRole("dialog", { name: "Add Non Staff Cost" }),
  ).toContainText("Cost category");
  const nonstaff = page.getByRole("dialog", { name: "Add Non Staff Cost" });
  await nonstaff.getByRole("combobox", { name: "Funding section" }).click();
  await page.getByRole("option", { name: "Directly Allocated" }).click();
  await nonstaff.getByRole("combobox", { name: "Cost category" }).click();
  await page
    .getByRole("listbox", { name: "Cost category" })
    .getByRole("option", { name: "Equipment" })
    .click();
  await nonstaff.getByRole("combobox", { name: "Cost item" }).click();
  await page
    .getByRole("listbox", { name: "Cost item" })
    .getByRole("option", { name: "Equipment" })
    .click();
  await nonstaff.getByLabel("Item description").fill("Microscope");
  await nonstaff
    .getByRole("textbox", { name: "Start date" })
    .fill("01-Jan-2027");
  await nonstaff.getByRole("textbox", { name: "End date" }).fill("31-Dec-2027");
  await nonstaff.getByLabel("Unit cost").fill("10");
  await nonstaff.getByRole("button", { name: "Save" }).click();
  await expect(nonstaff).toHaveCount(0);
});

test("Proposal scroll loading preserves records, retries failures and resets on a new filter", async ({
  page,
}) => {
  await login(page);
  await navigateProposals(page);
  let fail = true;
  await page.route("**/api/proposals?**", async (route) => {
    if (
      new URL(route.request().url()).searchParams.get("page") === "2" &&
      fail
    ) {
      fail = false;
      await route.fulfill({
        status: 502,
        json: {
          error: { code: "UPSTREAM", message: "Isolated append failure" },
        },
      });
    } else await route.continue();
  });
  const list = page.locator(".proposal-cards");
  await list.evaluate((e) => {
    e.scrollTop = e.scrollHeight;
  });
  await expect(
    page.getByText("More proposals could not be loaded. Retry to continue."),
  ).toBeVisible();
  await expect(page.locator(".proposal-card")).toHaveCount(10);
  await page.getByRole("button", { name: "Retry load more" }).click();
  await expect(page.locator(".proposal-card")).toHaveCount(20);
  await expect(page.locator(".listing-count")).toHaveText("20 of 37");
  await page.getByLabel("Title", { exact: true }).fill("Climate");
  await page.getByLabel("Title", { exact: true }).press("Enter");
  await expect(page.locator(".proposal-card")).toHaveCount(10);
  await expect(page.locator(".listing-count")).toHaveText("10 of 10");
});

test("preview-style desktop drawer, user menu and Opportunities routes", async ({
  page,
}) => {
  await login(page);
  const before = await page
    .locator("main")
    .evaluate((e) => e.getBoundingClientRect().x);
  await page
    .getByRole("button", { name: "Application Navigation Drawer" })
    .click();
  // The shell's margin transitions, so poll until it settles.
  await expect
    .poll(() =>
      page.locator("main").evaluate((e) => e.getBoundingClientRect().x),
    )
    .toBe(before + 240);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Application Navigation Drawer" }),
  ).not.toBeVisible();
  await page.locator("#user-menu > summary").click();
  await expect(
    page.getByRole("menuitem", { name: "Manage profile" }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "Preferences" }).click();
  await expect(
    page.getByRole("dialog", { name: "User Preferences" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Dark", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".app")).toHaveClass(/dark/);
  await page.locator("#user-menu > summary").click();
  await page.getByRole("menuitem", { name: "Preferences" }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".app")).not.toHaveClass(/dark/);
  await page.goto("/opportunities");
  await expect(
    page.getByRole("heading", { name: "Funding opportunities", exact: true }),
  ).toHaveCount(1);
  await expect(page.locator(".opportunity-card")).toHaveCount(25);
  await expect(page.locator(".listing-count")).toHaveText("25 of 58");
  // Panel filters apply at once and are written to the address (manageFilterURL).
  await page.getByText("Funding Type", { exact: true }).first().click();
  await page.getByRole("checkbox", { name: "Fellowship", exact: true }).check();
  await expect(page.locator(".listing-count")).toHaveText("25 of 29");
  await expect(page).toHaveURL(/fundingType=Fellowship/);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator(".listing-count")).toHaveText("25 of 58");
  await page.getByRole("tab", { name: "Bookmarked", exact: true }).click();
  await expect(page.locator(".listing-count")).toHaveText("25 of 29");
  // Infinite scroll: the next page loads near the bottom; the strip then shows the total.
  await page
    .getByRole("list", { name: "Opportunities List", exact: true })
    .evaluate((list) => list.scrollTo(0, list.scrollHeight));
  await expect(page.locator(".opportunity-card")).toHaveCount(29);
  await expect(page.locator(".listing-count")).toHaveText("Total: 29");
  // A tab already seen shows its held list at once, while its background refresh is still slow.
  await page.route("**/api/opportunities?*", async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue().catch(() => undefined);
  });
  await page.getByRole("tab", { name: /^Featured/ }).click();
  await expect(page.locator(".listing-count")).toHaveText("25 of 58", {
    timeout: 1000,
  });
  await expect(page.locator("#finder-list-loading")).toHaveCount(0);
  await page.getByRole("tab", { name: "Bookmarked", exact: true }).click();
  await expect(page.locator(".listing-count")).toHaveText("Total: 29", {
    timeout: 1000,
  });
  await expect(page.locator("#finder-list-loading")).toHaveCount(0);
  await page.unroute("**/api/opportunities?*");
  // More Info opens the opportunity's summary as a detail page, with its actions and no tabs.
  await page
    .getByRole("link", { name: /More Info:/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/opportunities\/\d+$/);
  await expect(page.getByText("Synthetic opportunity summary.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Application pages" }),
  ).toHaveCount(0);
  // Apply opens a new application (Summary + Application) without creating anything.
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page).toHaveURL(/\/opportunities\/eoi\/new\/\d+\/application$/);
  await expect(
    page
      .getByRole("navigation", { name: "Application pages" })
      .getByRole("link"),
  ).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Create", exact: true }),
  ).toBeVisible();
  await page.goto("/opportunities/eoi");
  const eoiRows = page.locator("[data-eoi-row]");
  await expect(eoiRows.first()).toBeVisible();
  // Page-scoped status list: "Rejected" narrows the list; Clear keeps the chosen status.
  await page
    .getByRole("navigation", { name: "Choose a navigation item" })
    .getByRole("button", { name: "Rejected", exact: true })
    .click();
  await expect(eoiRows.first().locator(".gn-status")).toHaveText("Rejected");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rejected", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByRole("button", { name: "View EOI_1", exact: true }).click();
  await expect(page.getByText("Synthetic opportunity summary.")).toBeVisible();
  await expect(
    page.getByText("Application Number", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Application Details", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Project title" }),
  ).toHaveValue("Synthetic research project");
  await expect(
    page.getByRole("button", { name: "Edit Application", exact: true }),
  ).toBeVisible();
  // The shared panels, as legacy, carry no heading named after the tab; each renders its own root.
  for (const [tab, panel] of [
    ["Attachments", "eoi-attachments"],
    ["Workflow", "eoi-record-approvals"],
    ["Delegation", "opportunities-eoi-delegation"],
    ["History", "opportunities-eoi-history"],
  ]) {
    await page.getByRole("link", { name: tab, exact: true }).click();
    await expect(page.locator(`#${panel}`)).toBeVisible();
  }
  for (const tab of [1, 2, 3, 4, 5].map((n) => `Dynamic Form ${n}`)) {
    const link = page.getByRole("link", { name: tab, exact: true });
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "page");
  }
  // Comments and the audit trail open the end drawer (placeholders until the shared versions land).
  await page.getByRole("button", { name: "Comments", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Dynamic Form 5" }),
  ).toBeVisible();
  await page.goto("/opportunities/analytics");
  await expect(
    page.getByRole("heading", { name: "Top Funders", exact: true }),
  ).toBeVisible();
  // Both legacy charts draw, the pie with DEV's unlabelled first row too.
  await expect(
    page.locator("#opportunity-analytics-funding-type-chart"),
  ).toBeVisible();
  await expect(
    page.locator("#opportunity-analytics-top-funders-chart"),
  ).toBeVisible();
});

test("record skeletons remain visible during delayed refresh and honor reduced motion", async ({
  page,
}) => {
  await login(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  // The next page is held until the skeleton has been checked, so a fast fixture cannot race the assertions.
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/home/*?*", async (route) => {
    await held;
    await route.continue();
  });
  const loading = page.getByRole("status", {
    name: "Loading more Proposals Approaching Deadlines",
  });
  await nextPageOnScroll(
    page
      .locator("article")
      .filter({
        has: page.getByRole("heading", {
          name: "Proposals Approaching Deadlines",
          exact: true,
        }),
      })
      .locator(".attention-list"),
    loading,
  );
  await expect(loading).toHaveAttribute("aria-busy", "true");
  await expect(loading.locator(".skeleton").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  release();
  await expect(loading).toBeHidden();
  await page
    .getByRole("button", { name: "Application Navigation Drawer" })
    .click();
  await expect(page.locator(".navigation-drawer")).toHaveCSS(
    "background-color",
    "rgb(49, 83, 87)",
  );
  await page.keyboard.press("Escape");
  await navigateProposals(page);
  await page.route("**/api/proposals?*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.getByLabel("Title", { exact: true }).fill("research");
  await page.getByLabel("Title", { exact: true }).press("Enter");
  await expect(
    page.getByRole("status", { name: "Loading proposals", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Loading proposals", exact: true }),
  ).toBeHidden();
});

test("all configured dashboard tabs load, page, recover and reject unapproved charts", async ({
  page,
  request,
}) => {
  await login(page);
  await expect(
    page.getByRole("tab", { name: "Opportunities", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Opportunities", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Featured Opportunities" }),
  ).toBeVisible();
  await expect(
    page.locator(".featured-opportunities li").first(),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Notifications", exact: true }).click();
  await expect(
    page.getByText("Synthetic notification 1", { exact: true }),
  ).toBeVisible();
  // The list loads its next page on scroll; a failed page keeps the loaded rows and offers Retry.
  await page.route("**/api/home/tabs/notifications?*", (route) =>
    route.fulfill({
      status: 502,
      json: {
        error: { code: "UPSTREAM", message: "Isolated notification failure" },
      },
    }),
  );
  await page
    .locator(".notification-list")
    .evaluate((list) => list.scrollTo(0, list.scrollHeight));
  await expect(page.getByText("Isolated notification failure")).toBeVisible();
  await expect(
    page.getByText("Synthetic notification 1", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/home/tabs/notifications?*");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByText("Synthetic notification 26", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Dynamic Charts", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Proposal by status: values listed below" }),
  ).toBeVisible();
  await page.getByText("View chart data", { exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "12", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByRole("menuitem", { name: "Dimensions", exact: true }).click();
  // The dialog title is the RB `dialog-titles` value ("Set Dimension").
  const dimensionDialog = page.getByRole("dialog", {
    name: "Set Dimension",
    exact: true,
  });
  await dimensionDialog.getByLabel("Cols").fill("12");
  await dimensionDialog
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(dimensionDialog).toBeHidden();
  await expect(page.locator(".dynamic-chart-tile")).toHaveCSS(
    "flex-basis",
    "100%",
  );
  expect(
    (
      await page.request.post("/api/home/tabs/charts", {
        headers: { origin: "https://evil.example" },
        data: { infolet_id: 201, colspan: 6, rowspan: 3 },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await page.request.get("/api/home/tabs/charts?id=999")).status(),
  ).toBe(403);
  expect((await request.get("/api/home/tabs/notifications")).status()).toBe(
    401,
  );
});

test("Insights follows source chart types, multi-select filters, expansion and independent failures", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("tab", { name: "Insights", exact: true }).click();
  const scatter = page.locator(".insight-widget").filter({
    has: page.getByRole("heading", {
      name: "Proposal Value By Cost Recovery %",
      exact: true,
    }),
  });
  await expect(scatter.locator(".insight-chart-host svg")).toBeVisible();
  await expect(scatter).toHaveCSS("grid-column", "span 12");
  await page
    .getByRole("button", {
      name: "Expand Proposal Value By Cost Recovery %",
      exact: true,
    })
    .click();
  // The shared dialog frame names a dialog by its title.
  const expanded = page.getByRole("dialog", {
    name: "Proposal Value By Cost Recovery %",
    exact: true,
  });
  await expect(expanded.locator(".insight-chart-host svg")).toBeVisible();
  await expanded.getByRole("button", { name: "Close expanded chart" }).click();
  await page.getByRole("combobox", { name: "Years", exact: true }).click();
  await page.getByRole("option", { name: "2025", exact: true }).click();
  await expect(page).toHaveURL(/year=2025/);
  // Picking keeps focus in the field (one combobox) and the list open for more picks.
  await expect(
    page.getByRole("combobox", { name: "Years", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("option", { name: "2025", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("option", { name: "2026", exact: true }).click();
  await expect(page).toHaveURL(/year=2026%2C2025|year=2025%2C2026/);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Clear insights filters" }).click();
  await expect(page).not.toHaveURL(/year=/);
  await page.route("**/api/home/pByStatusChart?*", (route) =>
    route.fulfill({
      status: 502,
      json: {
        error: { code: "UPSTREAM", message: "Isolated Insights failure" },
      },
    }),
  );
  await page.getByRole("combobox", { name: "Years", exact: true }).click();
  await page.getByRole("option", { name: "2026", exact: true }).click();
  await expect(page.getByText("Isolated Insights failure")).toBeVisible();
  await expect(scatter.locator(".insight-chart-host svg")).toBeVisible();
  await page.unroute("**/api/home/pByStatusChart?*");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Isolated Insights failure")).toBeHidden();
});

test("account dialogs, research save, preferences and accessible preview cancellation", async ({
  page,
}) => {
  await login(page);
  await page.locator("#user-menu > summary").click();
  await page.getByRole("menuitem", { name: "Manage profile" }).click();
  const profile = page.getByRole("dialog", { name: "Manage profile" });
  await expect(
    profile.getByRole("tab", { name: "Profile", exact: true }),
  ).toBeVisible();
  await profile.getByRole("tab", { name: "Preference", exact: true }).click();
  await profile.getByRole("button", { name: "Save", exact: true }).click();
  await expect(profile).not.toBeVisible();
  await page.locator("#user-menu > summary").click();
  await page
    .getByRole("menuitem", { name: "Preferences", exact: true })
    .click();
  const preferences = page.getByRole("dialog", { name: "User Preferences" });
  await expect(
    preferences.getByRole("heading", { name: "Infolets" }),
  ).toBeVisible();
  await preferences.getByRole("button", { name: "Save", exact: true }).click();
  await expect(preferences).not.toBeVisible();
  await page.locator("#user-menu > summary").click();
  await page
    .getByRole("menuitem", { name: "Accessibility", exact: true })
    .click();
  const accessibility = page.getByRole("dialog", {
    name: "Accessibility",
    exact: true,
  });
  await accessibility.getByRole("button", { name: "Bigger Text: 0%" }).click();
  await expect(page.locator("html")).toHaveClass(/accFontSize-25/);
  await accessibility
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(page.locator("html")).toHaveClass(/accFontSize-0/);
});
test("EOI create, finalize hidden while editing, and an attachment upload and delete", async ({
  page,
}) => {
  await login(page);
  await page.goto("/opportunities");
  await page
    .getByRole("link", { name: /More Info:/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/opportunities\/\d+$/);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page).toHaveURL(/\/opportunities\/eoi\/new\/\d+\/application$/);
  const create = page.getByRole("button", { name: "Create", exact: true });
  // Create waits for the form, so a record is never inserted without its answers.
  await expect(
    page.getByRole("textbox", { name: "Project title" }),
  ).toBeVisible();
  await expect(create).toBeEnabled();
  // A failed validation creates nothing; its message closes on its own (legacy `transient`).
  await create.click();
  const required = page
    .locator("#toast-stack")
    .getByText("Please fill all the required fields");
  await expect(required).toBeVisible();
  await expect(page).toHaveURL(/\/eoi\/new\//);
  await expect(required).toBeHidden({ timeout: 8000 });
  await page
    .getByRole("textbox", { name: "Project title" })
    .fill("Fixture E2E application");
  await page.getByRole("spinbutton", { name: "Amount" }).fill("1200");
  await create.click();
  await expect(page).toHaveURL(/\/opportunities\/eoi\/1005\/application$/);
  // Workflow shows only once every finalizable page is finalized.
  const pages = page.getByRole("navigation", { name: "Application pages" });
  const workflow = pages.getByRole("link", { name: "Workflow", exact: true });
  const finalize = page.locator("#eoi-record-finalize");
  const toggle = () => finalize.click();
  await expect(finalize).not.toBeChecked();
  await expect(workflow).toHaveCount(0);
  // Edit mode hides Finalize, Comments and Audit Trail (owner, 2026-11-02).
  await page
    .getByRole("button", { name: "Edit Application", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Project title" })
    .fill("Fixture E2E application, edited");
  await expect(finalize).toHaveCount(0);
  await expect(page.locator("#eoi-record-comments")).toHaveCount(0);
  await page.getByRole("button", { name: /^Save as draft$/i }).click();
  await expect(
    page.getByRole("button", { name: "Edit Application", exact: true }),
  ).toBeVisible();
  await toggle();
  await expect(finalize).toBeChecked();
  await expect(workflow).toHaveCount(1);
  await toggle();
  await expect(finalize).not.toBeChecked();
  await expect(workflow).toHaveCount(0);
  // Attachments: upload into the first folder, then delete it after confirming.
  await pages.getByRole("link", { name: "Attachments", exact: true }).click();
  const panel = page.locator("#eoi-attachments");
  await panel.locator('button[id$="-add"]').first().click();
  await page
    .locator('input[type="file"]')
    .last()
    .setInputFiles({
      name: "fixture-e2e.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("fixture e2e"),
    });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const file = panel.getByText("fixture-e2e", { exact: false }).first();
  await expect(file).toBeVisible();
  await file.click();
  await panel
    .getByRole("button", { name: /^Delete/ })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Yes|Delete|Confirm/ })
    .first()
    .click();
  await expect(panel.getByText("fixture-e2e", { exact: false })).toHaveCount(0);
});
test.describe("audit fixes in the browser", () => {
  // Far east of UTC, so the browser's day and the server's UTC day differ for half of every day.
  test.use({ timezoneId: "Pacific/Kiritimati" });
  test("NUMERIC shows rounded but saves as typed; a grid cell refuses ~~; delegation starts from the browser's today", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/opportunities");
    await page
      .getByRole("link", { name: /More Info:/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/opportunities\/\d+$/);
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page).toHaveURL(/\/eoi\/new\/\d+\/application$/);
    const amount = page.getByRole("spinbutton", { name: "Amount" });
    await amount.fill("12.345");
    await amount.blur();
    // DECIMAL_PLACES_COUNT is 2 in the fixtures: view-only rounding.
    await expect(amount).toHaveValue("12.35");
    // A grid cell holding the row separator is refused on Done (the optional grid section is switched on first).
    const grid = page.getByRole("switch", { name: "Budget lines" });
    // The track covers the transparent input; the click lands on the switch's label, as a user's does.
    await grid.locator("..").click();
    await expect(grid).toBeChecked();
    await page.locator('[id$="-insert"]').first().click();
    await page.getByRole("textbox", { name: "Item" }).fill("Desk~~Chair");
    await page.locator('[id$="-done"]').first().click();
    await expect(page.getByText('Remove "~~" from this value.')).toBeVisible();
    await page.getByRole("textbox", { name: "Item" }).fill("Desk");
    await page.locator('[id$="-done"]').first().click();
    await expect(page.getByText('Remove "~~" from this value.')).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "Project title" })
      .fill("Audit fixes application");
    const saved = page.waitForRequest(
      (r) => r.method() === "POST" && r.url().includes("/api/dynamic-form"),
    );
    await page.getByRole("button", { name: "Create", exact: true }).click();
    const fields = (
      (await saved).postDataJSON() as {
        answers: {
          sections: { fields: { field_id: string; value: unknown }[] }[];
        }[];
      }
    ).answers.flatMap((f) => f.sections.flatMap((s) => s.fields));
    expect(fields.find((f) => f.field_id === "3")?.value).toBe(12.345);
    expect(fields.find((f) => f.field_id === "21")?.value).toBe("Desk");
    // Delegation: the earliest start is the browser's local day, as legacy getCurrentDate().
    await page.goto("/opportunities/eoi");
    await page.getByRole("button", { name: "View EOI_1", exact: true }).click();
    await page.getByRole("link", { name: "Delegation", exact: true }).click();
    const panel = page.locator("#opportunities-eoi-delegation");
    await panel.locator('[id$="-add"]').first().click();
    const today = await page.evaluate(() =>
      new Date().toLocaleDateString("en-CA"),
    );
    await expect(page.locator('[id$="-dialog-start-native"]')).toHaveAttribute(
      "min",
      today,
    );
  });
});

test("Awards listing: drawer link, status tab, text filter, card layout and the record", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "Application Navigation Drawer" })
    .click();
  await page.getByRole("link", { name: "Awards", exact: true }).click();
  await expect(page).toHaveURL(/\/awards$/);
  const rows = page.locator("#awards-rows > li[id^='award-']");
  await expect(rows.first()).toBeVisible();
  await expect(page.locator("#awards-count")).toContainText("10 of 37");
  await page.locator("#awards-status-ia").click();
  await expect(page.locator("#awards-status-ia")).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.locator("#awards-count")).toContainText(/of 9|Total/);
  await expect(
    page.locator("[id^='award-'][id$='-status']").first(),
  ).toHaveText("Internally Approved");
  await page.locator("#awards-filter-number").fill("AW_0003");
  await page.locator("#awards-filter-number").press("Enter");
  await expect(rows).toHaveCount(1);
  await page.locator("#awards-layout-card").click();
  await expect(page.locator("#awards-layout-card")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.locator("[id^='award-'][id$='-title']").first().click();
  await expect(page).toHaveURL(/\/awards\/5002\/header$/);
  await expect(page.locator("#award-record-header")).toBeVisible();
});

test("Award record Projects: inner tabs, cost tree, the cost dialog's periods and the project dialog", async ({
  page,
}) => {
  await login(page);
  await page.goto("/awards/5000/projects");
  await expect(page.locator("#award-project-31")).toContainText("PRJ_31");
  await page.locator("#award-project-31-edit").click();
  await expect(page.locator("#award-project-name")).toHaveValue(
    "Fixture project",
  );
  await page.locator("#award-project-cancel").click();
  await page.locator("#award-projects-tab-costs").click();
  // Global split: 850 of 1,250 from the funder.
  await expect(page.locator("#award-costs-global-funder-pct")).toHaveText(
    "68.00%",
  );
  const staff = page.locator("[id^='award-cost-31-direct-staff-9']").first();
  await expect(staff).toContainText("Alex Morgan");
  await page.locator("#award-cost-31-direct-staff-9-menu-button").click();
  await page.locator("#award-cost-31-direct-staff-9-menu-edit").click();
  await expect(page.locator("#award-cost-periods-table tbody tr")).toHaveCount(
    2,
  );
  // A share above 100% is refused (legacy compared the fraction with 100).
  await page.locator("#award-cost-institution-pct").fill("150");
  await page.locator("#award-cost-institution-pct").press("Enter");
  await expect(page.locator("#award-cost-institution-pct")).toHaveValue("40");
  await page.locator("#award-cost-cancel").click();
  await page.locator("#award-projects-tab-team").click();
  await expect(page.locator("#award-team-61")).toContainText("Alex Morgan");
});
test("Guided learning: the Dashboard tour starts once, steps, closes, and a single guide runs from the menu", async ({
  page,
}) => {
  // Every guide is finished by the file's beforeEach; this journey unfinishes the Dashboard tour.
  // Init scripts run on every load: unfinish it on the first Home load only (after sign-in), so the reload below sees
  // it finished.
  await page.addInitScript(() => {
    if (
      location.pathname !== "/home" ||
      sessionStorage.getItem("guide-journey")
    )
      return;
    sessionStorage.setItem("guide-journey", "1");
    localStorage.removeItem("gn-guide:home-tour:v2");
  });
  await login(page);
  const popover = page.locator("#driver-popover-content");
  await expect(popover).toBeVisible({ timeout: 15000 });
  const progress = popover.locator(".driver-popover-progress-text");
  const first = await progress.textContent();
  await popover.getByRole("button", { name: "Next" }).click();
  await expect(progress).not.toHaveText(first ?? "");
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("gn-guide:home-tour:v2")),
    )
    .toBe("Y");
  // Finished, it does not start again on the next visit.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Example Research University" }),
  ).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(popover).toBeHidden();
  // A single guide from the header menu.
  await page.locator("#guide-menu-button").click();
  await page.locator("#guide-menu-home-toggle").click();
  await page.locator("#guide-menu-home-organization").click();
  await expect(popover).toBeVisible({ timeout: 15000 });
  await expect(popover).toContainText("Pick an organisation");
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
});

test("Claims Unit Inquiry: drawer link, status and filters, panels, the unit dialog, Clone and Export", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "Application Navigation Drawer" })
    .click();
  // Claims is a drawer group (legacy claims-group), closed until opened.
  await page.locator("#navigation-claims-group").click();
  await page.locator("#navigation-claims-unit-inquiry").click();
  await expect(page).toHaveURL(/\/claims\/unit-inquiry$/);
  const rows = page.locator("#claims-units-rows > li[id^='claims-unit-']");
  await expect(page.locator("#claims-units-count")).toContainText("25 of 30");
  // Approved funds: every third application.
  await page.locator("#claims-units-status-ia").click();
  await expect(page.locator("#claims-units-count")).toContainText("10");
  await expect(page.locator("#claims-units-clear")).toBeEnabled();
  // 76 years in a windowed list: type to filter, as a user does.
  await page.getByRole("combobox", { name: "Fiscal Year" }).fill("2027");
  await page.getByRole("option", { name: "2027", exact: true }).click();
  await expect(page.locator("#claims-units-count")).toContainText("5");
  await page.locator("#claims-units-clear").click();
  await expect(page.locator("#claims-units-count")).toContainText("25 of 30");
  await expect(page.locator("#claims-units-clear")).toBeDisabled();
  // The panels close and open with their chevron (shared Collapsible).
  const funds = page.locator("#claims-unit-6000-funds");
  await page.locator("#claims-unit-6000-funds-heading").click();
  await expect(funds).toHaveAttribute("data-open", "false");
  await page.locator("#claims-unit-6000-funds-heading").click();
  await expect(funds).toHaveAttribute("data-open", "true");
  await expect(rows.first()).toContainText("TITLE I Low Income (84.010A)");
  // Create: one fund type and grant once only.
  await page.locator("#claims-units-create").click();
  const unitDialog = page.locator("#claims-unit-dialog");
  await unitDialog.getByRole("combobox", { name: "Program Type" }).click();
  await page.getByRole("option", { name: "Schoolwide" }).click();
  for (let i = 0; i < 2; i++) {
    await unitDialog.getByRole("combobox", { name: "Fund Type" }).click();
    await page.getByRole("option", { name: "TITLE II (84.367A)" }).click();
    // TITLE II's single grant is picked by the backend's auto_select.
    await expect(
      unitDialog.getByRole("combobox", { name: "Grant" }),
    ).toHaveValue(/494102/);
    await page.locator("#claims-unit-dialog-add-fund").click();
  }
  await expect(
    page.getByText("This fund has already been added"),
  ).toBeVisible();
  await expect(page.locator("#claims-unit-dialog-funds tbody tr")).toHaveCount(
    1,
  );
  await page.locator("#claims-unit-dialog-cancel").click();
  // Clone: Goals takes its descendants; a year is required.
  await page.locator("#claims-unit-6000-clone").click();
  await page.locator("#claims-unit-clone-dialog-part-unit-goals").check();
  await expect(
    page.locator("#claims-unit-clone-dialog-part-roster"),
  ).toBeChecked();
  await page.locator("#claims-unit-clone-dialog-clone").click();
  await expect(page.locator("#claims-unit-clone-dialog-parts")).toBeVisible();
  await page.getByRole("combobox", { name: "Fiscal Year" }).last().fill("2028");
  await page.getByRole("option", { name: "2028", exact: true }).click();
  await page.locator("#claims-unit-clone-dialog-clone").click();
  await expect(
    page.getByText("Application Cloned Successfully!"),
  ).toBeVisible();
  // Export: the listing's report and one application's report.
  const [listing] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#claims-units-export").click(),
  ]);
  expect(listing.suggestedFilename()).toBe("report.pdf");
  const [one] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#claims-unit-6000-export").click(),
  ]);
  expect(one.suggestedFilename()).toBe("report.pdf");
});

test("Claims Unit record: open from the listing, panel, Fund Summary totals, sign-off lists and access", async ({
  page,
}) => {
  await login(page);
  await page.goto("/claims/unit-inquiry");
  // Legacy divClick: the card title opens the application on Summary.
  await page.locator("#claims-unit-6000-title").click();
  await expect(page).toHaveURL(/\/claims\/unit-inquiry\/6000\/summary$/);
  await expect(page.locator("#claims-unit-panel-unit")).toContainText(
    "202 - Example Research University",
  );
  await expect(page.locator("#claims-unit-panel-fiscal-year")).toContainText(
    "2027",
  );
  // Only implemented tabs show; the container has no comments.
  await expect(page.locator("#claims-unit-tabs a")).toHaveCount(4);
  await expect(page.locator("#claims-unit-comments")).toHaveCount(0);
  const funds = page.locator("#claims-unit-fund-summary-table");
  await expect(funds).toContainText("TITLE III (84.365A)");
  await expect(funds.locator("tfoot")).toContainText("28,500.00");
  await expect(page.locator("#claims-unit-preparer")).toContainText(
    "Fixture Preparer",
  );
  // Each sign-off list is read when its tab opens.
  await expect(page.locator("#claims-unit-stakeholders-table")).toContainText(
    "Lovelace",
  );
  await page.locator("#claims-unit-sign-off-tab-documents").click();
  await expect(page.locator("#claims-unit-documents-table")).toContainText(
    "Organization Chart",
  );
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#claims-unit-meetings-table")).toContainText(
    "Kick-off",
  );
  // Edit: every field is required; Save refuses an empty one and stays in edit mode, then saves and returns to view.
  await page.locator("#claims-unit-summary-edit").click();
  const board = page.locator("input#claims-unit-signed-off-board-member");
  await expect(board).toHaveValue("");
  await page.locator("#claims-unit-summary-save").click();
  await expect(
    page.locator("#claims-unit-signed-off-board-member-error"),
  ).toHaveText("Enter a value.");
  await expect(page.locator("#claims-unit-summary-save")).toBeVisible();
  await page.locator("#claims-unit-summary-cancel").click();
  await expect(page.locator("#claims-unit-summary-edit")).toBeVisible();
  await expect(board).toHaveCount(0);
  // Allocations: only a fund whose status allows a user edit (DRFT, not IA) has the button.
  await expect(page.locator("#claims-unit-fund-7001-allocations")).toHaveCount(
    0,
  );
  await page.locator("#claims-unit-fund-7000-allocations").click();
  const allocations = page.locator("#claims-unit-allocations-table");
  await expect(allocations.locator("tbody tr")).toHaveCount(1);
  await expect(allocations).toContainText("Original");
  await page.locator("#claims-unit-allocations-add-new").click();
  await page.getByRole("combobox", { name: "Allocation Type" }).click();
  await page.getByRole("option", { name: "20th Day Adjustment" }).click();
  await page.locator("#claims-unit-allocations-amount").fill("250");
  await page.locator("#claims-unit-allocations-add").click();
  await expect(
    page.getByText("Allocation created successfully!"),
  ).toBeVisible();
  await expect(page.locator("#claims-unit-allocations-form")).toHaveCount(0);
  await expect(allocations.locator("tbody tr")).toHaveCount(2);
  await expect(allocations).toContainText("250.00");
  // Row edit in place, then delete; both read the list again.
  await page.locator("#claims-unit-allocations-row-8001-edit").click();
  await page.locator("#claims-unit-allocations-row-8001-amount").fill("300");
  await page.locator("#claims-unit-allocations-row-8001-save").click();
  await expect(
    page.getByText("Allocation updated successfully!"),
  ).toBeVisible();
  await expect(allocations).toContainText("300.00");
  await page.locator("#claims-unit-allocations-row-8001-delete").click();
  await expect(allocations.locator("tbody tr")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(allocations).toHaveCount(0);
  // Goals: the first fund's goals; a linked goal has no Delete; add one, then delete it.
  await page.locator("#claims-unit-tab-goals").click();
  await expect(page).toHaveURL(/\/claims\/unit-inquiry\/6000\/goals$/);
  const goals = page.locator("#claims-unit-goals-table");
  await expect(goals).toContainText("Raise attainment");
  await expect(page.locator("#claims-unit-goals-row-9000-delete")).toHaveCount(
    0,
  );
  await page.locator("#claims-unit-goals-add").click();
  await page.locator("#claims-unit-goal-dialog-fund-goal-trigger").click();
  await page.getByRole("option", { name: "3 - USER" }).click();
  await page
    .locator("#claims-unit-goal-dialog-description")
    .fill("Fixture goal");
  await page.locator("#claims-unit-goal-dialog-save").click();
  await expect(goals).toContainText("Fixture goal");
  await page.locator("#claims-unit-goals-row-9001-delete").click();
  await expect(goals).not.toContainText("Fixture goal");
  // Activities: the fund's summary, the Fund Summary totals, then the list; only a draft activity can be deleted.
  await page.locator("#claims-unit-tab-activities").click();
  await expect(page).toHaveURL(/\/claims\/unit-inquiry\/6000\/activities$/);
  await expect(
    page.locator("#claims-unit-activities-fund-status"),
  ).toContainText("Original Pending");
  await expect(
    page.locator("#claims-unit-activities-fund-summary-table"),
  ).toContainText("Instruction");
  await page
    .locator("#claims-unit-activities-tabs-tab-activities-list")
    .click();
  const activities = page.locator("#claims-unit-activities-list-table");
  await expect(activities).toContainText("Reading teacher");
  await expect(
    page.locator("#claims-unit-activities-list-row-5101-delete"),
  ).toHaveCount(0);
  // View: the details tab with the goals, the position's benefit line and the claimable periods.
  await page.locator("#claims-unit-activities-list-row-5100-view").click();
  await expect(page.locator("#claims-unit-activity-goals")).toContainText(
    "Raise attainment",
  );
  await page.locator("#claims-unit-activity-tabs-tab-position-details").click();
  await expect(
    page.locator("#claims-unit-activity-benefits-table"),
  ).toContainText("FICA");
  await page
    .locator("#claims-unit-activity-tabs-tab-claimable-amount-details")
    .click();
  await expect(
    page.locator("#claims-unit-activity-claimable-salary-table"),
  ).toContainText("30,000");
  await page
    .locator("#claims-unit-activities-tabs-tab-activities-list")
    .click();
  await page.locator("#claims-unit-activities-list-row-5100-delete").click();
  await expect(activities).not.toContainText("Reading teacher");
  // Attachments: the shared panel on the application.
  await page.locator("#claims-unit-tab-attachments").click();
  await expect(page.locator("#claims-unit-attachments")).toBeVisible();
  // Summary read N: legacy's refusal and back to the listing.
  await page.goto("/claims/unit-inquiry/6001/summary");
  await expect(page).toHaveURL(/\/claims\/unit-inquiry$/);
});

test("Claims Funds Inquiry: listing, Summary dialog, the record's tabs, filters in the URL, Export and access", async ({
  page,
}) => {
  await login(page);
  await page.goto("/claims/funds-inquiry");
  await expect(page.locator("#claims-funds-count")).toContainText("25 of 30");
  await page.locator("#claims-fund-7001-view").click();
  const dialog = page.locator("#claims-fund-summary-dialog");
  await expect(dialog.locator("tbody tr")).toHaveCount(3);
  // The backend sends 63.92 (a percentage): it reads 63.92%, not 6,392%.
  await expect(dialog).toContainText("63.92%");
  await page.keyboard.press("Escape");
  await page.locator("#claims-fund-7001-title").click();
  await expect(page).toHaveURL(/\/claims\/funds-inquiry\/7001\/summary$/);
  await expect(page.locator("#claims-fund-summary tbody tr")).toHaveCount(3);
  await expect(page.locator("#claims-fund-filters")).toHaveCount(0);
  // Budget opens on the lists' first codes (Instruction, Salaries).
  await page.locator("#claims-fund-tab-budget").click();
  await expect(page.locator("#claims-fund-budget")).toContainText("£10,000.00");
  await page.getByRole("combobox", { name: "Object" }).click();
  await page.getByRole("option", { name: "Employee Benefits" }).click();
  await expect(page).toHaveURL(/object=200/);
  await expect(page.locator("#claims-fund-budget")).toContainText("£22.90");
  // The filter travels with the tab links.
  await expect(page.locator("#claims-fund-tab-claims")).toHaveAttribute(
    "href",
    /object=200/,
  );
  await page.getByRole("combobox", { name: "Object" }).click();
  await page.getByRole("option", { name: "Salaries" }).click();
  await page.locator("#claims-fund-tab-claims").click();
  await expect(page.locator("#claims-fund-claims tbody tr")).toHaveCount(4);
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "In Process" }).click();
  await expect(page).toHaveURL(/status=IN-PROCESS/);
  await expect(page.locator("#claims-fund-claims")).toContainText(
    "No data to display",
  );
  const [report] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#claims-fund-export").click(),
  ]);
  expect(report.suggestedFilename()).toBe("report.pdf");
  // No report for Attachments, and no filter bar.
  await page.locator("#claims-fund-tab-attachments").click();
  await expect(page.locator("#claims-fund-export")).toHaveCount(0);
  await expect(page.locator("#claims-fund-filters")).toHaveCount(0);
  // Summary read N: the fund is refused and the user goes back to the listing.
  await page.goto("/claims/funds-inquiry/7002/summary");
  await expect(page).toHaveURL(/\/claims\/funds-inquiry$/);
});

test("Opportunities: Shared tab comments, the deadline warning and a narrow screen", async ({
  page,
}) => {
  await login(page);
  await page.goto("/opportunities");
  // OPP_DEADLINE_WARNING_DAYS 7: opportunity 3 closes in three days, so Apply asks first; Cancel stays put.
  await page.locator("#opportunity-3-apply").click();
  const warning = page.locator("#opportunity-3-deadline");
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("Closing Date");
  await page.locator("#opportunity-3-deadline-cancel").click();
  await expect(warning).toHaveCount(0);
  await expect(page).toHaveURL(/\/opportunities(\?.*)?$/);
  // Shared with me: the comments button carries the count; the dialog shows the one share comment.
  await page.getByRole("tab", { name: "Shared", exact: true }).click();
  await expect(page.locator(".opportunity-card")).toHaveCount(2);
  await expect(page.locator("#opportunity-1-comments")).toContainText("1");
  await page.locator("#opportunity-1-comments").click();
  const comments = page.getByRole("dialog");
  await expect(comments).toContainText("Worth a look for the lab.");
  await expect(comments).toContainText("Fixture Colleague");
  await page.keyboard.press("Escape");
  await expect(comments).toHaveCount(0);
  await page.locator("#opportunity-2-comments").click();
  await expect(page.locator("[id$='-empty']").last()).toBeVisible();
  await page.keyboard.press("Escape");
  // Narrow screen: the cards still fit the viewport (no sideways scroll).
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".opportunity-card").first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("header: Help opens Tutorials, the bell lists notifications and closes on Escape", async ({
  page,
}) => {
  await login(page);
  await page.goto("/home");
  // Legacy globalHeadersData: one Help item that navigates to Tutorials.
  await expect(page.locator("#shell-help")).toHaveAttribute(
    "href",
    "/modules/tutorials",
  );
  await page.locator("#notifications-button").click();
  const panel = page.locator("#notifications-panel");
  await expect(panel).toBeVisible();
  await expect(panel.locator("[id^='notification-']").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.locator("#notifications-button")).toBeFocused();
});
