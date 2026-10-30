import { expect, it } from "vitest";
import { legacyDeepLink } from "@/shared/auth/legacy-link";
it.each([
  [
    "?mode=view&proposal_id=4795&proposal_type=PROPOSAL&page=shell&shell=proposals&proposals=proposals-info-start",
    "/proposals/PROPOSAL/4795",
  ],
  [
    "?proposal_id=12&proposal_type=SUB_PROPOSAL&page=shell&shell=proposals&proposals=proposals-info-start",
    "/proposals/SUB_PROPOSAL/12",
  ],
  ["?page=shell&shell=proposals&proposals=proposals-start", "/proposals"],
  [
    "?doc_num=EOI-1&opportunities_id=9&request_id=321&page=shell&shell=opportunities&opportunities=opportunities-eoi",
    "/opportunities/eoi/321/summary",
  ],
  [
    "?page=shell&shell=opportunities&opportunities=opportunities-finder",
    "/opportunities",
  ],
  [
    "?page=shell&shell=opportunities&opportunities=opportunities-eoi-list",
    "/opportunities/eoi",
  ],
  ["?page=shell&shell=home&home=home-start", "/home"],
  [
    "?access_type=EA_ACCESS&setup_flow_id=1694&page=shell&shell=ethics&ethics=ethics-detail",
    "/modules/ethics",
  ],
  [
    "?page=shell&shell=claims&claims=claims-unit-inquiry-info",
    "/claims/unit-inquiry",
  ],
  ["?page=shell&shell=tutorials&tutorials=x", "/modules/tutorials"],
  ["?page=shell", "/home"],
])("routes %s", (search, target) =>
  expect(legacyDeepLink(search)).toBe(target),
);
it("repairs the backend's `=`-for-`&` shape before routing", () => {
  expect(
    legacyDeepLink(
      "?contract_id=1207=view=shell=contracts=contracts-new-contract",
    ),
  ).toBe("/contracts/1207");
  expect(
    legacyDeepLink("?request_id=55=view=shell=opportunities=opportunities-eoi"),
  ).toBe("/opportunities/eoi/55/summary");
});
it.each([
  "?mode=view&proposal_id=0&proposal_type=PROPOSAL&page=shell&shell=proposals&proposals=proposals-info-start",
  "?mode=view&proposal_id=12a&proposal_type=PROPOSAL&page=shell&shell=proposals&proposals=proposals-info-start",
  "?mode=view&proposal_id=4795&proposal_type=ETHICS&page=shell&shell=proposals&proposals=proposals-info-start",
  "?mode=view&proposal_id=4795&proposal_type=../x&page=shell&shell=proposals&proposals=proposals-info-start",
])("falls back to the listing for an invalid proposal identity %s", (search) =>
  expect(legacyDeepLink(search)).toBe("/proposals"),
);
it("falls back to the finder for a non-numeric EOI id", () =>
  expect(
    legacyDeepLink(
      "?request_id=1e3&page=shell&shell=opportunities&opportunities=opportunities-eoi",
    ),
  ).toBe("/opportunities"));
it.each(["", "?", "?page=home", "?returnTo=/home", "?a=b=c"])(
  "ignores the non-legacy query %j",
  (search) => expect(legacyDeepLink(search)).toBeNull(),
);
