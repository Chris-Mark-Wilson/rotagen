import React, { useMemo } from "react";

export default function ShiftCounter({ rows }) {
  const stats = useMemo(() => {
    const map = new Map();

    function bump(name, key) {
      if (!name) return;
      const n = String(name).trim();
      if (!n) return;

      if (!map.has(n)) {
        map.set(n, { name: n, weekend: 0, week: 0, total: 0 });
      }
      const entry = map.get(n);
      entry[key] += 1;
      entry.total += 1;
    }

    for (const r of rows || []) {
      bump(r.weekend, "weekend");
      bump(r.week, "week");
    }

    // Sort: most total shifts first, then name
    return Array.from(map.values()).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    });
  }, [rows]);

  if (!rows || rows.length === 0) {
    return (
      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Generate a rota to see shift counts.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
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
      <tr key={s.name}>
        <td>{s.name}</td>
        <td>{s.weekend}</td>
        <td>{s.week}</td>
        <td><b>{s.total}</b></td>
      </tr>
    ))}
  </tbody>
</table>

    </div>
  );
}
