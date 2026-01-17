import React from "react";

export default function SwapModeControls({
  enabled,
  selectedCount,
  onToggle,
  onClear,
  onSwap,
  disabled,
  canSwap,
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button
        onClick={onToggle}
        disabled={disabled}
        style={{ padding: "10px 12px", cursor: disabled ? "not-allowed" : "pointer" }}
      >
        {enabled ? "Exit swap mode" : "Enable swap mode"}
      </button>

      {enabled ? (
        <>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Click 2 rota cells to swap. Selected: <b>{selectedCount}/2</b>
          </div>

          <button onClick={onClear} style={{ padding: "10px 12px", cursor: "pointer" }}>
            Clear selection
          </button>

          <button
            onClick={onSwap}
            disabled={!canSwap}
            style={{ padding: "10px 12px", cursor: canSwap ? "pointer" : "not-allowed" }}
            title={!canSwap && selectedCount === 2 ? "Select two different names to swap" : undefined}
          >
            Swap selected
          </button>

          {selectedCount === 2 && !canSwap ? (
            <div style={{ fontSize: 12, opacity: 0.75 }}>Select two different names to swap.</div>
          ) : null}
        </>
      ) : (
        !disabled && <div style={{ fontSize: 12, opacity: 0.7 }}>Tip: enable swap mode, then click two cells.</div>
      )}
    </div>
  );
}
