import { expect, it } from "vitest";
import { proposalEditPayload } from "@/server/modules/proposals/edit";
import type { AttributeField } from "@/features/record/attributes/model";

const raw = {
  proposal_id: 1000,
  proposal_type: "OUTLINE_PROPOSAL",
  proposal_status: "DRFT",
  proposal_start_date: "2027-01-01T00:00:00",
  proposal_end_date: "2028-12-31T00:00:00",
  proposal_title: "Original",
  cost_model: 338,
  currency_code: "GBP",
  departments: [
    {
      person_id: 4572,
      org_unit_id: 13510,
      investigator_type_lkp_code: "PI",
      prop_deptmt_rltn_id: 5718,
      proposal_description: "Old description",
    },
  ],
  sponsors: [
    {
      sponsor_party_id: 99,
      sponsor_type_flag_lkp_code: "PRM",
      prop_sponsors_rltn_id: 8873,
    },
  ],
  internal_private: "DO-NOT-SEND",
};
const input = {
  title: "Revised title",
  description: "Revised description",
  tags: "climate,health",
  opportunityTitle: "Opportunity",
  opportunityUrl: "https://example.org/opportunity",
};
const record = { type: "OUTLINE_PROPOSAL", id: "1000", personId: "101" };

it("builds the VBCS Proposal save contract from an allowlisted edit and current record", () => {
  const payload = proposalEditPayload(raw, input, record);
  expect(payload.proposals).toMatchObject({
    proposal_title: "Revised title",
    proposal_description: "Revised description",
    start_date: "2027-01-01",
    end_date: "2028-12-31",
    created_by: 101,
    proposal_type: "OUTLINE_PROPOSAL",
    proposal_departments: [{ person_id: 4572, org_unit_id: 13510 }],
    proposal_sponsors: [{ sponsor_party_id: 99, prop_sponsors_rltn_id: 8873 }],
  });
  expect(JSON.stringify(payload)).not.toContain("DO-NOT-SEND");
});

it("rejects a changed identity, non-Draft status, and browser-supplied extra fields", () => {
  expect(() =>
    proposalEditPayload(raw, input, { ...record, id: "1001" }),
  ).toThrow();
  expect(() =>
    proposalEditPayload({ ...raw, proposal_status: "AIA" }, input, record),
  ).toThrow();
  expect(() =>
    proposalEditPayload(raw, { ...input, created_by: 999 }, record),
  ).toThrow();
});

it("preserves hidden Summary fields even when the browser submits replacements", () => {
  const payload = proposalEditPayload(raw, input, record, new Set(["title"]));
  expect(payload.proposals.proposal_title).toBe("Revised title");
  expect(payload.proposals.proposal_description).toBe("Old description");
  expect(payload.proposals.tags).toBe("");
  expect(payload.proposals.opportunity_url).toBe("");
});

it("preserves a missing optional choice when the edit form submits its empty value", () => {
  const payload = proposalEditPayload(
    raw,
    { ...input, activityType: "" },
    record,
    new Set(["title", "activityType"]),
    undefined,
    { activityTypes: [] } as Parameters<typeof proposalEditPayload>[5],
  );
  expect(payload.proposals.activity_type).toBeNull();
});

