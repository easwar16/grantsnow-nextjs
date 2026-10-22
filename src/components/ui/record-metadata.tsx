export function RecordMetadata({
  id,
  fields,
}: {
  id?: string;
  fields: { label: string; value?: React.ReactNode }[];
}) {
  return (
    <dl id={id} className="record-metadata">
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
