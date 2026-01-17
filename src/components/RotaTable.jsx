import React from "react";

function formatUK(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function RotaTable({ rows }) {
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
              No rota generated yet. Click <b>Randomise rota</b>.
            </td>
          </tr>
        ) : (
          rows.map((r, idx) => (
            <tr key={idx}>
              <td>{formatUK(r.weekCommencing)}</td>
              <td>{r.weekend}</td>
              <td>{r.week}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
