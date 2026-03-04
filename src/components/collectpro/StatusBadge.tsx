import React from "react";
import type { ItemStatus } from "@/lib/collectpro/types";
import { franchiseCfg } from "@/lib/collectpro/helpers";

export function StatusBadge({ status }: { status: ItemStatus }) {
  const map: Record<ItemStatus, string> = {
    active: "bg-emerald-900 text-emerald-300",
    grading: "bg-yellow-900 text-yellow-300",
    sold: "bg-blue-900 text-blue-300",
  };
  const label: Record<ItemStatus, string> = { active: "פעיל", grading: "בדירוג", sold: "נמכר" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>
      {label[status]}
    </span>
  );
}

export function FranchiseIcon({ franchise, size = 24 }: { franchise?: string; size?: number }) {
  const cfg = franchiseCfg(franchise);
  const label = franchise?.toLowerCase().includes("pokemon") || franchise?.toLowerCase().includes("pokémon")
    ? "P"
    : franchise?.toLowerCase().includes("one piece") || franchise?.toLowerCase().includes("onepiece")
    ? "OP"
    : "?";
  return (
    <span
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        color: cfg.accent,
        border: `1.5px solid ${cfg.accent}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}
