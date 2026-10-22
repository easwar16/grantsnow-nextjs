import { describe, expect, it } from "vitest";
import { DynamicFormModel } from "@/features/dynamic-form/model";
import type { DynField, DynForm } from "@/features/dynamic-form/models";
// Port of GN-Angular dynamic-form.model.spec.ts, plus the D42 rules and change tracking.
const field = (fieldId: number, patch: Partial<DynField> = {}): DynField => ({
  fieldId,
  description: `F${fieldId}`,
  fieldType: "TEXTBOX",
  isRequired: "N",
  isVisible: "Y",
  ...patch,
});
// Field 2 (required) shows only when field 1 is option 5.
const FORMS: DynForm[] = [
  {
    formId: 1,
    sections: [
      {
        sectionId: 10,
        sectionName: "Main",
        sectionType: "FORM",
        isVisible: "Y",
        isMandatory: "Y",
        fields: [
          field(1, {
            fieldType: "RADIO",
            options: [
              { optionId: 5, optionValue: "Yes" },
              { optionId: 6, optionValue: "No" },
            ],
          }),
          field(2, {
            isVisible: "C",
            isRequired: "Y",
            conditions: [
              {
                attribute: "isVisible",
                conditionOperator: "IN",
                formId: 1,
                sectionId: 10,
                fieldId: 1,
                optionId: [5],
              },
            ],
          }),
        ],
      },
    ],
  },
];
describe("DynamicFormModel", () => {
  it("does not let a hidden required field block the save", () => {
    const m = new DynamicFormModel(FORMS, [
      {
        form_id: 1,
        sections: [{ section_id: 10, fields: [{ field_id: 1, value: "6" }] }],
      },
    ]);
    expect(m.live(1, 10, 2)).toBe(false);
    expect(m.validate()).toBe(true);
  });
  it("shows and requires the field once its condition holds", () => {
    const m = new DynamicFormModel(FORMS, []);
    m.setValue(1, 10, 1, "5");
    expect(m.fieldShown(1, 10, 2)).toBe(true);
    expect(m.validate()).toBe(false);
    expect(m.error(1, 10, 2)).toBe("Enter a value.");
    expect(m.hasMissing()).toBe(true);
    m.setValue(1, 10, 2, "answer");
    expect(m.validate()).toBe(true);
  });
  it("shows an error only once the field is touched or a save was tried", () => {
    const m = new DynamicFormModel(FORMS, []);
    m.setValue(1, 10, 1, "5");
    expect(m.error(1, 10, 2)).toBeNull();
    m.touch(1, 10, 2);
    expect(m.error(1, 10, 2)).toBe("Enter a value.");
  });
  it("sends a hidden answer empty and reports changes only when the payload differs", () => {
    const m = new DynamicFormModel(FORMS, [
      {
        form_id: 1,
        sections: [
          {
            section_id: 10,
            fields: [
              { field_id: 1, value: "5" },
              { field_id: 2, value: "old" },
            ],
          },
        ],
      },
    ]);
    expect(m.hasChanges()).toBe(false);
    m.setValue(1, 10, 1, "6");
    expect(m.payload()[0].sections[0].fields).toEqual([
      { field_id: "1", value: "6" },
      { field_id: "2", value: null },
    ]);
    expect(m.hasChanges()).toBe(true);
    m.setValue(1, 10, 1, "5");
    expect(m.hasChanges()).toBe(false);
  });
  it("disables everything when read-only, and ignores writes then", () => {
    const m = new DynamicFormModel(FORMS, []);
    m.setEditable(false);
    expect(m.live(1, 10, 1)).toBe(false);
    m.setValue(1, 10, 1, "5");
    expect(m.value(1, 10, 1)).toBeNull();
    expect(m.validate()).toBe(true);
  });
  it("tells a format failure from a missing value", () => {
    const m = new DynamicFormModel(
      [
        {
          formId: 1,
          sections: [
            {
              ...FORMS[0].sections[0],
              fields: [
                field(1, { regexValidation: "\\d+", regexDesc: "Digits only" }),
              ],
            },
          ],
        },
      ],
      [],
    );
    m.setValue(1, 10, 1, "abc");
    expect(m.validate()).toBe(false);
    expect(m.hasMissing()).toBe(false);
    expect(m.error(1, 10, 1)).toBe("Digits only");
  });
  it("notifies subscribers and bumps its version on change", () => {
    const m = new DynamicFormModel(FORMS, []);
    let calls = 0;
    const off = m.subscribe(() => calls++);
    const before = m.getVersion();
    m.setValue(1, 10, 1, "5");
    off();
    m.setValue(1, 10, 1, "6");
    expect(calls).toBe(1);
    expect(m.getVersion()).toBe(before + 2);
  });
});
describe("DynamicFormModel sections", () => {
  const OPTIONAL: DynForm[] = [
    {
      formId: 1,
      sections: [
        {
          sectionId: 30,
          sectionName: "Extra",
          sectionType: "FORM",
          isVisible: "Y",
          isMandatory: "N",
          fields: [field(1, { isRequired: "Y" })],
        },
      ],
    },
  ];
  it("keeps a switched-off section out of validation and the payload", () => {
    const m = new DynamicFormModel(OPTIONAL, []);
    expect(m.sectionEnabled(1, 30)).toBe(false);
    expect(m.validate()).toBe(true);
    expect(m.payload()).toEqual([]);
    m.setSectionEnabled(1, OPTIONAL[0].sections[0], true);
    expect(m.validate()).toBe(false);
    m.setValue(1, 30, 1, "x");
    expect(m.payload()[0].sections[0]).toEqual({
      section_id: "30",
      fields: [{ field_id: "1", value: "x" }],
    });
  });
  it("starts an answered optional section on", () => {
    const m = new DynamicFormModel(OPTIONAL, [
      {
        form_id: 1,
        sections: [{ section_id: 30, fields: [{ field_id: 1, value: "x" }] }],
      },
    ]);
    expect(m.sectionEnabled(1, 30)).toBe(true);
    expect(m.hasSwitch(OPTIONAL[0].sections[0])).toBe(true);
    m.setEditable(false);
    expect(m.hasSwitch(OPTIONAL[0].sections[0])).toBe(false);
  });
});
describe("DynamicFormModel grids", () => {
  const GRID: DynForm[] = [
    {
      formId: 1,
      sections: [
        {
          sectionId: 20,
          sectionName: "People",
          sectionType: "GRID",
          isVisible: "Y",
          isMandatory: "Y",
          fields: [
            field(1, { isRequired: "Y" }),
            field(2, { fieldType: "NUMERIC" }),
          ],
        },
      ],
    },
  ];
  const section = GRID[0].sections[0];
  const stored = [
    {
      form_id: 1,
      sections: [
        {
          section_id: 20,
          fields: [
            { field_id: 1, value: "Ann~~Bo" },
            { field_id: 2, value: "1~~2" },
          ],
        },
      ],
    },
  ];
  it("loads stored rows and sends them back unchanged", () => {
    const m = new DynamicFormModel(GRID, stored);
    expect(m.rows(1, 20).length).toBe(2);
    expect(m.payload()[0].sections[0].fields).toEqual([
      { field_id: "1", value: "Ann~~Bo" },
      { field_id: "2", value: "1~~2" },
    ]);
    expect(m.hasChanges()).toBe(false);
  });
  it("drops a row added then cancelled, and keeps an edit only when Done passes", () => {
    const m = new DynamicFormModel(GRID, stored);
    m.addRow(1, section);
    expect(m.rows(1, 20).length).toBe(3);
    expect(m.hasChanges()).toBe(true);
    m.cancelRow();
    expect(m.rows(1, 20).length).toBe(2);
    m.addRow(1, section);
    expect(m.doneRow()).toBe(false);
    expect(m.cellError(1)).toBe("Enter a value.");
    m.setCell(1, "Cy");
    expect(m.doneRow()).toBe(true);
    expect(m.payload()[0].sections[0].fields[0]).toEqual({
      field_id: "1",
      value: "Ann~~Bo~~Cy",
    });
  });
  it("edits one row at a time", () => {
    const m = new DynamicFormModel(GRID, stored);
    m.editRow(1, section, 0);
    m.addRow(1, section);
    m.deleteRow(1, section, 1);
    expect(m.rows(1, 20).length).toBe(2);
  });
  it("restores an edited row on cancel, and blocks the save while a committed row misses a required column", () => {
    const m = new DynamicFormModel(GRID, [
      {
        form_id: 1,
        sections: [
          {
            section_id: 20,
            fields: [
              { field_id: 1, value: "Ann~~" },
              { field_id: 2, value: "1~~2" },
            ],
          },
        ],
      },
    ]);
    m.editRow(1, section, 0);
    m.setCell(1, "changed");
    m.cancelRow();
    expect(m.rows(1, 20)[0]["1"]).toBe("Ann");
    expect(m.validate()).toBe(false);
    expect(m.hasMissing()).toBe(true);
    expect(m.gridErrors.has("1/20")).toBe(true);
  });
  it("refuses a save with a row left in edit and a required cell empty", () => {
    const m = new DynamicFormModel(GRID, stored);
    m.addRow(1, section);
    expect(m.validate()).toBe(false);
    expect(m.hasMissing()).toBe(true);
  });
  it("clears the table when every row is deleted", () => {
    const m = new DynamicFormModel(GRID, stored);
    m.deleteRow(1, section, 0);
    m.deleteRow(1, section, 0);
    expect(m.payload()[0].sections[0].fields).toEqual([
      { field_id: "1", value: null },
      { field_id: "2", value: null },
    ]);
  });
});
describe("DynamicFormModel files", () => {
  const FILES: DynForm[] = [
    {
      formId: 1,
      sections: [
        {
          sectionId: 10,
          sectionName: "Docs",
          sectionType: "FORM",
          isVisible: "Y",
          isMandatory: "Y",
          fields: [
            field(1, { fieldType: "FILE" }),
            field(2, { fieldType: "FILE" }),
          ],
        },
      ],
    },
  ];
  const file = (name: string) => new File(["x"], name);
  const stored = [
    {
      form_id: 1,
      sections: [
        { section_id: 10, fields: [{ field_id: 1, value: "cv.pdf~~7" }] },
      ],
    },
  ];
  it("holds a picked file until save, refuses a duplicate name, and queues a replaced stored file for deletion", () => {
    const m = new DynamicFormModel(FILES, stored);
    expect(m.pickFile(1, 10, 2, file("cv.pdf"))).toBe("taken");
    expect(m.pickFile(1, 10, 1, file("new.pdf"))).toBe("ok");
    expect(m.pendingDeletes.has(7)).toBe(true);
    expect(m.value(1, 10, 1)).toBe("new.pdf");
    expect(m.pendingFile(1, 10, 1)?.name).toBe("new.pdf");
    expect(m.pickFile(1, 10, 2, file("new.pdf"))).toBe("taken");
    m.uploaded(m.pendingFiles.values().next().value!, 9);
    expect(m.value(1, 10, 1)).toBe("new.pdf~~9");
    expect(m.pendingFile(1, 10, 1)).toBeNull();
  });
  it("deletes a stored file on save and drops a picked one at once; both are unsaved changes", () => {
    const m = new DynamicFormModel(FILES, stored);
    m.removeFile(1, 10, 1);
    expect(m.pendingDeletes.has(7)).toBe(true);
    expect(m.hasChanges()).toBe(true);
    m.pickFile(1, 10, 2, file("a.txt"));
    m.removeFile(1, 10, 2);
    expect(m.pendingFiles.size).toBe(0);
    m.deleted(7);
    expect(m.pendingDeletes.size).toBe(0);
  });
});
