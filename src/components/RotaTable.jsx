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

  // NEW: cover single shift support (does not break styling)
  coverShiftMode = false,
  coverCell = null, // { weekIndex, slot } | null
}) {
  const isSelectedSwap = (weekIndex, slot) =>
    selected.some((s) => s.weekIndex === weekIndex && s.slot === slot);

  const isSelectedCover = (weekIndex, slot) =>
    !!coverShiftMode &&
    !!coverCell &&
    coverCell.weekIndex === weekIndex &&
    coverCell.slot === slot;

  // IMPORTANT: use inset box-shadow (NOT border) so table doesn't resize
  // - Swap selection: blue ring (existing)
  // - Cover selection: green ring (new)
  const cellStyle = (swapActive, coverActive) => ({
    cursor: swapMode || coverShiftMode ? "pointer" : "default",
    boxShadow: swapActive
      ? "0 0 0 3px #1976d2 inset"
      : coverActive
        ? "0 0 0 3px #16a34a inset"
        : "none",
    borderRadius: 4,
    userSelect: "none",
  });

  const canClickCells = swapMode || coverShiftMode;

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
                onClick={() =>
                  canClickCells && onCellClick?.({ weekIndex: idx, slot: "weekend" })
                }
                style={cellStyle(
                  isSelectedSwap(idx, "weekend"),
                  isSelectedCover(idx, "weekend"),
                )}
                title={
                  swapMode
                    ? "Click to select for swapping"
                    : coverShiftMode
                      ? "Click to select for covering"
                      : undefined
                }
              >
                {r.weekend}
              </td>

              <td
                onClick={() =>
                  canClickCells && onCellClick?.({ weekIndex: idx, slot: "week" })
                }
                style={cellStyle(
                  isSelectedSwap(idx, "week"),
                  isSelectedCover(idx, "week"),
                )}
                title={
                  swapMode
                    ? "Click to select for swapping"
                    : coverShiftMode
                      ? "Click to select for covering"
                      : undefined
                }
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
