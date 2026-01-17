import React, { useMemo, useState } from "react";

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getNextOrSameFriday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0..6
  const diff = (5 - day + 7) % 7; // 5 = Friday
  return addDays(d, diff);
}

function formatUK(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Distribute total slots across names as evenly as possible (some get +1)
function buildQuotas(names, totalSlots) {
  const n = names.length;
  const base = Math.floor(totalSlots / n);
  const rem = totalSlots % n;
  const order = shuffle(names);
  const quota = new Map();
  order.forEach((name, idx) => quota.set(name, base + (idx < rem ? 1 : 0)));
  return quota;
}

// Creates "ideal gap" and staggered "next due" values for steady spacing
function buildCadence(names, quotaMap, weeks) {
  const gap = new Map();     // name -> ideal gap in weeks for this duty type
  const nextDue = new Map(); // name -> target week index for next assignment

  names.forEach((name) => {
    const q = quotaMap.get(name) || 0;
    if (q <= 0) {
      gap.set(name, Infinity);
      nextDue.set(name, Infinity);
      return;
    }
    const g = weeks / q; // ideal spacing
    gap.set(name, g);
    // Random stagger so not everyone starts at week 0
    nextDue.set(name, Math.random() * g);
  });

  return { gap, nextDue };
}

// Pick the most "overdue" candidate for the duty, favouring steady gaps.
function pickMostOverdue({ names, remainingQuota, nextDue, excludeSet, weekIndex }) {
  let best = null;
  let bestScore = -Infinity;

  for (const name of names) {
    if (excludeSet.has(name)) continue;

    const q = remainingQuota.get(name) || 0;
    if (q <= 0) continue;

    const due = nextDue.get(name);
    // overdue = how far past their due date we are
    const overdue = weekIndex - due;

    // big weight on overdue; small random tie-break
    const score = overdue * 1000 + Math.random();
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }

  return best;
}

/**
 * Steady-gap rota generator:
 * - Weekend and Week duties each have their own quotas + cadence
 * - No duplicates within the same week
 * - If someone does Weekend in week W, they cannot do ANY duty in week W+1
 * - Attempts multiple random staggers and keeps the best (fewest failures, best gap feel)
 */
function generateRota({ names, startFriday, weeks, attempts = 200 }) {
  const cleanNames = names.map((n) => n.trim()).filter(Boolean);

  if (cleanNames.length < 3) {
    return { rows: [], error: "You need at least 3 names for the weekend-cooldown rule to work." };
  }
  if (!weeks || weeks < 1) {
    return { rows: [], error: "Number of weeks must be at least 1." };
  }

  const nameOrderBase = cleanNames; // we shuffle per attempt anyway

  let bestRows = null;
  let bestPenalty = Infinity;
  let bestError = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const namesOrder = shuffle(nameOrderBase);

    // Quotas: everyone gets a fair share for each duty type
    const weekendQuota = buildQuotas(namesOrder, weeks); // total weekend slots = weeks
    const weekQuota = buildQuotas(namesOrder, weeks);    // total week slots = weeks

    // Cadence / spacing
    const weekendCad = buildCadence(namesOrder, weekendQuota, weeks);
    const weekCad = buildCadence(namesOrder, weekQuota, weeks);

    const rows = [];
    let prevWeekend = null;
    let failed = false;

    for (let w = 0; w < weeks; w++) {
      const exclude = new Set();
      if (prevWeekend) exclude.add(prevWeekend); // cooldown: prev weekend person off this whole week

      // Pick weekend (steady spacing)
      const weekend = pickMostOverdue({
        names: namesOrder,
        remainingQuota: weekendQuota,
        nextDue: weekendCad.nextDue,
        excludeSet: exclude,
        weekIndex: w,
      });

      if (!weekend) {
        failed = true;
        break;
      }

      // Commit weekend
      weekendQuota.set(weekend, (weekendQuota.get(weekend) || 0) - 1);
      weekendCad.nextDue.set(weekend, w + weekendCad.gap.get(weekend)); // schedule next due

      // Same-week constraint
      exclude.add(weekend);

      // Pick week duty (steady spacing)
      const weekDuty = pickMostOverdue({
        names: namesOrder,
        remainingQuota: weekQuota,
        nextDue: weekCad.nextDue,
        excludeSet: exclude,
        weekIndex: w,
      });

      if (!weekDuty) {
        failed = true;
        break;
      }

      // Commit week duty
      weekQuota.set(weekDuty, (weekQuota.get(weekDuty) || 0) - 1);
      weekCad.nextDue.set(weekDuty, w + weekCad.gap.get(weekDuty));

      rows.push({
        weekCommencing: addDays(startFriday, w * 7),
        weekend,
        week: weekDuty,
      });

      prevWeekend = weekend;
    }

    if (failed) {
      // Penalise failures heavily, but keep searching attempts
      const penalty = 1e9 + rows.length;
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestRows = rows;
        bestError = "Generator got stuck with the current rules. Try adding more names.";
      }
      continue;
    }

    // Score the schedule by how “steady” the gaps are (lower = better)
    // We measure variance of gaps per person per duty type.
    function gapVariance(dutyKey) {
      const byPerson = new Map();
      for (let i = 0; i < rows.length; i++) {
        const name = rows[i][dutyKey];
        if (!byPerson.has(name)) byPerson.set(name, []);
        byPerson.get(name).push(i);
      }

      let varSum = 0;
      for (const [, idxs] of byPerson) {
        if (idxs.length <= 2) continue;
        const gaps = [];
        for (let i = 1; i < idxs.length; i++) gaps.push(idxs[i] - idxs[i - 1]);
        const mean = gaps.reduce((a, c) => a + c, 0) / gaps.length;
        const variance = gaps.reduce((a, c) => a + (c - mean) ** 2, 0) / gaps.length;
        varSum += variance;
      }
      return varSum;
    }

    const penalty = gapVariance("weekend") + gapVariance("week");

    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestRows = rows;
      bestError = null;
    }
  }

  if (!bestRows || bestRows.length === 0) {
    return { rows: [], error: bestError || "Could not generate a rota with the given rules." };
  }

  return { rows: bestRows, error: bestError };
}

