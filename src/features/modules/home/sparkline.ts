/** 60×16 KPI trend segments: a null value is a gap in the line, never a fabricated zero. */
export function sparklineSegments(values: (number | null)[], width = 60) {
  const known = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  if (!known.length) return [];
  const min = Math.min(...known),
    range = Math.max(...known) - min;
  const x = (i: number) =>
    values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
  const y = (v: number) => (range === 0 ? 8 : 12 - ((v - min) / range) * 8);
  const segments: { from: number; to: number; points: string }[] = [];
  let current: number[] = [];
  const close = () => {
    if (current.length)
      segments.push({
        from: x(current[0]),
        to: x(current[current.length - 1]),
        points: current.map((i) => `${x(i)},${y(values[i]!)}`).join(" "),
      });
    current = [];
  };
  values.forEach((v, i) =>
    v !== null && Number.isFinite(v) ? current.push(i) : close(),
  );
  close();
  return segments;
}
