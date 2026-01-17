import React from "react";

function formatUK(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function RotaTable({
  rows,
  swapMode = false,
  selected = [], // [{ weekIndex, slot }]
  onCellClick,
}) {
  const isSelected = (weekIndex, slot) =>
    selected.some((s) => s.weekIndex === weekIndex && s.slot === slot);

  // IMPORTANT: use inset box-shadow (NOT border) so table doesn't resize
  const cellStyle = (active) => ({
    cursor: swapMode ? "pointer" : "default",
    boxShadow: active ? "0 0 0 3px #1976d2 inset" : "none",
    borderRadius: 4,
    userSelect: "none",
  });

  return (
    <table className="rota-table">
      <thead>
        <tr>
          <th style={{ width: "30%" }}>Week commencing (Friday)</th>
          <th>Weekend</th>
          <th>Week</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={3} style={{ padding: 12, opacity: 0.7 }}>
              No rota generated yet. Click <b>Generate rota (linear)</b>.
            </td>
          </tr>
        ) : (
          rows.map((r, idx) => (
            <tr key={idx}>
              <td>{formatUK(r.weekCommencing)}</td>

              <td
                onClick={() => swapMode && onCellClick?.({ weekIndex: idx, slot: "weekend" })}
                style={cellStyle(isSelected(idx, "weekend"))}
                title={swapMode ? "Click to select for swapping" : undefined}
              >
                {r.weekend}
              </td>

              <td
                onClick={() => swapMode && onCellClick?.({ weekIndex: idx, slot: "week" })}
                style={cellStyle(isSelected(idx, "week"))}
                title={swapMode ? "Click to select for swapping" : undefined}
              >
                {r.week}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
