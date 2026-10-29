/**
 * App-wide pure helpers the browser and the server both use, by category (owner, 2026-10-29): read them by path
 * (`functions.format.dateDisplay`). Server-only helpers are in `@/server/functions`; services that read Oracle stay
 * in their modules.
 */
import moment from "moment";
import { type FormatSettings } from "@/lib/format";
import { AppError } from "@/lib/errors";
import { placeholderModules } from "@/lib/unavailable-modules";
import { awardTabs } from "@/shared/awards/award-record";
import { constants } from "@/lib/constants";
import { type MentionPerson } from "@/lib/mentions";
import { type EChartsOption } from "echarts";
import {
  type BarSeriesOption,
  type LineSeriesOption,
  type ScatterSeriesOption,
} from "echarts/charts";
import {
  type StatisticRow,
  type WidgetData,
} from "@/features/modules/home/types";

const DEFAULT_DATE_FORMAT = "DD-MMM-YYYY";

type DateParts = { year: number; month: number; day: number };

// The tokens a user can type and read back; a pattern with any other falls back to the default.
const TYPEABLE = new Set(["YYYY", "YY", "MMMM", "MMM", "MM", "M", "DD", "D"]);

const partsOf = (pattern: string) => pattern.match(/([A-Z])\1*|[^A-Z]+/g) ?? [];

/** The configured pattern as legacy applies it (`DEFAULT_DATE_FORMAT.toUpperCase()`, a moment pattern). */
function patternOf(settings?: FormatSettings) {
  const pattern = (settings?.dateFormat || DEFAULT_DATE_FORMAT).toUpperCase();
  return partsOf(pattern).every((t) => !/^[A-Z]/.test(t) || TYPEABLE.has(t))
    ? pattern
    : DEFAULT_DATE_FORMAT;
}

/** The value's leading calendar date (date-only and timestamp alike), never shifted through UTC. */
function calendarDate(value?: string): DateParts | undefined {
  const m = value ? moment.utc(value.slice(0, 10), "YYYY-MM-DD", true) : null;
  return m?.isValid()
    ? { year: m.year(), month: m.month() + 1, day: m.date() }
    : undefined;
}

/** The configured date pattern as typed by a user, e.g. "DD-MMM-YYYY": a date field's placeholder. */
function datePattern(settings?: FormatSettings) {
  return patternOf(settings);
}

/** Reads a date typed in the configured pattern; the ISO yyyy-mm-dd it names, or undefined when it names none. */
function parseDisplayDate(text: string, settings?: FormatSettings) {
  // Strict to the pattern, but a one-digit day or month is accepted as users type it.
  const pattern = patternOf(settings),
    oneDigit = partsOf(pattern)
      .map((t) => (t === "DD" ? "D" : t === "MM" ? "M" : t))
      .join("");
  const m = moment.utc(text.trim(), [pattern, oneDigit], true);
  return m.isValid() ? m.format("YYYY-MM-DD") : undefined;
}

function dateDisplay(value?: string, settings?: FormatSettings) {
  if (!value) return "—";
  if (!calendarDate(value)) return value;
  return moment
    .utc(value.slice(0, 10), "YYYY-MM-DD")
    .format(patternOf(settings));
}

/**
 * A timestamp as legacy `formatDate(value, DEFAULT_DATE_FORMAT.toUpperCase() + ' hh:mm a')`: an instant (Z or an
 * offset) in the viewer's time zone, a wall-clock value as written; anything else is shown verbatim.
 */
function dateTimeDisplay(value?: string | null, settings?: FormatSettings) {
  if (!value) return "—";
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)) return value;
  const m = moment(value, moment.ISO_8601);
  return m.isValid() ? m.format(`${patternOf(settings)} hh:mm a`) : value;
}

/**
 * A timestamp as legacy's datetime converter (`DEFAULT_DATE_FORMAT + " HH:mm:ss"`): an instant in the viewer's time
 * zone, a wall-clock value as written, a bare date as a date. Call it in the browser, where the zone is the viewer's.
 */
function stampDisplay(value?: string | null, settings?: FormatSettings) {
  if (!value) return "—";
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value))
    return dateDisplay(value, settings);
  const m = moment(value, moment.ISO_8601);
  return m.isValid() ? m.format(`${patternOf(settings)} HH:mm:ss`) : value;
}

