import { describe, expect, it } from "vitest";
import {
  attributeErrors,
  attributeOptions,
  attributePick,
  type AttributeField,
} from "@/features/record/attributes/model";
import {
  applyEdit,
  editedColumn,
  withEdits,
  type FxRate,
} from "@/features/record/fx-rates/model";
const field = (over: Partial<AttributeField>): AttributeField => ({
  fieldId: 1,
  name: "attribute_1",
  description: "Attribute 1",
  fieldType: "TEXTBOX",
  isVisible: "Y",
  isRequired: "N",
  readOnly: false,
  ...over,
});
describe("object attributes model", () => {
  const code = field({
    name: "attribute_3",
    isRequired: "Y",
    regexValidation: "[A-Z]{2}\\d{3}",
    regexDesc: "Like AB123",
  });
  const fixed = field({ name: "attribute_7", isRequired: "Y", readOnly: true });
  it("checks required, then the regex, only on editable fields", () => {
    expect(attributeErrors([code, fixed], {}, true)).toEqual({
      attribute_3: "Enter a value.",
    });
    expect(attributeErrors([code], { attribute_3: "ab12" }, true)).toEqual({
      attribute_3: "Like AB123",
    });
    expect(attributeErrors([code], { attribute_3: "AB123" }, true)).toEqual({});
    // View mode saves nothing, so nothing blocks.
    expect(attributeErrors([code], {}, false)).toEqual({});
  });
  it("filters a dependent LOV by its parent attribute's value", () => {
    const child = field({
      name: "attribute_2",
      fieldType: "LOV",
      parent_header_attr: "attribute_1",
      options: [
        { optionId: "SP1", optionValue: "SP1", parent_lkp_code: "P1" },
        { optionId: "SP3", optionValue: "SP3", parent_lkp_code: "P2,P3" },
      ],
    });
    expect(
      attributeOptions(child, { attribute_1: "P3" }).map((o) => o.optionId),
    ).toEqual(["SP3"]);
    expect(attributeOptions(child, {})).toEqual([]);
  });
  it("picks only the shown fields' values for the host's save", () => {
    expect(
      attributePick([code], { attribute_3: "AB123", attribute_9: "stray" }),
    ).toEqual({ attribute_3: "AB123" });
    expect(attributePick([code], {})).toEqual({ attribute_3: null });
  });
});
describe("FX rates model", () => {
  const usd: FxRate = {
    rateId: 1,
    currency: "USD",
    name: "US Dollars",
    cost: 1.34,
    price: 1.3,
    defaultCost: null,
    defaultPrice: 1.3,
    status: "OVERRIDDEN",
  };
  it("PURCHASE edits the cost rate, INCOME the price rate (legacy PURCHASE/INCOME split)", () => {
    expect(editedColumn("PURCHASE")).toBe("cost");
    expect(editedColumn("INCOME")).toBe("price");
    expect(
      applyEdit(usd, { currency: "USD", reset: false, rate: 2 }, "INCOME"),
    ).toMatchObject({ cost: 1.34, price: 2, status: "OVERRIDDEN" });
  });
  it("RESET restores both defaults (1 when none); a later rate sits on top", () => {
    expect(
      applyEdit(usd, { currency: "USD", reset: true }, "PURCHASE"),
    ).toEqual({ ...usd, cost: 1, price: 1.3, status: "ADMIN_DEFAULT" });
    expect(
      applyEdit(usd, { currency: "USD", reset: true, rate: 5 }, "PURCHASE"),
    ).toMatchObject({ cost: 5, price: 1.3, status: "OVERRIDDEN" });
  });
  it("leaves rows without an edit untouched", () => {
    expect(withEdits([usd], {}, "PURCHASE")).toEqual([usd]);
  });
});
