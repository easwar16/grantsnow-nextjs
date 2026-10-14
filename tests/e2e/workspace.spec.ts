import { test, expect } from "@playwright/test";
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
    page.getByRole("heading", { name: "Contract deadlines" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Insights", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Organization", exact: true })
    .selectOption("203");
  await page.getByLabel("Year", { exact: true }).fill("2026");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
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
  await widget
    .getByRole("button", { name: "Refresh Proposals Approaching Deadlines" })
    .click();
  await expect(widget.getByText("Isolated test failure")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Contracts awaiting approval" }),
  ).toBeVisible();
  fail = false;
  await widget.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(widget.getByText("Isolated test failure")).toHaveCount(0);
  await widget.getByRole("tab", { name: "Calendar View", exact: true }).click();
  await expect(widget.locator(".calendar-grid")).toBeVisible();
  await widget.getByRole("button", { name: "Previous calendar month" }).click();
  await expect(widget.locator(".calendar-grid")).toBeVisible();
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
test("listing search, filter, reset, paging, back, reload, masked values", async ({
  page,
}) => {
  await login(page);
  await navigateProposals(page);
  await expect(
    page.locator(".listing-count").filter({ hasText: "10 of 37" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await expect(page.locator(".proposal-card")).toHaveCount(10);
  await page.reload();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.getByLabel("Search proposal titles").fill("Climate");
  await page.getByLabel("Search proposal titles").press("Enter");
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
  await page.getByLabel("Reference", { exact: true }).fill("NO-MATCH");
  await page.getByLabel("Reference", { exact: true }).press("Enter");
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
  await page.getByLabel("Search proposal titles").fill("Climate");
  await page.getByLabel("Search proposal titles").press("Enter");
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
  await page.getByLabel("Search proposal titles").fill("Digital");
  await page.getByLabel("Search proposal titles").press("Enter");
  await page.waitForRequest(
    (r) => r.url().includes("/api/proposals?") && r.url().includes("Digital"),
  );
  await page.getByLabel("Search proposal titles").fill("Sustainable");
  await page.getByLabel("Search proposal titles").press("Enter");
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
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByRole("button", { name: /^Filters/ }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("radio", { name: "Outline Proposal", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search proposal titles").fill("health");
  await page.getByLabel("Search proposal titles").press("Enter");
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
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.locator(".user-menu summary").click();
  await page.getByRole("menuitem", { name: "Manage profile" }).click();
  await page.getByRole("button", { name: "Extend session" }).click();
  await expect(page.getByText("Session extended.")).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
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
    page.getByRole("heading", { name: "Summary", exact: true }),
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
  await page.getByLabel("Search proposal titles").fill("Climate");
  await page.getByLabel("Search proposal titles").press("Enter");
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
  const after = await page
    .locator("main")
    .evaluate((e) => e.getBoundingClientRect().x);
  expect(after - before).toBe(241);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Application navigation" }),
  ).not.toBeVisible();
  await page.locator(".user-menu summary").click();
  await expect(
    page.getByRole("menuitem", { name: "Manage profile" }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "Preferences" }).click();
  await expect(
    page.getByRole("dialog", { name: "User Preferences" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".app")).toHaveClass(/dark/);
  await page.locator(".user-menu summary").click();
  await page.getByRole("menuitem", { name: "Preferences" }).click();
  await page.getByRole("radio", { name: "Organisation default" }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".app")).not.toHaveClass(/dark/);
  await page.goto("/opportunities");
  await expect(
    page.getByRole("heading", { name: "Funding opportunities", exact: true }),
  ).toHaveCount(1);
  await expect(page.locator(".opportunity-card")).toHaveCount(25);
  await expect(page.locator(".listing-count")).toHaveText("25 of 58");
  await page.getByRole("tab", { name: "Bookmarked", exact: true }).click();
  await expect(page.locator(".listing-count")).toHaveText("25 of 29");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".opportunity-card")).toHaveCount(4);
  await page
    .getByRole("button", { name: /More information:/ })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Opportunity information" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close opportunity information" })
    .click();
  await page.goto("/opportunities/eoi");
  await expect(page.locator(".proposal-card")).toHaveCount(25);
  await page.getByRole("link", { name: "EOI_1", exact: true }).click();
  await expect(page.getByText("Synthetic opportunity summary.")).toBeVisible();
  await page.getByRole("link", { name: "Application", exact: true }).click();
  await expect(page.getByText("Synthetic research project")).toBeVisible();
  for (const tab of [
    "Attachments",
    "Approvals",
    "Delegation",
    "History",
    "Dynamic Form 1",
    "Dynamic Form 2",
    "Dynamic Form 3",
    "Dynamic Form 4",
    "Dynamic Form 5",
  ]) {
    await page.getByRole("link", { name: tab, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: tab, exact: true }),
    ).toBeVisible();
  }
  await page.goto("/opportunities/analytics");
  await expect(
    page.getByRole("heading", { name: "Top Funders", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".funding-pie")).toBeVisible();
});
