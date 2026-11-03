import "server-only";
import { fixtureMode } from "@/server/platform/configuration/environment";

/**
 * DEVELOPMENT FIXTURE ONLY: one award record's reads for the synthetic awards (ids 5000+). Every tab is readable and
 * editable; each award has one project with a team member and two cost lines (a staff line split over two periods).
 */
const TABS = [
  "header",
  "budget-periods",
  "projects",
  "attachments",
  "history",
] as const;
const line = (over: Record<string, unknown>) => ({
  project_id: 31,
  award_project_link_id: 41,
  funding_section_lkp_code: "DIRECT",
  funding_section: "Directly Allocated",
  cost_start_date: "2026-10-01",
  cost_end_date: "2027-09-30",
  is_editable: 1,
  ...over,
});
export function awardRecordFixture(
  op: string,
  headers: Record<string, string>,
): unknown {
  if (!fixtureMode())
    throw new Error(
      "Fixture award record cannot run outside explicit development mode.",
    );
  if (op === "getSecurityUser_roles" && headers.p_obj_type === "AWARD")
    return {
      items: [
        ...TABS.map((tab, i) => ({
          page_id: 60 + i,
          page_name: `awards-${tab}`,
          component_type: "PAGE",
          read_access: "Y",
          edit_access: "Y",
          delete_access: "Y",
        })),
        ...["add-project", "add-project-cost", "add-project-teammember"].map(
          (key, i) => ({
            page_id: 70 + i,
            page_name: `awards-projects-${key}`,
            component_type: "BUTTON",
            read_access: "Y",
          }),
        ),
      ],
    };
  const index = Number(headers.award_id ?? headers.p_award_id) - 5000;
  if (op === "getPost_awardsAwardPeriodDetails")
    return { "Award Period Details": [] };
  if (op === "getPost_awardsAwardDetails")
    return {
      award_id: 5000 + index,
      proposal_id: 1000 + index,
      award_number: `AW_${String(index + 1).padStart(4, "0")}`,
      award_name: "Fixture award",
      full_title: "Fixture award",
      award_status: ["DRFT", "AIA", "IA", "REJ"][index % 4],
      award_status_desc: [
        "Draft",
        "Awaiting Internal Approval",
        "Internally Approved",
        "Rejected",
      ][index % 4],
      award_start_date: "2026-10-01",
      award_end_date: "2027-09-30",
      is_editable: 1,
      locked_modules: [],
      "Award Projects": [
        {
          project_id: 31,
          award_project_link_id: 41,
          project_name: "Fixture project",
          project_number: "PRJ_31",
          org_id: 202,
          org_unit_name: "Faculty of Health",
          start_date: "2026-10-01",
          end_date: "2027-09-30",
          is_editable: 1,
        },
      ],
      "Award ProjectsTeam Members": [
        {
          team_member_id: 61,
          person_id: 101,
          person_name: "Alex Morgan",
          project_id: 31,
          project_name: "Fixture project",
          project_role_id: 1,
          project_role_name: "Principal Investigator",
          is_editable: 1,
        },
      ],
      "Award Project Cost Line": [
        line({
          id: 501,
          cost_category_type_lkp_code: "STAFF",
          cost_category: "Staff",
          costing_group_id: 9,
          staff_name: "Alex Morgan",
          person_id: 101,
          sponsor_contribution: 600,
          instituition_contribution: 400,
          total_cost: 1000,
        }),
        line({
          id: 502,
          cost_category_type_lkp_code: "MATERIALS",
          cost_category: "Materials & Supplies",
          staff_name: "Lab consumables",
          sponsor_contribution: 250,
          instituition_contribution: 0,
          total_cost: 250,
        }),
      ],
    };
  if (op === "getPost_awardsGetProjectrole")
    return {
      items: [
        { project_role_id: 1, project_role_name: "Principal Investigator" },
      ],
    };
  if (op === "getPre_awards_costingGetFundingHdr")
    return {
      items: [
        { lookup_code: "DIRECT", lookup_code_value: "Directly Allocated" },
      ],
    };
  if (op === "getPre_awardGetCostCategoryItems")
    return {
      items: [
        {
          cost_category_item_id: 7,
          cost_category_description: "Principal investigator",
          gl_nominal_lkp_code: "160001",
        },
      ],
    };
  if (op === "getAwardProjectCostItems")
    return {
      items: [
        {
          id: 801,
          cost_start_date: "2026-10-01",
          cost_end_date: "2027-03-31",
          sponsor_contribution: 300,
          instituition_contribution: 200,
          total_cost: 500,
        },
        {
          id: 802,
          cost_start_date: "2027-04-01",
          cost_end_date: "2027-09-30",
          sponsor_contribution: 300,
          instituition_contribution: 200,
          total_cost: 500,
        },
      ],
    };
  return undefined;
}
