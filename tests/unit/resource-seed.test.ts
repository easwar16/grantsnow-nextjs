import { expect, it } from "vitest";
import {
  label,
  mergeResourceDefaults,
  resourceDescription,
  resourcePreference,
  resourceVisible,
} from "@/server/platform/configuration/resources";

// A seed row (legacy strings.js) with a description, a required flag and preferences.
const KEY = {
  module_name: "EXTENSION_PROPOSAL",
  label_type: "warning-messages",
  label_name: "dynamic-less-than",
} as const;
const find = (rows: ReturnType<typeof mergeResourceDefaults>) =>
  rows.find(
    (r) =>
      r.module_name === KEY.module_name &&
      r.label_type === KEY.label_type &&
      r.label_name === KEY.label_name,
  );

it("renders from the legacy seed alone when the backend sends nothing (every legacy bundle)", () => {
  const rows = mergeResourceDefaults([]);
  for (const bundle of [
    "dashboard",
    "proposal",
    "opportunities-eoi",
    "contract",
    "ethics",
    "award",
    "due_diligence",
    "claims",
  ])
    expect(rows.some((r) => r.module_name.toLowerCase() === bundle)).toBe(true);
  expect(
    label(rows, "extension_proposal", KEY.label_type, KEY.label_name, "x"),
  ).toBe("The length should be less than {num} characters!");
  expect(
    resourcePreference(
      rows,
      "extension_proposal",
      KEY.label_type,
      KEY.label_name,
      "maxLength",
    ),
  ).toBe(4500);
});
it("lays a backend row over its seed field by field, as legacy's lodash merge does", () => {
  // The backend renames the label and hides it, but sends no description, flag or preferences.
  const row = find(
    mergeResourceDefaults([
      {
        ...KEY,
        label_value: "Too long",
        is_visible: "N",
        label_description: "",
      },
    ]),
  );
  expect(row).toMatchObject({
    label_value: "Too long",
    is_visible: "N",
    is_mandatory: "Y",
    preferences: { maxLength: "4500" },
  });
  // An empty description keeps the seed's More Info text.
  expect(row?.label_description).toContain("would be replaced dynamically");
});
it("lets the backend's own values win, a null label falling to the use site's literal", () => {
  const rows = mergeResourceDefaults([
    {
      ...KEY,
      label_value: null,
      is_visible: "Y",
      preferences: '{"maxLength": 40}',
    },
  ]);
  expect(
    label(
      rows,
      "extension_proposal",
      KEY.label_type,
      KEY.label_name,
      "Literal",
    ),
  ).toBe("Literal");
  expect(
    resourceVisible(rows, "extension_proposal", KEY.label_type, KEY.label_name),
  ).toBe(true);
  expect(
    resourcePreference(
      rows,
      "extension_proposal",
      KEY.label_type,
      KEY.label_name,
      "maxLength",
    ),
  ).toBe(40);
  expect(
    resourceDescription(
      rows,
      "extension_proposal",
      KEY.label_type,
      KEY.label_name,
    ),
  ).not.toBeNull();
});
it("keeps a key the backend does not know hidden unless the seed says 'Y'", () => {
  const rows = mergeResourceDefaults([]);
  expect(resourceVisible(rows, "dashboard", "button-labels", "more_info")).toBe(
    false,
  );
  expect(resourceVisible(rows, "dashboard", "labels", "no-such-key")).toBe(
    false,
  );
});
