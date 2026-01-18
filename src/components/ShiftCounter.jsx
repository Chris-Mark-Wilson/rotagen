import React, { useMemo } from "react";

export default function ShiftCounter({
  rows,
  pickMode = false,
  selectedPeople = [], // ["dean","stan"]
  onPersonClick,
}) {
  const stats = useMemo(() => {
    const map = new Map();

    function bump(name, key) {
      if (!name) return;
      const n = String(name).trim();
      if (!n) return;

      if (!map.has(n)) map.set(n, { name: n, weekend: 0, week: 0, total: 0 });
      const entry = map.get(n);
      entry[key] += 1;
      entry.total += 1;
    }

    for (const r of rows || []) {
      bump(r.weekend, "weekend");
      bump(r.week, "week");
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    });
  }, [rows]);

  const isSelected = (name) => selectedPeople.includes(name);

  const rowStyle = (active) => ({
    cursor: pickMode ? "pointer" : "default",
    boxShadow: active ? "0 0 0 3px #1976d2 inset" : "none",
    borderRadius: 4,
    userSelect: "none",
  });

  if (!rows || rows.length === 0) {
    return <div style={{ fontSize: 12, opacity: 0.7 }}>Generate a rota to see shift counts.</div>;
  }

  return (
    <div style={{ marginTop: 14 }}>
      <h4 style={{ margin: "10px 0" }}>Shift counts</h4>

      <table className="striped-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Weekend</th>
            <th>Week</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr
              key={s.name}
              onClick={() => pickMode && onPersonClick?.(s.name)}
              style={rowStyle(isSelected(s.name))}
              title={pickMode ? "Click to select for swapping all shifts" : undefined}
            >
              <td>{s.name}</td>
              <td>{s.weekend}</td>
              <td>{s.week}</td>
              <td>
                <b>{s.total}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pickMode ? (
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          This swaps every occurrence of the two people in the rota (Weekend + Week). Rules are ignored.
        </div>
      ) : null}
    </div>
  );
}
