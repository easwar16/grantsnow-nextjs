type Field = {
  id: number;
  label: string;
  type: string;
  required: boolean;
  options: { value: string; label: string }[];
};
type Form = {
  id: number;
  sections: { id: number; name: string; fields: Field[] }[];
};

export function DynamicFields({ forms }: { forms: Form[] }) {
  return forms.flatMap((form) =>
    form.sections.map((section) => (
      <section
        className="contract-dynamic-section"
        key={`${form.id}-${section.id}`}
      >
        <h2>{section.name}</h2>
        {section.fields.map((field) => {
          const name = `dynamic_${form.id}_${section.id}_${field.id}`;
          if (["TEXTBOX", "TEXTFIELD", "NUMERIC", "DATE"].includes(field.type))
            return (
              <label key={name}>
                {field.label}
                {field.required && <b> *</b>}
                <input
                  name={name}
                  type={
                    field.type === "NUMERIC"
                      ? "number"
                      : field.type === "DATE"
                        ? "date"
                        : "text"
                  }
                  required={field.required}
                />
              </label>
            );
          if (field.type === "RICHTEXTEDITOR")
            return (
              <label key={name}>
                {field.label}
                {field.required && <b> *</b>}
                <textarea name={name} required={field.required} />
              </label>
            );
          if (field.type === "LOV")
            return (
              <label key={name}>
                {field.label}
                {field.required && <b> *</b>}
                <select name={name} required={field.required} defaultValue="">
                  <option value="">Select {field.label}</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          if (["RADIO", "CHECKBOX", "CHECKLIST"].includes(field.type))
            return (
              <fieldset key={name}>
                <legend>
                  {field.label}
                  {field.required && <b> *</b>}
                </legend>
                {field.options.map((option) => (
                  <label key={option.value}>
                    <input
                      name={name}
                      type={field.type === "RADIO" ? "radio" : "checkbox"}
                      value={option.value}
                      required={field.required && field.type === "RADIO"}
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
            );
          return <p key={name}>Unsupported field: {field.label}</p>;
        })}
      </section>
    )),
  );
}
