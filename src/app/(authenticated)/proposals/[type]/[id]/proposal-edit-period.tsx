"use client";
import moment from "moment";
import { createContext, useContext, useState, type ReactNode } from "react";
import { DateInput } from "@/components/ui/date-input";

type Period = {
  start: string;
  end: string;
  months: string;
  setStart: (value: string) => void;
  setEnd: (value: string) => void;
  setMonths: (value: string) => void;
};
const Context = createContext<Period | null>(null);

function duration(start: string, end: string) {
  if (!start || !end) return "";
  const from = moment(start).startOf("day");
  const through = moment(end).add(1, "day").startOf("day");
  if (!from.isValid() || !through.isValid() || through.isBefore(from))
    return "";
  let months =
    (through.year() - from.year()) * 12 + through.month() - from.month();
  let anchor = from.clone().add(months, "months");
  if (through.isBefore(anchor)) {
    months -= 1;
    anchor = from.clone().add(months, "months");
  }
  return (
    months +
    through.diff(anchor, "days") /
      anchor.clone().add(1, "month").diff(anchor, "days")
  ).toFixed(2);
}

export function ProposalEditPeriod({
  start,
  end,
  children,
}: {
  start: string;
  end: string;
  children: ReactNode;
}) {
  const [currentStart, setStartValue] = useState(start);
  const [currentEnd, setEndValue] = useState(end);
  const [months, setMonthsValue] = useState(duration(start, end));
  const setStart = (next: string) => {
    setStartValue(next);
    setMonthsValue(duration(next, currentEnd));
  };
  const setEnd = (next: string) => {
    setEndValue(next);
    setMonthsValue(duration(currentStart, next));
  };
  const setMonths = (next: string) => {
    setMonthsValue(next);
    const value = Number(next);
    if (!currentStart || !Number.isFinite(value) || value <= 0) return;
    const whole = Math.floor(value);
    const anchor = moment(currentStart).add(whole, "months");
    const partial = anchor.clone().add(1, "month").diff(anchor, "days");
    setEndValue(
      anchor
        .add(Math.round((value - whole) * partial), "days")
        .subtract(1, "day")
        .format("YYYY-MM-DD"),
    );
  };
  return (
    <Context.Provider
      value={{
        start: currentStart,
        end: currentEnd,
        months,
        setStart,
        setEnd,
        setMonths,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function ProposalEditPeriodField({
  id,
  label,
  name,
  formId,
}: {
  id: string;
  label: string;
  name: "startDate" | "endDate" | "duration";
  formId: string;
}) {
  const period = useContext(Context);
  if (!period) throw new Error("Proposal period is unavailable.");
  if (name === "duration")
    return (
      <input
        id={id}
        aria-label={label}
        type="number"
        min="0.01"
        step="0.01"
        value={period.months}
        onChange={(event) => period.setMonths(event.target.value)}
      />
    );
  const value = name === "startDate" ? period.start : period.end;
  const onChange = name === "startDate" ? period.setStart : period.setEnd;
  return (
    <>
      <DateInput
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        required
        min={name === "endDate" ? period.start : undefined}
        max={name === "startDate" ? period.end : undefined}
      />
      <input type="hidden" form={formId} name={name} value={value} readOnly />
    </>
  );
}
