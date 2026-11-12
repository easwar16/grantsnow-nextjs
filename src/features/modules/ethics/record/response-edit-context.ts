"use client";
import { createContext, useContext } from "react";

export interface ResponseEditContextValue {
  editing: boolean;
  saving: boolean;
  setEditing: (editing: boolean) => void;
  setSaving: (saving: boolean) => void;
  register: (handlers: { save: () => void; cancel: () => void } | null) => void;
}

export const ResponseEditContext = createContext<ResponseEditContextValue | null>(null);

export function useResponseEdit() {
  const context = useContext(ResponseEditContext);
  if (!context) throw new Error("Ethics response editor needs its record shell.");
  return context;
}
