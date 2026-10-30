/**
 * A row's label-value strip. `muted` draws the labels as JET read-only fields do (oj-input-text readonly: 70%), where
 * legacy used those (Claims) instead of plain text.
 */
export function RecordMetadata({
  id,
  fields,
  muted,
}: {
  id?: string;
  fields: { label: string; value?: React.ReactNode }[];
  muted?: boolean;
}) {
  return (
    <dl
      id={id}
      className={`record-metadata${muted ? " record-metadata--muted" : ""}`}
    >
      {fields
        .filter((f) => f.value != null && f.value !== "")
        .map((f) => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
    </dl>
  );
}
