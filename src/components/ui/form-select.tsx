"use client";
import { useRef, useState } from "react";
import { Select, type SelectOption } from "./select";

/**
 * The searchable Select inside a plain HTML form (server action or GET form): it keeps its own value unless one is
 * given, submits it as `name`, takes part in the form's `required` validation (a hidden input cannot), and can submit
 * its form on change as a native select's change event did.
 */
export function FormSelect({
  id,
  name,
  label,
  options,
  defaultValue = "",
  value: given,
  onChange,
  required = false,
  disabled = false,
  submitOnChange = false,
  busy = false,
  className,
}: {
  id: string;
  name: string;
  label: string;
  options: SelectOption[];
  defaultValue?: string;
  value?: string;
  onChange?: (next: string) => void;
  required?: boolean;
  disabled?: boolean;
  submitOnChange?: boolean;
  busy?: boolean;
  className?: string;
}) {
  const [own, setOwn] = useState(defaultValue);
  const value = given ?? own;
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Select
        id={id}
        label={label}
        options={options}
        value={value}
        required={required}
        disabled={disabled}
        busy={busy}
        className={className}
        onChange={(next) => {
          if (given === undefined) setOwn(next);
          onChange?.(next);
          if (submitOnChange)
            // After React commits the new value into the input below.
            requestAnimationFrame(() => input.current?.form?.requestSubmit());
        }}
      />
      <input
        ref={input}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        // Not readOnly: a read-only field is left out of the form's validation.
        onChange={() => undefined}
        // The browser focuses an empty required field; the Select is what the user can fix.
        onFocus={() => document.getElementById(`${id}-trigger`)?.focus()}
      />
    </>
  );
}