function moneyDisplay(
  value?: string,
  currency?: string,
  settings?: FormatSettings,
) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value; // Preserve backend masking verbatim.
  // Legacy formatCurrency: min = DECIMAL_PLACES_COUNT || 0, max = DECIMAL_PLACES_COUNT || 2.
  const maximumFractionDigits = settings?.decimals || 2;
  if (!currency || !/^[A-Z]{3}$/.test(currency))
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits }).format(n);
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      ...(settings
        ? {
            minimumFractionDigits: settings.decimals || 0,
            maximumFractionDigits,
          }
        : {}),
    }).format(n);
  } catch {
    return `${value} ${currency}`;
  }
}

/**
 * A record or config key as a readable id part (owner rule: unique, short, kebab-case ids): camelCase splits on its
 * capitals, and anything outside a-z0-9 becomes one dash, e.g. "pPendingApprovals" → "p-pending-approvals",
 * "UK Research Council" → "uk-research-council".
 */
function idPart(key: string | number) {
  return (
    String(key)
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "none"
  );
}

function publicError(error: unknown): {
  code: string;
  message: string;
  status: number;
  action?: string;
} {
  if (!(error instanceof AppError))
    return {
      code: "UPSTREAM",
      message:
        "The service is unavailable. Please retry or contact your administrator.",
      status: 502,
    };
  const { code, message, status, action } = error;
  return action ? { code, message, status, action } : { code, message, status };
}

/** A server read as the result a client takes; a failure becomes its public error, so a streamed read never rejects. */
function settle<T>(read: Promise<T>) {
  return read.then(
    (data) => ({ ok: true as const, data }),
    (e: unknown) => {
      const { code, message, action } = publicError(e);
      return { ok: false as const, error: { code, message, action } };
    },
  );
}

function safeReturn(value: unknown) {
  if (typeof value !== "string" || /[\\\r\n]/.test(value)) return "/home";
  try {
    const url = new URL(value, "https://local.invalid");
    if (
      !value.startsWith("/") ||
      url.origin !== "https://local.invalid" ||
      !(
        [
          "/home",
          "/proposals",
          "/contracts",
          "/contracts/new",
          "/awards",
          "/opportunities",
          "/opportunities/eoi",
          "/opportunities/analytics",
        ].includes(url.pathname) ||
        placeholderModules.some((m) => url.pathname === `/modules/${m.id}`) ||
        /^\/opportunities\/eoi\/[1-9]\d{0,14}\/(summary|application|attachments|approvals|delegation|history|dynamic-form-[1-5])$/.test(
          url.pathname,
        ) ||
        // A new application (Apply) and More Info's detail page.
        /^\/opportunities\/eoi\/new\/[1-9]\d{0,14}\/(summary|application)$/.test(
          url.pathname,
        ) ||
        /^\/opportunities\/[1-9]\d{0,14}$/.test(url.pathname) ||
        new RegExp(`^/awards/[1-9]\\d{0,14}/(${awardTabs.join("|")})$`).test(
          url.pathname,
        ) ||
        /^\/proposals\/(PROPOSAL|OUTLINE_PROPOSAL|SUB_PROPOSAL|EXTENSION_PROPOSAL)\/[1-9]\d{0,14}$/.test(
          url.pathname,
        ) ||
        /^\/contracts\/[1-9]\d{0,14}(?:\/(?:workflow|history|delegation|signers))?$/.test(
          url.pathname,
        )
      )
    )
      return "/home";
    return url.pathname + url.search;
  } catch {
    return "/home";
  }
}

