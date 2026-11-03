"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ApprovalTreeNode } from "@/features/record/approvals/types";
import styles from "./approval-workflow.module.css";

type TreantInstance = { destroy: () => void };
declare global {
  interface Window {
    Raphael?: unknown;
    Treant?: new (configuration: unknown) => TreantInstance;
  }
}

let library: Promise<void> | null = null;
function script(src: string) {
  return new Promise<void>((resolve, reject) => {
    const element = document.createElement("script");
    element.src = src;
    element.async = false;
    element.onload = () => resolve();
    element.onerror = () =>
      reject(new Error("Approval graph library unavailable."));
    document.head.appendChild(element);
  });
}
function loadLibrary() {
  if (!library)
    library = (async () => {
      if (!window.Raphael)
        await script("/vendor/approval-graph/raphael.min.js");
      if (!window.Treant) await script("/vendor/approval-graph/Treant.min.js");
      if (!window.Treant)
        throw new Error("Approval graph library unavailable.");
    })().catch((error: unknown) => {
      library = null;
      throw error;
    });
  return library;
}

function treantNode(node: ApprovalTreeNode): Record<string, unknown> {
  const isStart = node.name === "Approval Workflow" && node.title === "Start";
  const status = node.status.toLowerCase();
  const statusClass = [
    "approved",
    "pending",
    "rejected",
    "submitted",
    "rework",
    "skipped",
  ].includes(status)
    ? status
    : "";
  return {
    text: {
      name: node.name,
      title: node.title,
      contact: node.contact,
    },
    HTMLclass: `approvalTreeNode ${isStart ? "start" : statusClass}`,
    children: node.children.map(treantNode),
  };
}

export function ApprovalTree({ root }: { root: ApprovalTreeNode }) {
  const id = `approval-tree-${useId().replaceAll(":", "")}`;
  const element = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let mounted = true;
    let tree: TreantInstance | null = null;
    const container = element.current;
    loadLibrary()
      .then(() => {
        if (!mounted || !container || !window.Treant) return;
        container.replaceChildren();
        tree = new window.Treant({
          chart: {
            container: `#${id}`,
            rootOrientation: "WEST",
            levelSeparation: 35,
            siblingSeparation: 20,
            subTeeSeparation: 20,
            connectors: {
              type: "step",
              style: {
                "arrow-end": "classic-wide-long",
                "stroke-width": 2,
                stroke: "#665B57",
              },
            },
            node: { HTMLclass: "approvalTreeNode" },
          },
          nodeStructure: treantNode(root),
        });
      })
      .catch(() => {
        if (mounted) setError(true);
      });
    return () => {
      mounted = false;
      tree?.destroy();
      container?.replaceChildren();
    };
  }, [id, root]);
  if (error) return <p role="alert">Approval graph unavailable.</p>;
  return (
    <div className={styles.graphScroll} aria-label="Approval workflow graph">
      <div ref={element} id={id} className={styles.graphCanvas} />
    </div>
  );
}