export default function App() {
  const [names, setNames] = useState(() => {
    const preset = ["luke", "dean", "jason", "chris", "dom", "andy", "mick", "paul", "ralph", "stan"];
    return [...preset, ...Array.from({ length: 15 - preset.length }, () => "")];
  });

  const [weeks, setWeeks] = useState(52);
  const [startDateISO, setStartDateISO] = useState("2026-01-02");

  const [rotaRows, setRotaRows] = useState([]);
  const [error, setError] = useState("");

  const startFriday = useMemo(() => {
    const picked = new Date(startDateISO + "T00:00:00");
    return getNextOrSameFriday(picked);
  }, [startDateISO]);

  function updateName(i, value) {
    setNames((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  function addRow() {
    setNames((prev) => (prev.length >= 15 ? prev : [...prev, ""]));
  }

  function removeRow() {
    setNames((prev) => (prev.length <= 1 ? prev : prev.slice(0, -1)));
  }

  function randomise() {
    const result = generateRota({
      names,
      startFriday,
      weeks: Number(weeks) || 0,
      attempts: 200,
    });
    setError(result.error || "");
    setRotaRows(result.rows || []);
  }

  function clearRota() {
    setError("");
    setRotaRows([]);
  }

  function setFullYear2026() {
    setStartDateISO("2026-01-02");
    setWeeks(52);
    setError("");
    setRotaRows([]);
  }

  return (
    <div style={{ fontFamily: "system-ui, Arial", padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0 }}>Rota Generator</h2>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 340px", border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Settings</h3>

          <div style={{ display: "grid", gap: 10 }}>
            <label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Week commencing (Friday)</div>
              <input
                type="date"
                value={startDateISO}
                onChange={(e) => setStartDateISO(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                Normalised to Friday: <b>{formatUK(startFriday)}</b>
              </div>
            </label>

            <label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Number of weeks</div>
              <input
                type="number"
                min={1}
                max={260}
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={randomise} style={{ padding: "10px 12px", cursor: "pointer" }}>
                Randomise rota
              </button>
              <button onClick={clearRota} style={{ padding: "10px 12px", cursor: "pointer" }}>
                Clear
              </button>
              <button onClick={setFullYear2026} style={{ padding: "10px 12px", cursor: "pointer" }}>
                Set full year 2026
              </button>
            </div>

            {error ? (
              <div style={{ background: "#fff3cd", border: "1px solid #ffeeba", padding: 10, borderRadius: 6 }}>
                {error}
              </div>
            ) : null}

            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Rules: No duplicates in same week • Weekend/Week balanced • If you do Weekend, you’re off next week •
              Scheduling aims for steady gaps.
            </div>
          </div>
        </div>

        <div style={{ flex: "1 1 340px", border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: 0 }}>Names (max 15)</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={addRow} disabled={names.length >= 15} style={{ padding: "8px 10px" }}>
                + Row
              </button>
              <button onClick={removeRow} disabled={names.length <= 1} style={{ padding: "8px 10px" }}>
                − Row
              </button>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8, width: 40 }}>#</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Name</th>
              </tr>
            </thead>
            <tbody>
              {names.map((n, i) => (
                <tr key={i}>
                  <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>{i + 1}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                    <input
                      value={n}
                      onChange={(e) => updateName(i, e.target.value)}
                      placeholder="Enter name"
                      style={{ width: "100%", padding: 8 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
            Tip: leave unused rows blank — they’ll be ignored.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Rota</h3>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                Week commencing (Friday)
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Weekend</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Week</th>
            </tr>
          </thead>
          <tbody>
            {rotaRows.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: 12, opacity: 0.7 }}>
                  No rota generated yet. Click <b>Randomise rota</b>.
                </td>
              </tr>
            ) : (
              rotaRows.map((r, idx) => (
                <tr key={idx}>
                  <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>{formatUK(r.weekCommencing)}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>{r.weekend}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>{r.week}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