/** A configured image address (legacy `APPLICATION_LOGO_URL`): https, or a path on this origin; anything else is dropped. */
function safeImageUrl(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  if (/^\/(?![/\\])/.test(value)) return value;
  try {
    return new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** A backend link (opportunity page, sponsor site, logo): http(s) with no credentials, else dropped. */
function safeUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function trustedUsername(claims: Record<string, unknown>, claim: string) {
  const value = claims[claim];
  if (
    typeof claims.sub !== "string" ||
    !claims.sub ||
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 254 ||
    /[\r\n\x00-\x1f]/.test(value)
  )
    throw new AppError(
      "UNAUTHENTICATED",
      "The verified identity has no approved GrantsNow username.",
      401,
    );
  return value;
}

function sameOrigin(request: Request, origin: string) {
  if (request.headers.get("origin") !== origin)
    throw new AppError("FORBIDDEN", "Cross-origin session action denied.", 403);
}

/**
 * The anchor legacy's rte-modified UserMentionCustomization writes for a person mention, attributes in its order.
 * The person list has no first/last split, so FirstName is the full name and LastName is left out; a person with
 * no email gets no mailto link.
 */
function mentionAttributes(p: MentionPerson): [string, string][] {
  return [
    ["class", "mention oj-link-standalone oj-link-subtle-primary"],
    ["data-mention", `@${p.name}`],
    ["data-person-id", p.id],
    ["data-first-name", p.name],
    ...(p.email
      ? ([
          ["data-email-address", p.email],
          ["href", `mailto:${p.email}`],
        ] as [string, string][])
      : []),
    ["data-mention-type", "person"],
  ];
}

/** The text a mention shows. */
const mentionText = (p: MentionPerson) => `@${p.name}`;

/** Legacy's feed: `full_name` contains the query, case-insensitive (`$co`), up to its `dropdownLimit` of 1000. */
function matchMentions(people: MentionPerson[], query: string) {
  const q = query.toLowerCase();
  return people
    .filter((p) => p.name.toLowerCase().includes(q))
    .slice(0, constants.limits.mentions);
}

/** The @query being typed just before the caret, or null: `@` at the start or after a space or opening bracket. */
function mentionQuery(before: string) {
  const match = /(?:^|[\s([{"'])@([^@\n]{0,40})$/.exec(before);
  return match ? { query: match[1], length: match[1].length + 1 } : null;
}

// Legacy getCorrectMappingForChart: LA is lineWithArea; anything unknown is a pie.
const dynamicTypes: Record<string, "pie" | "line" | "area" | "bar"> = {
  PIE: "pie",
  DONUT: "pie",
  LINE: "line",
  LA: "area",
  AREA: "area",
  BAR: "bar",
};

/** Pies slice by the row's group; the rest group by it and split series by `series` (legacy item template). */
function dynamicChartData(chart: {
  type: string;
  columns: number;
  points: { series: string; group: string; value: number | null }[];
}): WidgetData {
  return {
    attention: [],
    // A null point is a gap: it gets no row, so no mark.
    statistics: chart.points.flatMap((p, i) =>
      p.value === null
        ? []
        : [{ id: String(i), label: p.group, series: p.series, value: p.value }],
    ),
    hasMore: false,
    offset: 0,
    presentation: {
      type: dynamicTypes[chart.type] || "pie",
      columns: chart.columns,
    },
  };
}

// Redwood --oj-dvt-danger/warning/success-color: the FEI gauge thresholds.
const thresholds = ["#d63b25", "#cf7c00", "#508223"];

// Redwood pie labels use two significant digits: 13%, 8.0%, 1.0%.
const percent = new Intl.NumberFormat("en-US", {
  minimumSignificantDigits: 2,
  maximumSignificantDigits: 2,
});

const pieLabel = (share = 0) => `${percent.format(share)}%`;

/** Nothing to draw: no gauge, or no value other than null or 0 (a chart of zeros has no marks). */
function chartIsEmpty(
  data: Pick<WidgetData, "statistics" | "gauge" | "presentation">,
) {
  return data.presentation?.type === "gauge"
    ? !data.gauge
    : !data.statistics.some((r) => r.value !== null && r.value !== 0);
}

/** The row a clicked point stands for: its slice name, or its category and series. */
function pointRow(
  data: WidgetData,
  name: string,
  seriesName: string,
): StatisticRow | undefined {
  const sliced = ["pie", "funnel"].includes(data.presentation?.type || "");
  return data.statistics.find(
    (r) => r.label === name && (sliced || (r.series || r.label) === seriesName),
  );
}

/**
 * ECharts never truncates legend text, so a long name runs over the plot. A legend with a percentage width gets
 * its text cut to that column (less icon, gap and air); hovering an item shows the full name.
 */
function legendTextWidth(option: EChartsOption, hostWidth: number) {
  const legend = option.legend as { width?: unknown; show?: boolean };
  if (
    legend?.show === false ||
    typeof legend?.width !== "string" ||
    !legend.width.endsWith("%")
  )
    return undefined;
  return Math.max(
    40,
    Math.floor((hostWidth * parseFloat(legend.width)) / 100 - 24),
  );
}

function insightOptions(
  data: WidgetData,
  reducedMotion = false,
  dark = false,
  format?: FormatSettings,
): EChartsOption {
  const p = data.presentation,
    type = p?.type || "bar",
    currency = p?.currency;
  const text = dark ? "#e2e6e7" : "rgba(22,21,19,0.7)",
    strong = dark ? "#fff" : "#161513",
    gridline = {
      lineStyle: { color: dark ? "#4a5659" : "rgba(22,21,19,0.12)" },
    };
  const font = {
    fontFamily: '"Oracle Sans", "Open Sans", Arial, sans-serif',
    fontSize: 12,
    color: text,
  };
  // en-US compact gives Redwood's capital suffixes (£2M, 1.2K).
  const count = new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }),
    amount = currency
      ? new Intl.NumberFormat("en-US", {
          notation: "compact",
          maximumFractionDigits: 0,
          style: "currency",
          currency,
        })
      : count;
  // Tooltips and labels use the legacy value converters: configured currency, else decimal.
  const full = (v: unknown, money = !!currency) =>
    v === null || v === undefined
      ? "—"
      : money
        ? moneyDisplay(String(v), currency, format)
        : new Intl.NumberFormat("en-GB", {
            maximumFractionDigits: format?.decimals || 2,
          }).format(Number(v));
  const drills = data.statistics.some((r) => r.href);
  const cursor = drills ? "pointer" : "default";
  const legend = {
    show: p?.legend !== false,
    type: "scroll" as const,
    orient: "vertical" as const,
    right: 0,
    top: "middle",
    icon: "rect",
    itemWidth: 10,
    itemHeight: 10,
    pageIconSize: 10,
    textStyle: { ...font, color: strong },
  };
  const base: EChartsOption = {
    color: [...constants.charts.palette],
    animation: !reducedMotion,
    animationDuration: 400,
    textStyle: font,
    tooltip: {
      trigger: ["pie", "funnel", "scatter", "gauge"].includes(type)
        ? "item"
        : "axis",
      // Plain text: labels come from the backend and are never parsed as HTML.
      renderMode: "richText",
      confine: true,
      valueFormatter: (v) => full(v),
    },
    aria: { enabled: true },
  };
  if (type === "gauge") {
    const g = data.gauge;
    if (!g) return base;
    const stop = (v: number) => Math.min(1, Math.max(0, v / g.target));
    return {
      ...base,
      // The legacy status-meter tooltip: awarded funding against the organisational objective.
      tooltip: {
        ...base.tooltip,
        formatter: () =>
          [
            `Total Awarded Funding: ${full(g.value, true)}`,
            "Organizational Objective",
            `Low: ${full(g.low, true)}`,
            `Medium: ${full(g.medium, true)}`,
            `Target: ${full(g.target, true)}`,
          ].join("\n"),
      },
      series: [
        {
          type: "gauge",
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: g.target,
          radius: "160%",
          center: ["50%", "90%"],
          axisLine: {
            lineStyle: {
              width: 10,
              color: [
                [stop(g.low), thresholds[0]],
                [stop(g.medium), thresholds[1]],
                [1, thresholds[2]],
              ],
            },
          },
          progress: { show: true, width: 22, itemStyle: { color: "#245d63" } },
          pointer: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: {
            offsetCenter: [0, "-20%"],
            fontSize: 18,
            fontWeight: 700,
            color: strong,
            formatter: () => `${Math.round((g.value / g.target) * 100)}%`,
          },
          data: [{ value: g.value, name: "Funding Efficiency Index" }],
        },
      ],
    };
  }
  if (type === "pie" || type === "funnel") {
    const slices = data.statistics.map((r) => ({
      name: r.label,
      value: r.value,
    }));
    return {
      ...base,
      legend: { ...legend, width: "35%" },
      series: [
        type === "pie"
          ? {
              type: "pie",
              radius: "72%",
              center: ["32%", "50%"],
              cursor,
              data: slices,
              label: {
                ...font,
                color: strong,
                formatter: (s) => pieLabel(s.percent),
              },
              labelLine: { length: 8, length2: 8 },
              // Count and share, as the legacy short-desc (label: count) with the slice percentage.
              tooltip: {
                formatter: (s) =>
                  `${s.name}: ${full(s.value, false)} (${pieLabel(s.percent)})`,
              },
            }
          : {
              type: "funnel",
              left: "5%",
              width: "55%",
              gap: 4,
              sort: "none",
              cursor,
              data: slices,
              // Legacy funnel labels each stage with its amount.
              label: {
                ...font,
                color: "#fff",
                position: "inside",
                formatter: (s) => full(s.value),
              },
            },
      ],
    };
  }
  // Cartesian: scatter, bar, line, area and the combo.
  const scatter = type === "scatter",
    combo = type === "combo";
  const groups = [...new Set(data.statistics.map((r) => r.label))],
    names = [...new Set(data.statistics.map((r) => r.series || r.label))];
  const series: (BarSeriesOption | LineSeriesOption | ScatterSeriesOption)[] =
    names.map((name, si) => {
      // One value per group; a missing point stays a gap, never a zero.
      const values = groups.map(
        (group) =>
          data.statistics.find(
            (r) => r.label === group && (r.series || r.label) === name,
          )?.value ?? null,
      );
      if (scatter)
        return { type: "scatter", name, data: values, symbolSize: 8, cursor };
      if (type === "line" || type === "area")
        return {
          type: "line",
          name,
          cursor,
          connectNulls: false,
          lineStyle: { width: 3 },
          itemStyle: {
            color:
              constants.charts.palette[si % constants.charts.palette.length],
          },
          areaStyle: type === "area" ? { opacity: 0.2 } : undefined,
          // A marker only on a point with no neighbour, which a line alone would leave invisible.
          data: values.map((v, i) => ({
            value: v,
            symbol:
              v !== null && values[i - 1] == null && values[i + 1] == null
                ? "circle"
                : "none",
            symbolSize: 7,
          })),
        };
      // The combo's amount series sits on the second axis (legacy assigned-to-y2).
      const y2 = combo && name === "Awarded Amount";
      return {
        type: "bar",
        name,
        cursor,
        data: values,
        barMaxWidth: 96,
        stack: p?.stack ? "total" : undefined,
        yAxisIndex: y2 ? 1 : 0,
        tooltip: { valueFormatter: (v) => full(v, combo ? y2 : !!currency) },
      };
    });
  const valueAxis = (name?: string, money = !!currency) => ({
    type: "value" as const,
    name,
    nameLocation: "middle" as const,
    nameGap: 44,
    nameTextStyle: font,
    axisLabel: {
      ...font,
      formatter: (v: number) => (money ? amount : count).format(v),
    },
    splitLine: gridline,
  });
  return {
    ...base,
    legend: scatter ? { show: false } : { ...legend, width: "30%" },
    grid: {
      left: p?.yTitle ? 56 : 44,
      right: scatter || p?.legend === false ? (combo ? 56 : 16) : "32%",
      top: 10,
      bottom: p?.xTitle || scatter ? 44 : 24,
      containLabel: false,
    },
    xAxis: {
      type: "category",
      data: groups,
      name: p?.xTitle,
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: font,
      axisLabel: {
        ...font,
        rotate: scatter ? 90 : 0,
        width: scatter ? 30 : undefined,
        overflow: "truncate",
      },
      axisLine: gridline,
      axisTick: { show: false },
    },
    yAxis: combo
      ? [
          valueAxis(p?.yTitle, false),
          { ...valueAxis(p?.y2Title), splitLine: { show: false } },
        ]
      : valueAxis(p?.yTitle),
    series,
  };
}

export const functions = {
  format: {
    calendarDate,
    datePattern,
    parseDisplayDate,
    dateDisplay,
    dateTimeDisplay,
    stampDisplay,
    moneyDisplay,
  },
  ids: { idPart },
  errors: { publicError, settle },
  security: { safeReturn, safeImageUrl, safeUrl, trustedUsername, sameOrigin },
  mentions: { mentionAttributes, mentionText, matchMentions, mentionQuery },
  charts: {
    dynamicChartData,
    pieLabel,
    chartIsEmpty,
    pointRow,
    legendTextWidth,
    insightOptions,
  },
};
