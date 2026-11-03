/** Where cell `i` of `n` sits in `columns` columns filled downwards, the first columns taking the remainder (JET form layout). */
export function columnPlace(i: number, n: number, columns: number) {
  const base = Math.floor(n / columns),
    rem = n % columns;
  let start = 0;
  for (let c = 0; c < columns; c++) {
    const size = base + (c < rem ? 1 : 0);
    if (i < start + size) return { gridColumn: c + 1, gridRow: i - start + 1 };
    start += size;
  }
  return undefined;
}
