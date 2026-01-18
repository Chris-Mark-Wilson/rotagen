import React from "react";
import { exportElementToPng } from "../utils/exportPng";


function formatUK(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  const s = String(value ?? "");
  // Escape quotes by doubling, wrap in quotes if needed
  const mustQuote = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return mustQuote ? `"${escaped}"` : escaped;
}

function rowsToCsv(rows) {
  const header = ["Week commencing (Friday)", "Weekend", "Week"];
  const lines = [header.map(escapeCsv).join(",")];

  for (const r of rows) {
    lines.push(
      [formatUK(r.weekCommencing), r.weekend, r.week].map(escapeCsv).join(",")
    );
  }

  // UTF-8 BOM helps Excel open CSV with correct encoding
  return "\uFEFF" + lines.join("\r\n");
}

// Excel-compatible .xls using HTML table (opens in Excel)
function rowsToXlsHtml(rows, title = "Rota") {
  const header = ["Week commencing (Friday)", "Weekend", "Week"];

  const html = `
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
</head>
<body>
  <table border="1">
    <thead>
      <tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (r) => `
        <tr>
          <td>${formatUK(r.weekCommencing)}</td>
          <td>${r.weekend ?? ""}</td>
          <td>${r.week ?? ""}</td>
        </tr>`
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>
`.trim();

  return html;
}

export default function ExportButtons({ rows, startDateISO, weeks }) {
  const disabled = !rows || rows.length === 0;

  const baseName = `rotagen_${startDateISO || "start"}_${weeks || rows?.length || 0}w`;

  function exportCsv() {
    const csv = rowsToCsv(rows);
    downloadBlob(csv, `${baseName}.csv`, "text/csv;charset=utf-8");
  }

  function exportExcel() {
    const xls = rowsToXlsHtml(rows, "Rota");
    downloadBlob(xls, `${baseName}.xls`, "application/vnd.ms-excel");
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        onClick={exportCsv}
        disabled={disabled}
        style={{ padding: "10px 12px", cursor: "pointer" }}
      >
        Export CSV
      </button>
      <button
        onClick={exportExcel}
        disabled={disabled}
        style={{ padding: "10px 12px", cursor: "pointer" }}
      >
        Export Excel
      </button>
      <button
        onClick={() => exportElementToPng("rota-print", "rota-admin.png")}
        disabled={disabled}
      >
        Download admin PNG
      </button>

      {disabled ? (
        <div style={{ fontSize: 12, opacity: 0.7, alignSelf: "center" }}>
          Generate a rota first to enable export.
        </div>
      ) : null}
    </div>
  );
}