it("saves source-backed research partners and subprojects while rejecting unknown selections", () => {
  const choices: Parameters<typeof proposalEditPayload>[5] = {
    collaborators: [
      { id: 252, name: "Lancaster University", countryCode: "", vatCode: "" },
    ],
    collaboratorRoles: [{ value: "PRM", label: "Primary Provider" }],
    subproposalTypes: [
      { value: "INTERNAL_DEPT", label: "Internal Department" },
    ],
    subprojectPeople: [
      {
        personId: 102,
        employeeNumber: "EMP102",
        name: "Sam Taylor",
        orgUnitId: 203,
        orgUnitName: "Faculty of Science",
      },
    ],
  };
  const additions = {
    ...input,
    collaboratorFlag: "Y",
    collaborators: [
      {
        relationId: null,
        collaboratorId: 252,
        roleCode: "PRM",
        description: "Partner",
        costingEnabled: true,
      },
    ],
    subprojectFlag: "Y",
    subprojects: [
      {
        relationId: null,
        personId: 102,
        orgUnitId: 203,
        employeeNumber: "EMP102",
        typeCode: "INTERNAL_DEPT",
        excludePricing: false,
      },
    ],
  };
  const payload = proposalEditPayload(
    raw,
    additions,
    record,
    new Set(["title"]),
    undefined,
    choices,
  );
  expect(payload.proposals.collaborators).toEqual([
    {
      prop_collab_rltn_id: null,
      collaborator_id: 252,
      collab_type_flag_lkp_code: "PRM",
      prop_collab_rltn_descr: "Partner",
      costing_enabled: "Y",
    },
  ]);
  expect(payload.proposals.proposal_departments).toMatchObject([
    { investigator_type: "PI" },
    {
      person_id: 102,
      org_unit_id: 203,
      investigator_type: "SCO-I",
      sub_proposal_type: "INTERNAL_DEPT",
    },
  ]);
  expect(() =>
    proposalEditPayload(
      raw,
      {
        ...additions,
        collaborators: [{ ...additions.collaborators[0], collaboratorId: 999 }],
      },
      record,
      new Set(["title"]),
      undefined,
      choices,
    ),
  ).toThrow("Invalid research partner changes");
  expect(() =>
    proposalEditPayload(
      raw,
      {
        ...additions,
        subprojects: [{ ...additions.subprojects[0], personId: 999 }],
      },
      record,
      new Set(["title"]),
      undefined,
      choices,
    ),
  ).toThrow("Invalid subproposal changes");
  expect(() =>
    proposalEditPayload(
      raw,
      { ...additions, collaborators: [] },
      record,
      new Set(["title"]),
      undefined,
      choices,
    ),
  ).toThrow("Invalid research partner changes");
});

it("preserves an existing research partner whose optional role is blank", () => {
  const partner = {
    prop_collab_rltn_id: 9963,
    collaborator_id: 252,
    collab_type_flag_lkp_code: null,
    prop_collab_rltn_descr: null,
    costing_enabled: "Y",
  };
  const payload = proposalEditPayload(
    { ...raw, collaborators: [partner] },
    {
      ...input,
      collaboratorFlag: "Y",
      collaborators: [
        {
          relationId: 9963,
          collaboratorId: 252,
          roleCode: "",
          description: "",
          costingEnabled: true,
        },
      ],
    },
    record,
    new Set(["title"]),
    undefined,
    { collaboratorRoles: [] } as Parameters<typeof proposalEditPayload>[5],
  );
  expect(payload.proposals.collaborators).toEqual([
    {
      prop_collab_rltn_id: 9963,
      collaborator_id: 252,
      collab_type_flag_lkp_code: null,
      prop_collab_rltn_descr: "",
      costing_enabled: "Y",
    },
  ]);
});

it("accepts an unchanged shared read-only attribute but rejects a changed one", () => {
  const fields = [{ name: "attribute_1", readOnly: true }] as AttributeField[];
  const current = { ...raw, attribute_1: "fixed" };
  const body = proposalEditPayload(
    current,
    { ...input, attributes: { attribute_1: "fixed" } },
    record,
    new Set(["title"]),
    undefined,
    undefined,
    fields,
  );
  expect((body.proposals as Record<string, unknown>).attribute_1).toBe("fixed");
  expect(() =>
    proposalEditPayload(
      current,
      { ...input, attributes: { attribute_1: "changed" } },
      record,
      new Set(["title"]),
      undefined,
      undefined,
      fields,
    ),
  ).toThrow("Invalid attribute changes");
});

