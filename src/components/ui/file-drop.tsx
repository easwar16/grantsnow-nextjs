"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import styles from "./file-drop.module.css";

/**
 * Legacy oj-file-picker (one file): a dashed drop zone that also opens the file chooser, showing the chosen file's
 * name and size. The caller checks the file (size, type) in `onPick`.
 */
export function FileDrop({
  id,
  file,
  accept,
  describedBy,
  disabled = false,
  onPick,
}: {
  id: string;
  file: File | null;
  accept?: string;
  describedBy?: string;
  disabled?: boolean;
  onPick: (file: File | undefined) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      id={`${id}-drop`}
      htmlFor={`${id}-file`}
      className={`${styles.drop} ${dragging ? styles.dragging : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) onPick(e.dataTransfer.files?.[0]);
      }}
    >
      <Icon name="attachment" size={18} />
      <span className={styles.title}>{file ? file.name : "Drag and Drop"}</span>
      <span className={styles.hint}>
        {file
          ? `${(file.size / 1024).toFixed(1)}KB`
          : "Select or drop files here."}
      </span>
      <input
        id={`${id}-file`}
        type="file"
        className="sr-only"
        accept={accept || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}
