import "server-only";

/** `column` contains `value`, case-blind; `%`, `_` and `\` in the value match themselves, not as wildcards. */
export const containsClause = (column: string, value: string) =>
  `LOWER(${column}) LIKE LOWER('%${value.replace(/[\\%_]/g, "\\$&").replaceAll("'", "''")}%') ESCAPE '\\'`;
