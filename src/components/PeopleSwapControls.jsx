import React from "react";

function Chip({ label, onRemove }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid #bbb",
        background: "#e3f2fd",
        fontSize: 12,
        lineHeight: 1.4,
        color: "#0d47a1",          // ✅ force text colour
        fontWeight: 600,
      }}
    >
      <span>{label}</span>

      <button
        onClick={onRemove}
        type="button"
        aria-label={`Remove ${label}`}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
          padding: 0,
          color: "#0d47a1",        // ✅ force icon colour
        }}
      >
        ×
      </button>
    </span>
  );
}


export default function PeopleSwapControls({
  enabled,
  selectedPeople = [], // ["dean","stan"]
  disabled,
  canSwap,
  onToggle,
  onClear,
  onSwap,
  onRemovePerson, // (name)=>void
}) {
  const a = selectedPeople[0] || null;
  const b = selectedPeople[1] || null;

  return (
    <div style={{ display: "grid", gap: 8 }}>
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
              Click 2 people in the shift counter to swap all their shifts.
            </div>

            <button onClick={onClear} style={{ padding: "10px 12px", cursor: "pointer" }}>
              Clear selection
            </button>

            <button
              onClick={onSwap}
              disabled={!canSwap}
              style={{ padding: "10px 12px", cursor: canSwap ? "pointer" : "not-allowed" }}
              title={!canSwap ? "Select two different people first" : "Swap all shifts for these two people"}
            >
              Swap all shifts
            </button>
          </>
        ) : (
          !disabled && <div style={{ fontSize: 12, opacity: 0.7 }}>Tip: enable then click two people below.</div>
        )}
      </div>

      {enabled ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Selected:</div>

          {selectedPeople.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>None</div>
          ) : (
            selectedPeople.map((name) => (
              <Chip key={name} label={name} onRemove={() => onRemovePerson?.(name)} />
            ))
          )}

          {a && b ? (
            <div style={{ marginLeft: 6, fontSize: 12, opacity: 0.85 }}>
              Preview: <b>{a}</b> ↔ <b>{b}</b>
            </div>
          ) : (
            <div style={{ marginLeft: 6, fontSize: 12, opacity: 0.7 }}>
              ({selectedPeople.length}/2)
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
