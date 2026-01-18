import React from "react";

export default function TwoPersonActionControls({
  title,
  enabled,
  selectedPeople,
  disabled,
  canApply,
  errorText,

  onToggle,
  onClear,
  onApply,
  onRemovePerson,

  // match Swap people style
  tip, // short inline tip next to title
}) {
  return (
    <div style={{ marginTop: 12 }}>
      {/* Header row: title + tip + enable button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h4 style={{ margin: 0 }}>{title}</h4>
          {tip ? (
            <span style={{ fontSize: 12, opacity: 0.75 }}>
              {tip}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={onToggle}
          style={{ padding: "8px 10px" }}
        >
          {enabled ? "Cancel" : "Enable"}
        </button>
      </div>

      {/* Only show the body when enabled */}
      {enabled ? (
        <div style={{ marginTop: 10 }}>
          {/* selected chips */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {selectedPeople.map((name) => (
              <span
                key={name}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid #bbb",
                  background: "#f7f7f7",
                  color: "black",
                }}
              >
                {name}
                <button
                  type="button"
                  onClick={() => onRemovePerson?.(name)}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                  aria-label={`Remove ${name}`}
                  title={`Remove ${name}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={!canApply}
              onClick={onApply}
              style={{ padding: "8px 10px" }}
            >
              Apply
            </button>
            <button
              type="button"
              onClick={onClear}
              style={{ padding: "8px 10px" }}
            >
              Clear
            </button>
          </div>

          {errorText ? (
            <div
              style={{
                marginTop: 8,
                background: "#fff3cd",
                border: "1px solid #ffeeba",
                padding: 10,
                borderRadius: 6,
              }}
            >
              {errorText}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
