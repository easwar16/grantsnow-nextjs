/** Legacy getFiscalYears: 76 years from 25 before the current one; a fiscal year is named by its end year. */
export function fiscalYears(now = new Date()) {
  const first = now.getFullYear() - 25;
  return Array.from({ length: 76 }, (_, i) => {
    const year = String(first + i);
    return { value: year, label: year };
  });
}