it("saves selected metadata and sponsor rows using allowed ORDS choices", () => {
  const choices = {
    sponsors: [
      { value: "99", label: "Main", type: "GOV" },
      { value: "100", label: "Second", type: "GOV" },
    ],
    types: [{ value: "GOV", label: "Government" }],
    roles: [
      { value: "PRM", label: "Primary" },
      { value: "SEC", label: "Secondary" },
    ],
  };
  const metadata = {
    activityTypes: [{ value: "CASH", label: "Cash" }],
    stages: [{ value: "SINGLE", label: "Single" }],
    proposalTypes: [{ value: "STANDARD", label: "Standard" }],
    categories: [{ value: "Research", label: "Research" }],
    costModels: [{ value: "338", label: "FEC" }],
    deadlineTypes: [{ value: "FUNDER", label: "Funder deadline" }],
    assignees: [{ value: "101", label: "Alex Morgan" }],
    piCandidates: [],
  };
  const payload = proposalEditPayload(
    { ...raw, activity_type_code: "CASH", assigned_to: null },
    {
      ...input,
      activityType: "CASH",
      proposalStage: "SINGLE",
      proposalType: "STANDARD",
      category: "Research",
      confidential: "Y",
      assignedTo: 101,
      sponsors: [
        { relationId: 8873, partyId: 99, roleCode: "PRM", priority: 1 },
        { relationId: null, partyId: 100, roleCode: "SEC", priority: 2 },
      ],
    },
    record,
    new Set([
      "title",
      "activityType",
      "proposalStage",
      "proposalType",
      "category",
      "confidential",
      "assignedTo",
    ]),
    choices,
    metadata,
  );
  expect(payload.proposals).toMatchObject({
    activity_type: "CASH",
    proposal_stage: "SINGLE",
    proposal_type_lkp_code: "STANDARD",
    category: "Research",
    is_confidential: "Y",
    assigned_to: 101,
    assigned_to_name: "Alex Morgan",
    proposal_sponsors: [
      { sponsor_party_id: 99, sponsor_type: "PRM" },
      { sponsor_party_id: 100, sponsor_type: "SEC" },
    ],
  });
  const replaced = proposalEditPayload(
    raw,
    {
      ...input,
      sponsors: [
        { relationId: null, partyId: 100, roleCode: "PRM", priority: 1 },
      ],
    },
    record,
    new Set(["title"]),
    choices,
    metadata,
  );
  expect(replaced.proposals.proposal_sponsors).toEqual([
    {
      prop_sponsors_rltn_id: null,
      sponsor_party_id: 100,
      prop_sponsors_rltn_descr: "",
      sponsor_type: "PRM",
      sponsor_priority: 1,
    },
  ]);
  expect(() =>
    proposalEditPayload(
      raw,
      {
        ...input,
        sponsors: [
          { relationId: null, partyId: 100, roleCode: "PRM", priority: 1 },
        ],
      },
      { ...record, canDeleteSponsors: false },
      new Set(["title"]),
      choices,
      metadata,
    ),
  ).toThrow("Deleting a funder is unavailable");
  for (const sponsors of [
    [],
    [
      { relationId: 8873, partyId: 99, roleCode: "PRM", priority: 1 },
      { relationId: null, partyId: 100, roleCode: "PRM", priority: 2 },
    ],
  ]) {
    expect(() =>
      proposalEditPayload(
        raw,
        { ...input, sponsors },
        record,
        new Set(["title"]),
        choices,
        metadata,
      ),
    ).toThrow("Invalid funder changes");
  }
  const piChoices = {
    ...metadata,
    piCandidates: [
      {
        personId: 4573,
        employeeNumber: "EMP4573",
        name: "Replacement PI",
        orgUnitId: 13511,
        orgUnitName: "Faculty of Science",
      },
    ],
  };
  const changedPi = proposalEditPayload(
    raw,
    { ...input, piPersonId: 4573 },
    { ...record, canChangePi: true },
    new Set(["title"]),
    choices,
    piChoices,
  );
  expect(changedPi.proposals).toMatchObject({
    new_pi_flag: "Y",
    proposal_departments: [
      {
        person_id: 4573,
        employee_number: "EMP4573",
        org_unit_id: 13511,
      },
    ],
  });
  expect(() =>
    proposalEditPayload(
      raw,
      { ...input, piPersonId: 4573 },
      { ...record, canChangePi: false },
      new Set(["title"]),
      choices,
      piChoices,
    ),
  ).toThrow("Changing the PI is unavailable");
});
