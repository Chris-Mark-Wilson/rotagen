import React from "react";

export default function PeopleSwapControls({
  enabled,
  selectedCount,
  disabled,
  canSwap,
  onToggle,
  onClear,
  onSwap,
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button
        onClick={onToggle}
        disabled={disabled}
        style={{ padding: "10px 12px", cursor: disabled ? "not-allowed" : "pointer" }}
      >
        {enabled ? "Exit swap people" : "Swap people"}
      </button>

      {enabled ? (
        <>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Click 2 people in the shift counter. Selected: <b>{selectedCount}/2</b>
          </div>

          <button onClick={onClear} style={{ padding: "10px 12px", cursor: "pointer" }}>
            Clear selection
          </button>

          <button
            onClick={onSwap}
            disabled={!canSwap}
            style={{ padding: "10px 12px", cursor: canSwap ? "pointer" : "not-allowed" }}
          >
            Swap all shifts
          </button>
        </>
      ) : (
        !disabled && <div style={{ fontSize: 12, opacity: 0.7 }}>Tip: click “Swap people”, then click two names.</div>
      )}
    </div>
  );
}
