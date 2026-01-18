import React, { useMemo, useRef } from "react";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function timestampForFilename(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd}_${hh}-${mi}`;
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function SaveLoadControls({
  names,
  weeks,
  startDateISO,
  rotaRows,
  revision,
  setRevision,
  onLoadPayload, // (payload)=>void
}) {
  const fileRef = useRef(null);

  const canSave = useMemo(() => Array.isArray(rotaRows) && rotaRows.length > 0, [rotaRows]);

  function handleSave() {
    if (!canSave) return;

    const nextRev = (Number(revision) || 0) + 1;

    const payload = {
      schemaVersion: 1,
      meta: {
        savedAtISO: new Date().toISOString(),
        revision: nextRev,
      },
      settings: {
        startDateISO,
        weeks: Number(weeks) || 0,
        names,
      },
      rows: (rotaRows || []).map((r) => ({
        weekCommencingISO: new Date(r.weekCommencing).toISOString().slice(0, 10), // YYYY-MM-DD
        weekend: r.weekend,
        week: r.week,
      })),
    };

    const fname = `rotagen_rev${String(nextRev).padStart(3, "0")}_${timestampForFilename()}.json`;
    downloadJSON(payload, fname);
    setRevision(nextRev);
  }

  function handlePickFile() {
    fileRef.current?.click();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-upload same file
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      // Minimal validation
      if (!payload || typeof payload !== "object") throw new Error("Invalid JSON.");
      if (!payload.settings || !payload.rows) throw new Error("Missing settings/rows.");
      if (!Array.isArray(payload.rows)) throw new Error("Rows must be an array.");

      onLoadPayload(payload);

      // If the file contains a revision, update local revision too (optional)
      const rev = payload?.meta?.revision;
      if (typeof rev === "number") setRevision(rev);
    } catch (err) {
      alert(`Could not load file: ${err.message || String(err)}`);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button onClick={handleSave} disabled={!canSave} style={{ padding: "10px 12px" }}>
        Save JSON (rev {revision || 0})
      </button>

      <button onClick={handlePickFile} style={{ padding: "10px 12px" }}>
        Load JSON
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Saves the current rota + names + settings into a re-uploadable file.
      </div>
    </div>
  );
}
