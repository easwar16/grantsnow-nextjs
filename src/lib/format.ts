export function dateDisplay(value?: string) {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const d = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
        .format(d)
        .replace(/ /g, "-");
}
export function moneyDisplay(value?: string, currency?: string) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value; // Preserve backend masking verbatim.
  if (!currency || !/^[A-Z]{3}$/.test(currency))
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(
      n,
    );
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(n);
  } catch {
    return `${value} ${currency}`;
  }
}
