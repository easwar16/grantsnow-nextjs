import { serverFunctions } from "@/server/functions";
import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { chatbotUrl, question } from "@/server/modules/chatbot/service";
import { businessError } from "@/server/oracle/connection";
import { resources } from "@/server/platform/configuration/resources";
import { proposalPage } from "./record";

const responseSchema = z.object({ response: z.string().max(512 * 1024) });
const kinds = z.enum(["summary", "comparison"]);
const headerText = (value: string) =>
  /^[\x20-\x7e\xa0-\xff]{1,2048}$/.test(value) ? value : null;

export async function proposalAi(type: string, id: string, kind: string) {
  const parsed = kinds.parse(kind);
  const record = z
    .object({
      type: z.enum([
        "PROPOSAL",
        "OUTLINE_PROPOSAL",
        "SUB_PROPOSAL",
        "EXTENSION_PROPOSAL",
      ]),
      id: z.string().regex(/^[1-9]\d{0,14}$/),
    })
    .parse({ type, id });
  const context = await proposalPage(
    record.type,
    record.id,
    "proposals-summary",
  );
  const rb = await resources();
  const key =
    parsed === "summary"
      ? "proposal-ai-summary"
      : "compare-proposal-opportunity";
  if (
    !serverFunctions.resources.resourceVisible(
      rb,
      context.bundle,
      "button-labels",
      key,
    )
  )
    throw new AppError("FORBIDDEN", "This action is not available.", 403);
  const opportunity = context.summary.opportunityFields.find(
    (field) => field.key === "opportunity-url",
  )?.value;
  if (parsed === "comparison" && (!opportunity || !headerText(opportunity)))
    throw new AppError(
      "BAD_REQUEST",
      "An Opportunity URL is required for comparison.",
      400,
    );
  const base = chatbotUrl();
  if (!base) throw new AppError("UPSTREAM", "The AI service is unavailable.");
  let response: Response;
  let raw: string;
  try {
    response = await fetch(
      new URL(
        parsed === "summary" ? "summary/" : "comparison/",
        base.href.replace(/\/?$/, "/"),
      ),
      {
        method: "GET",
        headers: {
          token: context.session.token,
          "proposal-id": record.id,
          ...(parsed === "comparison"
            ? { "opportunity-url": opportunity! }
            : {}),
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(180000),
      },
    );
    raw = await response.text();
  } catch (error) {
    throw new AppError(
      "UPSTREAM",
      error instanceof Error && error.name === "TimeoutError"
        ? "The AI service timed out. Please retry."
        : "The AI service is unavailable. Please retry.",
    );
  }
  if (raw.length > 512 * 1024)
    throw new AppError("CONTRACT", "The AI service returned too much content.");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new AppError(
      "CONTRACT",
      "The AI service returned an invalid response.",
    );
  }
  if (!response.ok)
    throw (
      businessError(body) ??
      new AppError(
        "UPSTREAM",
        "The AI service could not complete this request.",
      )
    );
  const parsedBody = responseSchema.safeParse(body);
  if (!parsedBody.success)
    throw new AppError(
      "CONTRACT",
      "The AI service returned an unusable response.",
    );
  return {
    html: serverFunctions.sanitize.sanitizeHtml(parsedBody.data.response),
  };
}

const reportCell = z.union([
  z.string().max(2000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
const reportChunk = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("data"),
    payload: z.array(z.record(z.string().min(1).max(80), reportCell)).max(1000),
  }),
  z.object({
    type: z.literal("chart"),
    payload: z
      .object({
        name: z.string().optional(),
        chart: z.union([z.string(), z.array(z.string())]).optional(),
        "value-tooltip-label": z.string().optional(),
        "series-tooltip-label": z.string().optional(),
      })
      .passthrough(),
  }),
]);

/** VBCS FEC Summary's Generate action calls the chatbot costing-analysis service with the proposal number. */
export async function proposalCostingAnalysis(
  type: string,
  id: string,
  input: unknown,
) {
  const identity = z
    .object({
      type: z.enum([
        "PROPOSAL",
        "OUTLINE_PROPOSAL",
        "SUB_PROPOSAL",
        "EXTENSION_PROPOSAL",
      ]),
      id: z.string().regex(/^[1-9]\d{0,14}$/),
    })
    .parse({ type, id });
  const query = question.parse(
    z.object({ query: z.string() }).parse(input).query,
  );
  const context = await proposalPage(
    identity.type,
    identity.id,
    "proposals-fec-summary",
  );
  const number = headerText(context.summary.reference);
  if (!number)
    throw new AppError("CONTRACT", "The Proposal number is invalid.");
  const base = chatbotUrl();
  if (!base)
    throw new AppError("UPSTREAM", "The analysis service is unavailable.");
  let response: Response;
  let raw: string;
  try {
    response = await fetch(
      new URL("costinganalysis", base.href.replace(/\/?$/, "/")),
      {
        method: "POST",
        headers: {
          token: context.session.token,
          "user-query": query,
          "proposal-number": number,
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(180000),
      },
    );
    raw = await response.text();
  } catch {
    throw new AppError(
      "UPSTREAM",
      "Costing analysis is unavailable. Please retry.",
    );
  }
  if (raw.length > 2 * 1024 * 1024)
    throw new AppError("CONTRACT", "Costing analysis returned too much data.");
  if (!response.ok) {
    let error: unknown;
    try {
      error = JSON.parse(raw);
    } catch {
      error = raw;
    }
    throw (
      businessError(error) ??
      new AppError(
        "UPSTREAM",
        "Costing analysis could not complete this request.",
      )
    );
  }
  let data: z.infer<typeof reportChunk> | undefined;
  let chart: z.infer<typeof reportChunk> | undefined;
  try {
    for (const line of raw.split("\n").filter((part) => part.trim())) {
      const chunk = reportChunk.parse(JSON.parse(line));
      if (chunk.type === "data") data = chunk;
      else chart = chunk;
    }
  } catch {
    throw new AppError(
      "CONTRACT",
      "Costing analysis returned an invalid report.",
    );
  }
  return {
    rows: data?.type === "data" ? data.payload : [],
    chart:
      chart?.type === "chart"
        ? {
            name: chart.payload.name ?? "",
            types: Array.isArray(chart.payload.chart)
              ? chart.payload.chart
              : (chart.payload.chart ?? "pie").split(","),
          }
        : { name: "", types: ["pie"] },
  };
}
