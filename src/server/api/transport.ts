import "server-only";
import operations from "./operations.json";
import {
  fixtureMode,
  oracleSettings,
  browserSessionMode,
} from "@/server/configuration/environment";
import { AppError } from "@/lib/errors";
export type Operation = keyof typeof operations;
export function resolveOperationPath(
  operation: Operation,
  params: Record<string, string> = {},
) {
  const op = operations[operation];
  if (!op)
    throw new AppError("BAD_REQUEST", "Unapproved Oracle operation.", 400);
  const keys = [...op.path.matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1]);
  if (Object.keys(params).some((key) => !keys.includes(key)))
    throw new AppError("BAD_REQUEST", "Unapproved Oracle path parameter.", 400);
  return op.path.replace(/\{([a-z_]+)\}/g, (_, key: string) => {
    const value = params[key];
    if (!value || !/^[1-9]\d{0,14}$/.test(value))
      throw new AppError("BAD_REQUEST", "Invalid Oracle record identity.", 400);
    return value;
  });
}
export function assertBusiness(body: unknown) {
  if (!body || typeof body !== "object")
    throw new AppError("CONTRACT", "Oracle returned an invalid response.");
  const b = body as Record<string, unknown>;
  if (
    b.response_msg === "ERROR" ||
    b.error_code ||
    b.error_msg ||
    b.error_description
  )
    throw new AppError(
      "BUSINESS",
      "Oracle could not complete this request. Contact your administrator if it persists.",
    );
  return b;
}
export async function oracle(
  operation: Operation,
  headers: Record<string, string> = {},
  query?: URLSearchParams,
  signal?: AbortSignal,
  pathParams?: Record<string, string>,
): Promise<unknown> {
  if (browserSessionMode() && operation === "getSessionLogin")
    throw new AppError(
      "FORBIDDEN",
      "DEV browser sessions cannot bootstrap another username.",
      403,
    );
  const path = resolveOperationPath(operation, pathParams),
    op = operations[operation];
  for (const key of Object.keys(headers))
    if (!(op.headers as readonly string[]).includes(key))
      throw new AppError("BAD_REQUEST", "Unapproved Oracle header.", 400);
  if (fixtureMode()) {
    const { mockOracle } = await import("@/test-support/transport");
    return assertBusiness(
      await mockOracle(operation, headers, query, pathParams),
    );
  }
  const config = oracleSettings();
  const url = new URL(
    path.replace(/^\//, ""),
    op.service === "base" ? config.base : config.apps,
  );
  if (query) url.search = query.toString();
  let response: Response;
  // The verified DEV KPI aggregation takes ~42 seconds; ordinary reads retain
  // the shorter timeout. Its independent Suspense boundary keeps Home usable.
  const aggregates: Operation[] = [
    "getSharedGetKpiStatistics",
    "getProposalGetProposalStatistics",
    "getPost_awardsAwardStatistics",
    "getPost_awardsAwardVsCostStatistics",
    "getDynamicFormsApplicationStatistics",
    "getSharedGetOppCategoryStat",
    "getSharedGetTopOppCategoryStat",
    "getSharedGetWidgetParameters",
    "getSharedGetDynamicCharts",
  ];
  const timeout = aggregates.includes(operation) ? 60000 : 15000;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        ...headers,
        ...(config.authorization
          ? { Authorization: config.authorization }
          : {}),
        Accept: "application/json",
      },
      cache: "no-store",
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
        : AbortSignal.timeout(timeout),
    });
  } catch {
    throw new AppError("UPSTREAM", "Oracle is unavailable. Please retry.");
  }
  if (response.status === 401)
    throw new AppError(
      "EXPIRED",
      "Your GrantsNow session has expired. Sign in again.",
      401,
    );
  if (response.status === 403)
    throw new AppError("FORBIDDEN", "Oracle denied access to this data.", 403);
  if (!response.ok)
    throw new AppError("UPSTREAM", "Oracle is unavailable. Please retry.");
  try {
    return assertBusiness(await response.json());
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError("CONTRACT", "Oracle returned an unreadable response.");
  }
}
