import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  roles: [] as {
    page_name: string;
    read_access: string;
    edit_access: string;
    delete_access: string;
    page_id?: number;
  }[],
}));
vi.mock("@/server/identity/session/service", () => ({
  authenticate: async () => ({
    session: { token: "t" },
    user: {
      organizationId: "202",
      modules: { "claims-group": true, "claims-funds-inquiry": true },
    },
  }),
}));
vi.mock("@/server/oracle/api", () => ({
  roles: { record: async () => ({ items: state.roles }) },
  lookups: {
    codes: async () => ({
      items: [
        {
          lookup_type_code: "FPCG_FUNCTION_CODE",
          lookup_code: 1000,
          lookup_code_value: "Instruction",
        },
        {
          lookup_type_code: "FPCG_FUNCTION_CODE",
          lookup_code: 2210,
          lookup_code_value: "Improvement",
        },
        {
          lookup_type_code: "FPCG_OBJECT_CODE",
          lookup_code: "100",
          lookup_code_value: "Salaries",
        },
      ],
    }),
  },
}));
import {
  fundRecordContext,
  resolvedFilters,
} from "@/server/modules/claims/funds/record";
import {
  pageOf,
  parseFundRecordFilters,
  serializeFundRecordFilters,
} from "@/shared/claims/fund-record";
import { legacyDeepLink } from "@/shared/auth/legacy-link";

const row = (page: string, read = "Y", edit = "N") => ({
  page_name: page,
  read_access: read,
  edit_access: edit,
  delete_access: "N",
});
beforeEach(() => {
  state.roles = [];
});

it("opens a fund only with Summary read, and shows the tabs its roles read (legacy getTabs)", async () => {
  state.roles = [
    row("claims-funds-summary"),
    row("claims-funds-claims"),
    row("claims-funds-budget", "N"),
  ];
  const context = await fundRecordContext("521");
  expect(context.tabs).toEqual(["summary", "claims"]);
  state.roles = [row("claims-funds-budget")];
  await expect(fundRecordContext("522")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  state.roles = [];
  await expect(fundRecordContext("523")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(fundRecordContext("0")).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
});

it("defaults each filter to its list's first code, keeps an offered one and refuses anything else", async () => {
  expect(await resolvedFilters(parseFundRecordFilters({}))).toEqual({
    func: "1000",
    object: "100",
    status: "APPROVED",
  });
  expect(
    await resolvedFilters(
      parseFundRecordFilters({ func: "2210", status: "IN-PROCESS" }),
    ),
  ).toMatchObject({ func: "2210", status: "IN-PROCESS" });
  await expect(
    resolvedFilters(parseFundRecordFilters({ object: "999" })),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("carries the filter bar in the URL, drops malformed values, and maps tabs to their role pages", () => {
  const f = parseFundRecordFilters(
    new URLSearchParams("object=200&status=IN-PROCESS&x=1"),
  );
  expect(serializeFundRecordFilters(f)).toBe("object=200&status=IN-PROCESS");
  expect(parseFundRecordFilters({ status: "PAID" })).toEqual({
    func: "",
    object: "",
    status: "",
  });
  expect(pageOf("attachments")).toBe("claims-funds-attachments");
  expect(
    legacyDeepLink(
      "?page=shell&shell=claims&claims=claims-funds-inquiry-info&appFundId=521",
    ),
  ).toBe("/claims/funds-inquiry/521/summary");
});
