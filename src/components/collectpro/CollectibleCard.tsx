import React from "react";
import type { CollectionItem, Partner } from "@/lib/collectpro/types";
import { franchiseCfg, itemCost, itemProfit } from "@/lib/collectpro/helpers";
import { fmt$, fmtPct } from "@/lib/collectpro/stats";
import { StatusBadge, FranchiseIcon } from "./StatusBadge";

const applyTilt = (e: React.MouseEvent<HTMLDivElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  e.currentTarget.style.transform = `perspective(600px) rotateY(${x * 16}deg) rotateX(${-y * 16}deg) scale3d(1.03,1.03,1.03)`;
};

const resetTilt = (e: React.MouseEvent<HTMLDivElement>) => {
  e.currentTarget.style.transform = "";
};

export interface CollectibleCardProps {
  item: CollectionItem;
  partner?: Partner;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onEdit?: (item: CollectionItem) => void;
  onDelete?: (id: string) => void;
  onMarkSold?: (item: CollectionItem) => void;
  onArena?: (id: string) => void;
  onOpenModal?: (id: string) => void;
  onGrade?: (item: CollectionItem) => void;
  arenaSlot?: "a" | "b" | null;
  compact?: boolean;
}

export default function CollectibleCard({
  item,
  partner: _partner,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onMarkSold,
  onArena,
  onOpenModal,
  onGrade,
  arenaSlot,
  compact,
}: CollectibleCardProps) {
  const cfg = franchiseCfg(item.franchise);
  const cost = itemCost(item);
  const profit = itemProfit(item);
  const roiPct = profit != null && cost > 0 ? (profit / cost) * 100 : null;

  return (
    <div
      className={`glass card-tilt holo-card ${cfg.neon} relative flex flex-col rounded-2xl overflow-hidden cursor-pointer select-none transition-all duration-200${selected ? " ring-2 ring-blue-500" : ""}${compact ? " compact-card" : ""}`}
      onMouseMove={applyTilt}
      onMouseLeave={resetTilt}
      onClick={onSelect ? () => onSelect(item.id) : undefined}
      style={{ minHeight: compact ? 120 : 220 }}
    >
      {/* Arena slot badge */}
      {arenaSlot && (
        <div className={`absolute top-2 left-2 z-20 px-2 py-0.5 rounded-full text-xs font-bold ${arenaSlot === "a" ? "bg-blue-600 text-white" : "bg-purple-600 text-white"}`}>
          {arenaSlot === "a" ? "Slot A" : "Slot B"}
        </div>
      )}

      {/* Selection checkbox */}
      {onSelect && (
        <div
          className="absolute top-2 right-2 z-20"
          onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
        >
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selected ? "bg-blue-500 border-blue-500" : "bg-black/40 border-white/40"}`}>
            {selected && <span className="text-white text-xs">✓</span>}
          </div>
        </div>
      )}

      {/* Image */}
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.name}
          loading="lazy"
          className="w-full object-cover"
          style={{ height: compact ? 70 : 130, objectFit: "cover" }}
        />
      ) : (
        <div
          className="w-full flex items-center justify-center bg-gray-800/50"
          style={{ height: compact ? 70 : 130 }}
        >
          <FranchiseIcon franchise={item.franchise} size={compact ? 32 : 48} />
        </div>
      )}

      {/* Card info */}
      <div className="flex-1 p-2 flex flex-col gap-1">
        <div className="font-bold text-white leading-tight" style={{ fontSize: compact ? 11 : 13 }}>
          {item.name}
        </div>
        <div className="text-gray-400 leading-tight" style={{ fontSize: compact ? 9 : 10 }}>
          {[item.card_set, item.condition, item.psa_grade ? `PSA ${item.psa_grade}` : ""].filter(Boolean).join(" · ")}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <StatusBadge status={item.status} />
          {roiPct != null && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${roiPct >= 0 ? "bg-emerald-900/70 text-emerald-300" : "bg-red-900/70 text-red-300"}`}>
              {fmtPct(roiPct)}
            </span>
          )}
        </div>

        <div className="flex justify-between text-xs text-gray-400 mt-auto pt-1">
          <div>
            <div>Cost: {fmt$(cost)}</div>
            {item.status !== "sold" && (() => {
              const ageDays = Math.round((Date.now() - new Date(item.buy_date).getTime()) / 86400000);
              const cls = ageDays <= 30 ? "text-gray-600" : ageDays <= 90 ? "text-amber-600" : "text-red-600";
              return <div className={`font-mono ${cls}`} style={{ fontSize: 9 }}>{ageDays}d</div>;
            })()}
          </div>
          {item.status === "sold" && item.sell_price != null ? (
            <div className="text-right">
              <div className={profit != null && profit >= 0 ? "text-emerald-400" : "text-red-400"}>
                {fmt$(item.sell_price)}
              </div>
              {profit != null && (
                <div className={`font-semibold ${profit >= 0 ? "text-emerald-500" : "text-red-500"}`} style={{ fontSize: 9 }}>
                  {profit >= 0 ? "+" : ""}{fmt$(profit)}
                </div>
              )}
            </div>
          ) : item.market_price != null ? (
            <span className="text-blue-400">~{fmt$(item.market_price)}</span>
          ) : item.status === "active" ? (
            <span className="text-amber-700 text-xs" title="No market price set">⚠ no price</span>
          ) : null}
        </div>
      </div>

      {/* Action buttons */}
      {!compact && (
        <div
          className="card-actions flex gap-1 p-2 bg-black/30 backdrop-blur-sm border-t border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {item.status !== "sold" && onMarkSold && (
            <button
              onClick={() => onMarkSold(item)}
              className="flex-1 text-xs py-1 rounded bg-emerald-900/60 text-emerald-300 hover:bg-emerald-800 transition-colors"
              title="Mark sold"
            >✓</button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(item)}
              className="flex-1 text-xs py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              title="Edit"
            >✏</button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(item.id)}
              className="flex-1 text-xs py-1 rounded bg-red-900/60 text-red-300 hover:bg-red-800 transition-colors"
              title="Delete"
            >✕</button>
          )}
          {onArena && (
            <button
              onClick={() => onArena(item.id)}
              className="flex-1 text-xs py-1 rounded bg-purple-900/60 text-purple-300 hover:bg-purple-800 transition-colors"
              title="Arena"
            >⚔</button>
          )}
          {onOpenModal && (
            <button
              onClick={() => onOpenModal(item.id)}
              className="flex-1 text-xs py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              title="Detail"
            >🔍</button>
          )}
          {onGrade && (
            <button
              onClick={() => onGrade(item)}
              className="flex-1 text-xs py-1 rounded bg-indigo-900/60 text-indigo-300 hover:bg-indigo-800 transition-colors"
              title="Pre-grade"
            >🔬</button>
          )}
        </div>
      )}
    </div>
  );
}
