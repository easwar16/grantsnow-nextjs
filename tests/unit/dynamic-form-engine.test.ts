import { describe, expect, it } from "vitest";
import {
  acceptOf,
  decodeEntities,
  fieldError,
  fieldSpan,
  fieldWidth,
  fileIdOf,
  fileNameOf,
  fileNameTaken,
  fileProblem,
  fileValue,
  gridColumns,
  gridRows,
  matches,
  maxMbOf,
  newGridRow,
  optionsFor,
  patternError,
  readResponses,
  resolve,
  roundTo,
  sectionWidth,
  startsEnabled,
  toFieldValue,
  toPayload,
  withDependentConditions,
} from "@/features/record/dynamic-form/engine";
import type {
  DynField,
  DynForm,
  DynSection,
} from "@/features/record/dynamic-form/models";
// Port of GN-Angular dynamic-form.engine.spec.ts and dyn-field.spec.ts, plus the validation rules.
const field = (fieldId: number, patch: Partial<DynField> = {}): DynField => ({
  fieldId,
  description: `F${fieldId}`,
  fieldType: "TEXTBOX",
  isRequired: "N",
  isVisible: "Y",
  ...patch,
});
const section = (
  sectionId: number,
  fields: DynField[],
  patch: Partial<DynSection> = {},
): DynSection => ({
  sectionId,
  sectionName: `S${sectionId}`,
  sectionType: "FORM",
  isVisible: "Y",
  isMandatory: "N",
  fields,
  ...patch,
});
const visibleIf = (parent: number, ...ids: number[]) => [
  {
    attribute: "isVisible" as const,
    conditionOperator: "IN" as const,
    formId: 1,
    sectionId: 10,
    fieldId: parent,
    optionId: ids,
  },
];
describe("matches", () => {
  it("compares option ids numerically, list-aware, and treats empty as no match", () => {
    expect(matches("IN", ["5"], 5)).toBe(true);
    expect(matches("IN", [5], ["3", "5"])).toBe(true);
    expect(matches("IN", [5], "")).toBe(false);
    expect(matches("NOT IN", [5], null)).toBe(true);
    expect(matches("NOT IN", [5], "5")).toBe(false);
  });
});
describe("toFieldValue", () => {
  it("types stored answers and falls back to the default", () => {
    expect(toFieldValue(field(1, { fieldType: "NUMERIC" }), "12.5")).toBe(12.5);
    expect(toFieldValue(field(1, { fieldType: "CHECKLIST" }), "3~~4")).toEqual([
      "3",
      "4",
    ]);
    expect(
      toFieldValue(
        field(1, { fieldType: "CHECKBOX", defaultValue: "7" }),
        null,
      ),
    ).toEqual(["7"]);
    expect(
      toFieldValue(field(1, { fieldType: "COMBOBOXMANY" }), [1, "2"]),
    ).toEqual(["1", "2"]);
    expect(
      toFieldValue(field(1, { fieldType: "DATE" }), "2026-01-05T00:00:00Z"),
    ).toBe("2026-01-05");
    expect(toFieldValue(field(1, { fieldType: "NUMERIC" }), "")).toBeNull();
    expect(toFieldValue(field(1, { fieldType: "NUMERIC" }), "abc")).toBeNull();
    expect(toFieldValue(field(1, { fieldType: "CHECKBOX" }), null)).toEqual([]);
    expect(toFieldValue(field(1, { defaultValue: "x" }), "")).toBe("x");
  });
});
describe("withDependentConditions", () => {
  it("turns an option's dependent_fields into a visibility rule on the child, without mutating the input", () => {
    const parent = field(1, {
      fieldType: "RADIO",
      options: [
        { optionId: "5", optionValue: "Yes", dependent_fields: "2" },
        { optionId: "6", optionValue: "Maybe", dependent_fields: "2" },
      ],
    });
    const forms: DynForm[] = [
      {
        formId: 1,
        sections: [section(10, [parent, field(2, { isVisible: "C" })])],
      },
    ];
    const out = withDependentConditions(forms);
    expect(out[0].sections[0].fields[1].conditions).toEqual([
      {
        attribute: "isVisible",
        conditionOperator: "IN",
        formId: 1,
        sectionId: 10,
        fieldId: 1,
        optionId: [5, 6],
      },
    ]);
    expect(forms[0].sections[0].fields[1].conditions).toBeUndefined();
  });
  it("merges derived ids into an authored rule on the same parent", () => {
    const parent = field(1, {
      options: [{ optionId: 6, optionValue: "B", dependent_fields: "2" }],
    });
    const forms: DynForm[] = [
      {
        formId: 1,
        sections: [
          section(10, [
            parent,
            field(2, { isVisible: "C", conditions: visibleIf(1, 5) }),
          ]),
        ],
      },
    ];
    expect(
      withDependentConditions(forms)[0].sections[0].fields[1].conditions?.[0]
        .optionId,
    ).toEqual([5, 6]);
  });
});
describe("resolve", () => {
  const forms: DynForm[] = [
    {
      formId: 1,
      sections: [
        section(10, [
          field(1, { fieldType: "RADIO" }),
          field(2, {
            isVisible: "C",
            isRequired: "Y",
            conditions: visibleIf(1, 5),
          }),
          field(3, { isVisible: "C", conditions: visibleIf(2, 9) }),
        ]),
      ],
    },
  ];
  it("hides a child whose parent answer does not match, cascading, and does not require it", () => {
    const r = resolve(
      forms,
      (_f, _s, x) => ({ 1: "6", 2: "9" })[String(x) as "1" | "2"] ?? null,
    );
    expect([...r.hiddenFields].sort()).toEqual(["1/10/2", "1/10/3"]);
    expect(r.required.has("1/10/2")).toBe(false);
  });
  it("shows and requires it once the parent matches", () => {
    const r = resolve(
      forms,
      (_f, _s, x) => ({ 1: "5", 2: "9" })[String(x) as "1" | "2"] ?? null,
    );
    expect(r.hiddenFields.size).toBe(0);
    expect(r.required.has("1/10/2")).toBe(true);
  });
  it("treats 'C' without a condition as shown, 'N' as hidden, and an isRequired condition", () => {
    const r = resolve(
      [
        {
          formId: 1,
          sections: [
            section(10, [
              field(1),
              field(2, { isVisible: "C" }),
              field(3, { isVisible: "N" }),
              field(4, {
                conditions: [
                  { ...visibleIf(1, 7)[0], attribute: "isRequired" },
                ],
              }),
            ]),
            section(11, [], { isVisible: "C", conditions: visibleIf(1, 8) }),
          ],
        },
      ],
      () => "7",
    );
    expect([...r.hiddenFields]).toEqual(["1/10/3"]);
    expect([...r.hiddenSections]).toEqual(["1/11"]);
    expect(r.required.has("1/10/4")).toBe(true);
  });
  it("stops after a bounded number of passes on a cycle", () => {
    const cyclic: DynForm[] = [
      {
        formId: 1,
        sections: [
          section(10, [
            field(1, { isVisible: "C", conditions: visibleIf(2, 1) }),
            field(2, {
              isVisible: "C",
              conditions: [
                { ...visibleIf(1, 1)[0], conditionOperator: "NOT IN" },
              ],
            }),
          ]),
        ],
      },
    ];
    expect(() => resolve(cyclic, () => "1")).not.toThrow();
  });
});
describe("optionsFor (dependent LOV)", () => {
  const lov = (patch: Partial<DynField> = {}): DynField =>
    field(2, {
      fieldType: "LOV",
      options: [
        { optionId: 1, optionValue: "Leeds", parent_lkp_code: "10" },
        { optionId: 2, optionValue: "Paris", parent_lkp_code: "20, 30" },
      ],
      ...patch,
    });
  it("lists every option of an independent LOV", () => {
    expect(optionsFor(lov(), null)).toHaveLength(2);
  });
  it("lists nothing until the parent has a value, then only its children", () => {
    expect(optionsFor(lov({ parent_header_attr: 1 }), null)).toEqual([]);
    expect(
      optionsFor(lov({ parent_header_attr: 1 }), "30").map(
        (o) => o.optionValue,
      ),
    ).toEqual(["Paris"]);
  });
});
describe("validation", () => {
  it("requires a value with JET's message, and tests a pattern on the whole value", () => {
    expect(fieldError(field(1), null, true)).toBe("Enter a value.");
    expect(fieldError(field(1), "  ", true)).toBe("Enter a value.");
    expect(fieldError(field(1, { fieldType: "CHECKBOX" }), [], true)).toBe(
      "Enter a value.",
    );
    const code = field(1, { regexValidation: "[A-Z]{3}-\\d{3}" });
    expect(patternError(code, "ABC-123")).toBeNull();
    expect(patternError(code, "xABC-123")).toBe(
      "Enter value in '[A-Z]{3}-\\d{3}' format",
    );
    expect(patternError({ ...code, regexDesc: "Three capitals" }, "no")).toBe(
      "Three capitals",
    );
    expect(fieldError(code, null, false)).toBeNull();
  });
  it("tests rich text as stored HTML and ignores a broken regex", () => {
    const rich = field(1, {
      fieldType: "RICHTEXTEDITOR",
      regexValidation: "[\\s\\S]{0,10}",
    });
    expect(patternError(rich, "<p>abc</p>")).toBeNull();
    expect(patternError(rich, "<p>abcd</p>")).toBe(
      "Enter value in '[\\s\\S]{0,10}' format",
    );
    expect(patternError(field(1, { regexValidation: "(" }), "x")).toBeNull();
  });
  it("rounds numbers to the configured decimals", () => {
    expect(roundTo(12.345, 2)).toBe(12.35);
    expect(roundTo(12.3, 0)).toBe(12);
  });
});
describe("toPayload", () => {
  const forms: DynForm[] = [
    {
      formId: 1,
      sections: [
        section(10, [
          field(1, { fieldType: "RADIO" }),
          field(2, {
            fieldType: "CHECKLIST",
            isVisible: "C",
            conditions: visibleIf(1, 5),
          }),
        ]),
        section(11, [field(3)]),
        section(12, [field(4)], { sectionType: "GRID" }),
      ],
    },
    { formId: 2, sections: [section(20, [field(5)])] },
  ];
  it("sends enabled sections with string ids, clears hidden answers, joins grid rows and drops empty forms", () => {
    const resolution = resolve(forms, (_f, _s, x) =>
      String(x) === "1" ? "6" : null,
    );
    const payload = toPayload(forms, {
      enabled: (f, s) => f === 1 && s !== 11,
      valueOf: (_f, _s, x) =>
        (({ 1: "6", 2: ["8"] }) as Record<string, string | string[]>)[
          String(x)
        ] ?? null,
      rowsOf: (_f, s) => (s === 12 ? [{ "4": "a" }, { "4": "b" }] : []),
      resolution,
    });
    expect(payload).toEqual([
      {
        form_id: "1",
        sections: [
          {
            section_id: "10",
            fields: [
              { field_id: "1", value: "6" },
              { field_id: "2", value: [] },
            ],
          },
          { section_id: "12", fields: [{ field_id: "4", value: "a~~b" }] },
        ],
      },
    ]);
  });
});
describe("layout and loading helpers", () => {
  it("spans columns from twelfths", () => {
    expect(fieldSpan(12, 2)).toBe(2);
    expect(fieldSpan(6, 2)).toBe(1);
    expect(fieldSpan(6, null)).toBe(1);
    expect(fieldSpan(4, 3)).toBe(1);
    expect(fieldSpan(null, 4)).toBe(4);
    expect(fieldWidth(6, 2)).toBe("calc(50% - 16px)");
    expect(sectionWidth(6)).toBe("50%");
    expect(sectionWidth(null)).toBe("100%");
  });
  it("starts a section on when answered or mandatory", () => {
    const s = section(10, []);
    expect(startsEnabled(s, { "1": "" })).toBe(false);
    expect(startsEnabled(s, { "1": false })).toBe(false);
    expect(startsEnabled(s, { "1": "x" })).toBe(true);
    expect(startsEnabled(s, { "1": 0 })).toBe(true);
    expect(startsEnabled({ ...s, isMandatory: "Y" }, undefined)).toBe(true);
  });
  it("reads responses by form, section and field", () => {
    expect(
      readResponses([
        {
          form_id: 1,
          sections: [{ section_id: 10, fields: [{ field_id: 2, value: "x" }] }],
        },
      ]),
    ).toEqual({ "1": { "10": { "2": "x" } } });
  });
  it("decodes entity-encoded helper text without a DOM", () => {
    expect(decodeEntities("&lt;p&gt;Award type&lt;&#x2F;p&gt;")).toBe(
      "<p>Award type</p>",
    );
    expect(decodeEntities("It&#39;s &amp; &unknown;")).toBe("It's & &unknown;");
    expect(decodeEntities(null)).toBe("");
  });
});
describe("grids", () => {
  const grid = section(
    20,
    [field(1, { fieldType: "TEXTBOX" }), field(2, { fieldType: "NUMERIC" })],
    { sectionType: "GRID" },
  );
  it("reads `~~` columns into rows by field id, keeping an empty number empty", () => {
    expect(gridRows(grid, { "1": "a~~b", "2": "5~~" })).toEqual([
      { "1": "a", "2": 5 },
      { "1": "b", "2": null },
    ]);
    expect(gridRows(grid, undefined)).toEqual([]);
  });
  it("writes rows back as columns, and clears the table when no rows are left", () => {
    expect(
      gridColumns(grid, [
        { "1": "a", "2": 5 },
        { "1": "b", "2": null },
      ]),
    ).toEqual([
      { field_id: "1", value: "a~~b" },
      { field_id: "2", value: "5~~" },
    ]);
    expect(gridColumns(grid, [])).toEqual([
      { field_id: "1", value: null },
      { field_id: "2", value: null },
    ]);
  });
  it("starts a new row from the column defaults", () => {
    expect(
      newGridRow(
        section(20, [
          field(1, { defaultValue: "x" }),
          field(2, { fieldType: "NUMERIC", defaultValue: "3" }),
        ]),
      ),
    ).toEqual({ "1": "x", "2": 3 });
  });
});
describe("files", () => {
  it("splits and builds `name~~id` values", () => {
    expect(fileNameOf("cv.pdf~~42")).toBe("cv.pdf");
    expect(fileIdOf("cv.pdf~~42")).toBe(42);
    expect(fileIdOf("cv.pdf")).toBeNull();
    expect(fileValue("cv.pdf", 42)).toBe("cv.pdf~~42");
    expect(fileValue("cv.pdf", null)).toBe("cv.pdf");
  });
  it("finds a name already used by another file field", () => {
    const forms: DynForm[] = [
      {
        formId: 1,
        sections: [
          section(10, [
            field(1, { fieldType: "FILE" }),
            field(2, { fieldType: "FILE" }),
          ]),
        ],
      },
    ];
    const valueOf = (_f: unknown, _s: unknown, x: unknown) =>
      String(x) === "1" ? "cv.pdf~~4" : null;
    expect(fileNameTaken(forms, valueOf, "cv.pdf", "1/10/2")).toBe(true);
    expect(fileNameTaken(forms, valueOf, "cv.pdf", "1/10/1")).toBe(false);
  });
  it("checks size (DEFAULT_SIZE_FORMAT, default 4 MB) and type (ALLOWED_EXTENSIONS)", () => {
    expect(maxMbOf(undefined)).toBe(4);
    expect(maxMbOf("")).toBe(4);
    expect(maxMbOf("10")).toBe(10);
    const accept = acceptOf("PDF, .docx ,");
    expect(accept).toBe(".pdf,.docx");
    expect(acceptOf(null)).toBe("");
    expect(
      fileProblem({ name: "a.pdf", size: 5 * 1024 * 1024 }, 4, accept),
    ).toBe("File size should be less than 4MB");
    expect(fileProblem({ name: "a.exe", size: 1 }, 4, accept)).toBe(
      "This file type is not allowed",
    );
    expect(fileProblem({ name: "A.PDF", size: 1 }, 4, accept)).toBeNull();
    expect(fileProblem({ name: "a.exe", size: 1 }, 4, "")).toBeNull();
  });
});
