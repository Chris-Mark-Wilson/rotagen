import React, { useMemo, useState, useEffect } from "react";
import ExportButtons from "./components/ExportButtons";
import RotaTable from "./components/RotaTable";
import SwapModeControls from "./components/SwapModeControls";
import ShiftCounter from "./components/ShiftCounter";
import PeopleTwoActionControls from "./components/PeopleTwoActionControls";
import SaveLoadControls from "./components/SaveLoadControls";
import RotaStore from "./components/RotaStore";
import { subscribePeople } from "./services/peopleService";
import PeoplePicker from "./components/PeoplePicker";
import { exportElementToPng } from "./utils/exportPng";
import PeopleManagerModal from "./components/PeopleManagerModal";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase"; // adjust path if needed



import "./App.css";

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

function generateRotaLinearBalanced({ names, startFriday, weeks }) {
  const cleanNames = (names || []).map((n) => String(n).trim()).filter(Boolean);

  if (cleanNames.length < 4) {
    return {
      rows: [],
      error:
        "You need at least 4 names for the 'no back-to-back weeks' rule (2 duties per week).",
    };
  }
  if (!weeks || weeks < 1) {
    return { rows: [], error: "Number of weeks must be at least 1." };
  }

  const weekendCount = new Map(cleanNames.map((n) => [n, 0]));
  const weekCount = new Map(cleanNames.map((n) => [n, 0]));
  const lastAssignedWeek = new Map(cleanNames.map((n) => [n, -999])); // for spacing preference

  let pWeekend = 0;
  let pWeek = 0;

  function pickCandidate(type, excludeSet, weekIndex) {
    const pointer = type === "weekend" ? pWeekend : pWeek;

    let bestName = null;
    let bestIdx = -1;
    let bestScore = null;

    for (let k = 0; k < cleanNames.length; k++) {
      const idx = (pointer + k) % cleanNames.length;
      const name = cleanNames[idx];
      if (excludeSet.has(name)) continue;

      const wEnd = weekendCount.get(name) || 0;
      const wDay = weekCount.get(name) || 0;

      const dutyCount = type === "weekend" ? wEnd : wDay;
      const totalCount = wEnd + wDay;

      // Prefer more spacing: bigger gap is better
      const last = lastAssignedWeek.get(name) ?? -999;
      const gap = weekIndex - last; // bigger is better

      // Prefer balancing weekend vs week per person
      const balance = Math.abs(wEnd - wDay); // smaller better

      // Score: lower is better
      // - dutyCount: keep weekend/week fairly distributed
      // - totalCount: keep overall load even
      // - balance: avoid "all weekends vs all weeks"
      // - -gap: prefer those not recently assigned (spacing)
      // - k: stable-ish pointer feel
      const score = [dutyCount, totalCount, balance, -gap, k];

      const better =
        !bestScore ||
        score[0] < bestScore[0] ||
        (score[0] === bestScore[0] && score[1] < bestScore[1]) ||
        (score[0] === bestScore[0] && score[1] === bestScore[1] && score[2] < bestScore[2]) ||
        (score[0] === bestScore[0] &&
          score[1] === bestScore[1] &&
          score[2] === bestScore[2] &&
          score[3] < bestScore[3]) ||
        (score[0] === bestScore[0] &&
          score[1] === bestScore[1] &&
          score[2] === bestScore[2] &&
          score[3] === bestScore[3] &&
          score[4] < bestScore[4]);

      if (better) {
        bestName = name;
        bestIdx = idx;
        bestScore = score;
      }
    }

    if (!bestName) return null;

    if (type === "weekend") pWeekend = (bestIdx + 1) % cleanNames.length;
    else pWeek = (bestIdx + 1) % cleanNames.length;

    return bestName;
  }

  const rows = [];
  let prevAssigned = new Set(); // HARD RULE: nobody from last week can be used this week

  for (let w = 0; w < weeks; w++) {
    const exclude = new Set(prevAssigned);

    const weekend = pickCandidate("weekend", exclude, w);
    if (!weekend) {
      return {
        rows: [],
        error:
          "Could not allocate Weekend duty with current names/rules (try more people or fewer weeks).",
      };
    }

    exclude.add(weekend); // no duplicates same week

    const weekDuty = pickCandidate("week", exclude, w);
    if (!weekDuty) {
      return {
        rows: [],
        error:
          "Could not allocate Week duty with current names/rules (try more people or fewer weeks).",
      };
    }

    weekendCount.set(weekend, (weekendCount.get(weekend) || 0) + 1);
    weekCount.set(weekDuty, (weekCount.get(weekDuty) || 0) + 1);

    lastAssignedWeek.set(weekend, w);
    lastAssignedWeek.set(weekDuty, w);

    rows.push({
      weekCommencing: addDays(startFriday, w * 7),
      weekend,
      week: weekDuty,
    });

    // HARD RULE state for next iteration:
    prevAssigned = new Set([weekend, weekDuty]);
  }

  return { rows, error: null };
}



function swapAssignments(rows, a, b) {
  const copy = rows.map((r) => ({ ...r }));
  const tmp = copy[a.weekIndex][a.slot];
  copy[a.weekIndex][a.slot] = copy[b.weekIndex][b.slot];
  copy[b.weekIndex][b.slot] = tmp;
  return copy;
}

function buildActiveNameSetFromRota(rows) {
  const set = new Set();
  for (const r of rows || []) {
    const weekend = (r?.weekend ?? "").trim();
    const week = (r?.week ?? "").trim();
    if (weekend) set.add(weekend);
    if (week) set.add(week);
  }
  return set;
}

export default function App() {
  // Firestore people list + selection for generation
  const [people, setPeople] = useState([]);
  const [selectedNames, setSelectedNames] = useState([]);

  const [peopleModalOpen, setPeopleModalOpen] = useState(false);


  // Settings
  const [weeks, setWeeks] = useState(52);
  const [startDateISO, setStartDateISO] = useState("2026-01-02");

  // Rota + errors
  const [rotaRows, setRotaRows] = useState([]);
  const [error, setError] = useState("");

  // Cell swap mode
  const [swapMode, setSwapMode] = useState(false);
  const [swapSelection, setSwapSelection] = useState([]); // [{ weekIndex, slot }]
  const [swapError, setSwapError] = useState("");

  // Revision
  const [revision, setRevision] = useState(0);

  // Global actions: swap / cover-all (two person selection via ShiftCounter)
  const [twoPickMode, setTwoPickMode] = useState(null); // null | "swap" | "cover"
  const [twoPicked, setTwoPicked] = useState([]); // [first, second]
  const [peopleSwapError, setPeopleSwapError] = useState("");
  const [peopleCoverError, setPeopleCoverError] = useState("");

  // Cover SINGLE shift (table-level)
  const [coverShiftMode, setCoverShiftMode] = useState(false);
  const [coverCell, setCoverCell] = useState(null); // { weekIndex, slot } | null
  const [coveringPerson, setCoveringPerson] = useState("");
  const [coverShiftError, setCoverShiftError] = useState("");

  const [exportName, setExportName] = useState("");

  const [user, setUser] = useState(null);

useEffect(() => {
  const unsub = onAuthStateChanged(auth, (u) => setUser(u));
  return () => unsub();
}, []);



  const startFriday = useMemo(() => {
    const picked = new Date(startDateISO + "T00:00:00");
    return getNextOrSameFriday(picked);
  }, [startDateISO]);

  const activeNameSet = useMemo(
    () => buildActiveNameSetFromRota(rotaRows),
    [rotaRows],
  );

  const coverCellText = useMemo(() => {
    if (!coverCell) return "No cell selected";
    const row = rotaRows?.[coverCell.weekIndex];
    if (!row) return "No cell selected";

    const date =
      row.weekCommencing instanceof Date ? formatUK(row.weekCommencing) : "";
    const slotLabel = coverCell.slot === "weekend" ? "Weekend" : "Week";
    const current = (row?.[coverCell.slot] ?? "").trim();

    return `Selected: ${date} – ${slotLabel}${current ? ` (${current})` : ""}`;
  }, [coverCell, rotaRows]);

  // Subscribe Firestore people
  useEffect(() => {
    const unsub = subscribePeople((list) => {
      setPeople(list);
      setSelectedNames((prev) =>
        prev.length ? prev : list.map((p) => p.name),
      );
    });
    return () => unsub();
  }, []);

  // -------- Two-person pick logic (swap / cover-all) --------
  const canApplyTwoPicked =
    twoPicked.length === 2 &&
    twoPicked[0] &&
    twoPicked[1] &&
    twoPicked[0] !== twoPicked[1];

  function toggleTwoPick(name) {
    if (!twoPickMode) return;

    if (twoPickMode === "swap") setPeopleSwapError("");
    if (twoPickMode === "cover") setPeopleCoverError("");

    setTwoPicked((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length < 2) return [...prev, name];
      return [prev[1], name];
    });
  }

  function clearTwoPick() {
    setTwoPicked([]);
    setPeopleSwapError("");
    setPeopleCoverError("");
  }

  function setMode(modeOrNull) {
    setTwoPickMode((prev) => {
      const next = prev === modeOrNull ? null : modeOrNull;
      return next;
    });
    clearTwoPick();
  }

  // -------- Rota transforms --------
  function swapPeopleInRota(a, b) {
    return (rotaRows || []).map((r) => {
      const weekend = r.weekend === a ? b : r.weekend === b ? a : r.weekend;
      const week = r.week === a ? b : r.week === b ? a : r.week;
      return { ...r, weekend, week };
    });
  }

  function coverPeopleInRota(covering, covered) {
    return (rotaRows || []).map((r) => {
      const weekend = r.weekend === covered ? covering : r.weekend;
      const week = r.week === covered ? covering : r.week;
      return { ...r, weekend, week };
    });
  }

  function applyTwoPersonAction() {
    if (!canApplyTwoPicked) return;

    const [first, second] = twoPicked;

    if (twoPickMode === "swap") {
      setRotaRows(swapPeopleInRota(first, second));
      setPeopleSwapError("");
    } else if (twoPickMode === "cover") {
      setRotaRows(coverPeopleInRota(first, second));
      setPeopleCoverError("");
    }

    setTwoPickMode(null);
    setTwoPicked([]);
  }

  // -------- Save/load payload --------
  function applyLoadedPayload(payload) {
    const s = payload?.settings;
    const rows = payload?.rows;

    if (s?.startDateISO) setStartDateISO(s.startDateISO);
    if (typeof s?.weeks === "number") setWeeks(s.weeks);
    if (Array.isArray(s?.names)) setSelectedNames(s.names);

    if (Array.isArray(rows)) {
      setRotaRows(
        rows.map((r) => ({
          weekCommencing: new Date(
            (r.weekCommencingISO || "1970-01-01") + "T00:00:00",
          ),
          weekend: r.weekend || "",
          week: r.week || "",
        })),
      );
    } else {
      setRotaRows([]);
    }

    setError("");
    setSwapMode(false);
    setSwapSelection([]);
    setSwapError("");
    setTwoPickMode(null);
    setTwoPicked([]);
    setPeopleSwapError("");
    setPeopleCoverError("");

    setCoverShiftMode(false);
    setCoverCell(null);
    setCoveringPerson("");
    setCoverShiftError("");
  }

  // -------- Generation --------
  function generateLinear() {
    setError("");

    setSwapMode(false);
    setSwapSelection([]);
    setSwapError("");

    setTwoPickMode(null);
    setTwoPicked([]);
    setPeopleSwapError("");
    setPeopleCoverError("");

    setCoverShiftMode(false);
    setCoverCell(null);
    setCoveringPerson("");
    setCoverShiftError("");

    if ((selectedNames?.length ?? 0) < 3) {
      setError("Pick at least 3 people to generate (weekend cooldown rule).");
      return;
    }

    const result = generateRotaLinearBalanced({
      names: selectedNames,
      startFriday,
      weeks: Number(weeks) || 0,
    });

    setError(result.error || "");
    setRotaRows(result.rows || []);
  }

  function clearRota() {
    setError("");
    setRotaRows([]);

    setSwapMode(false);
    setSwapSelection([]);
    setSwapError("");

    setTwoPickMode(null);
    setTwoPicked([]);
    setPeopleSwapError("");
    setPeopleCoverError("");

    setCoverShiftMode(false);
    setCoverCell(null);
    setCoveringPerson("");
    setCoverShiftError("");
  }

  // -------- Cell interactions --------
  function handleCellClick(sel) {
    // Cover-single selection (one cell)
    if (coverShiftMode) {
      setCoverShiftError("");
      setCoverCell((prev) => {
        if (prev && prev.weekIndex === sel.weekIndex && prev.slot === sel.slot)
          return null;
        return sel;
      });
      return;
    }

    // Swap-cell selection (two cells)
    if (!swapMode) return;

    setSwapError("");
    setSwapSelection((prev) => {
      const exists = prev.find(
        (p) => p.weekIndex === sel.weekIndex && p.slot === sel.slot,
      );
      if (exists)
        return prev.filter(
          (p) => !(p.weekIndex === sel.weekIndex && p.slot === sel.slot),
        );
      if (prev.length < 2) return [...prev, sel];
      return [prev[1], sel];
    });
  }

  function clearSwapSelection() {
    setSwapSelection([]);
    setSwapError("");
  }

  function getSelectedNamesForCellSwap() {
    if (swapSelection.length !== 2) return { aName: null, bName: null };
    const [a, b] = swapSelection;
    const aName = rotaRows?.[a.weekIndex]?.[a.slot] ?? null;
    const bName = rotaRows?.[b.weekIndex]?.[b.slot] ?? null;
    return { aName, bName };
  }

  const { aName, bName } = getSelectedNamesForCellSwap();
  const canSwapDifferentNames =
    swapSelection.length === 2 &&
    aName &&
    bName &&
    aName.trim() !== "" &&
    bName.trim() !== "" &&
    aName !== bName;

  function doSwapSelected() {
    if (swapSelection.length !== 2) return;

    const [a, b] = swapSelection;
    const nameA = rotaRows?.[a.weekIndex]?.[a.slot];
    const nameB = rotaRows?.[b.weekIndex]?.[b.slot];
    if (!nameA || !nameB) return;

    if (nameA === nameB) {
      setSwapError("Pick two different names to swap.");
      return;
    }

    const swapped = swapAssignments(rotaRows, a, b);

    setSwapError("");
    setError("");
    setRotaRows(swapped);
    setSwapSelection([]);
    setSwapMode(false);
  }

  function doCoverSingleShift() {
    if (!coverCell) {
      setCoverShiftError("Click a rota cell to cover (Weekend or Week).");
      return;
    }
    if (!coveringPerson) {
      setCoverShiftError("Pick a covering person from the dropdown.");
      return;
    }

    const { weekIndex, slot } = coverCell;
    const row = rotaRows?.[weekIndex];
    if (!row) {
      setCoverShiftError("That cell no longer exists.");
      return;
    }

    const current = (row?.[slot] ?? "").trim();
    if (!current) {
      setCoverShiftError("That cell is empty.");
      return;
    }
    if (current === coveringPerson) {
      setCoverShiftError(
        "That shift is already assigned to the selected covering person.",
      );
      return;
    }

    setRotaRows((prev) =>
      (prev || []).map((r, idx) =>
        idx === weekIndex ? { ...r, [slot]: coveringPerson } : r,
      ),
    );

    setCoverShiftError("");
    setCoverShiftMode(false);
    setCoverCell(null);
    setCoveringPerson("");
  }

  const rotaDisabled = !rotaRows || rotaRows.length === 0;

  return (
    <div
      style={{
        fontFamily: "system-ui, Arial",
        padding: 16,
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Rota Generator</h2>

      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            flex: "1 1 340px",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Settings</h3>

          <div style={{ display: "grid", gap: 10 }}>
            <label>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Week commencing (Friday)
              </div>
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
              <button
                onClick={generateLinear}
                style={{ padding: "10px 12px", cursor: "pointer" }}
              >
                Generate rota (linear)
              </button>
              <button
                onClick={clearRota}
                style={{ padding: "10px 12px", cursor: "pointer" }}
              >
                Clear
              </button>
            </div>

            <PeoplePicker
              people={people}
              selectedNames={selectedNames}
              setSelectedNames={setSelectedNames}
              activeNameSet={activeNameSet}
              onEditPeople={() => setPeopleModalOpen(true)}
              user={user}
              
            />

            <PeopleManagerModal
              open={peopleModalOpen}
              onClose={() => setPeopleModalOpen(false)}
              people={people}
              user={user}
            />

            {error ? <div className="alert">{error}</div> : null}

            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Rules apply at generation time only. Swaps/covers are manual edits
              (rules ignored).
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Rota</h3>
          <ExportButtons
            rows={rotaRows}
            startDateISO={startDateISO}
            weeks={weeks}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <SwapModeControls
            enabled={swapMode}
            selectedCount={swapSelection.length}
            disabled={rotaDisabled}
            canSwap={canSwapDifferentNames}
            onToggle={() => {
              setSwapMode((v) => !v);
              setSwapSelection([]);
              setSwapError("");
            }}
            onClear={clearSwapSelection}
            onSwap={doSwapSelected}
            // Cover-single mode controls live here (your existing SwapModeControls supports these props)
            coverEnabled={coverShiftMode}
            coverTip={coverCellText}
            coverApplyDisabled={!coverCell || !coveringPerson}
            onToggleCover={() => {
              // prevent clashes with swap selection
              setSwapMode(false);
              setSwapSelection([]);
              setSwapError("");

              // also prevent clashes with two-person pick modes
              setTwoPickMode(null);
              setTwoPicked([]);

              setCoverShiftMode((v) => !v);
              setCoverCell(null);
              setCoveringPerson("");
              setCoverShiftError("");
            }}
            onClearCover={() => {
              setCoverCell(null);
              setCoveringPerson("");
              setCoverShiftError("");
            }}
            onApplyCover={doCoverSingleShift}
          />

          {swapError ? (
            <div
              style={{
                marginTop: 8,
                background: "#fff3cd",
                border: "1px solid #ffeeba",
                padding: 10,
                borderRadius: 6,
              }}
            >
              {swapError}
            </div>
          ) : null}

          {/* Cover-single inline person picker (table context, not ShiftCounter) */}
          {coverShiftMode ? (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.8 }}>Cover with:</div>

                <select
                  value={coveringPerson}
                  onChange={(e) => {
                    setCoverShiftError("");
                    setCoveringPerson(e.target.value);
                  }}
                  style={{ padding: 8 }}
                >
                  <option value="">Select person…</option>
                  {(selectedNames || []).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={!coverCell || !coveringPerson}
                  onClick={doCoverSingleShift}
                  style={{ padding: "8px 10px" }}
                >
                  Cover shift
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCoverCell(null);
                    setCoveringPerson("");
                    setCoverShiftError("");
                  }}
                  style={{ padding: "8px 10px" }}
                >
                  Clear
                </button>
              </div>

              {coverShiftError ? (
                <div
                  style={{
                    marginTop: 8,
                    background: "#fff3cd",
                    border: "1px solid #ffeeba",
                    padding: 10,
                    borderRadius: 6,
                  }}
                >
                  {coverShiftError}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <SaveLoadControls
          names={selectedNames}
          weeks={weeks}
          startDateISO={startDateISO}
          rotaRows={rotaRows}
          revision={revision}
          setRevision={setRevision}
          onLoadPayload={applyLoadedPayload}
        />

        <RotaStore
          names={selectedNames}
          weeks={weeks}
          startDateISO={startDateISO}
          rotaRows={rotaRows}
          revision={revision}
          setRevision={setRevision}
          onLoadPayload={applyLoadedPayload}
          user={user}
          setUser={setUser}
        />

        <div style={{ marginTop: 10 }}>
          <RotaTable
            rows={rotaRows}
            swapMode={swapMode}
            selected={swapSelection}
            onCellClick={handleCellClick}
            coverShiftMode={coverShiftMode}
            coverCell={coverCell}
          />
        </div>
        <div style={{ position: "absolute", left: -9999, top: 0 }}>
          <div id="rota-print">
            <h2>On-Call Rota</h2>
            <table className="rota-table">
              <thead>
                <tr>
                  <th>Week commencing</th>
                  <th>Weekend</th>
                  <th>Week</th>
                </tr>
              </thead>
              <tbody>
                {rotaRows.map((r, i) => (
                  <tr key={i}>
                    <td>{formatUK(r.weekCommencing)}</td>
                    <td>{r.weekend}</td>
                    <td>{r.week}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <PeopleTwoActionControls
            title="Swap people"
            tip="Tip: enable then click two people below."
            enabled={twoPickMode === "swap"}
            disabled={rotaDisabled}
            selectedPeople={twoPicked}
            canApply={canApplyTwoPicked}
            applyLabel="Swap"
            errorText={peopleSwapError}
            onToggle={() => setMode("swap")}
            onClear={clearTwoPick}
            onApply={applyTwoPersonAction}
            onRemovePerson={(name) => {
              setTwoPicked((prev) => prev.filter((n) => n !== name));
              setPeopleSwapError("");
            }}
          />

          <PeopleTwoActionControls
            title="Cover all shifts"
            tip="Tip: enable then click Covering then Covered below."
            enabled={twoPickMode === "cover"}
            disabled={rotaDisabled}
            selectedPeople={twoPicked}
            canApply={canApplyTwoPicked}
            applyLabel="Cover all"
            errorText={peopleCoverError}
            onToggle={() => setMode("cover")}
            onClear={clearTwoPick}
            onApply={applyTwoPersonAction}
            onRemovePerson={(name) => {
              setTwoPicked((prev) => prev.filter((n) => n !== name));
              setPeopleCoverError("");
            }}
          />
        </div>

        {/* ShiftCounter ONLY used for global two-person picking (swap + cover-all) */}
<ShiftCounter
  rows={rotaRows}
  pickMode={twoPickMode != null}
  selectedPeople={twoPicked}
  onPersonClick={toggleTwoPick}
/>

{/* --- PNG Export (per-person) --- */}
<div style={{ marginTop: 12 }}>
  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
    <div style={{ fontWeight: 600 }}>Export person PNG:</div>

    <select
      value={exportName}
      onChange={(e) => setExportName(e.target.value)}
      style={{ padding: 8 }}
      disabled={!rotaRows || rotaRows.length === 0}
    >
      <option value="">Select person…</option>
      {(selectedNames || []).map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>

    <button
      type="button"
      disabled={!exportName}
      onClick={() => exportElementToPng("rota-person-export", `${exportName}-rota.png`)}
      style={{ padding: "8px 10px" }}
    >
      Download PNG
    </button>
  </div>

  {/* hidden export target */}
  <div style={{ position: "absolute", left: -9999, top: 0 }}>
  <div id="rota-person-export">
  <h2 style={{ margin: "0 0 8px 0" }}>{exportName} – On-Call Rota</h2>

  <table className="rota-table">
    <thead>
      <tr>
        <th style={{ width: "30%" }}>Week commencing (Friday)</th>
        <th>Duty</th>
        <th>Buddy</th>
      </tr>
    </thead>

    <tbody>
      {rotaRows
        .filter((r) => r.weekend === exportName || r.week === exportName)
        .map((r, i) => {
          const isWeekend = r.weekend === exportName;
          const isWeek = r.week === exportName;

          // Buddy = the other slot that week
          const buddy =
            isWeekend && !isWeek
              ? r.week
              : isWeek && !isWeekend
                ? r.weekend
                : // edge-case: name appears in both slots (shouldn’t happen, but covers/swaps might)
                  isWeekend && isWeek
                  ? "(both)"
                  : "";

          const duty =
            isWeekend && !isWeek
              ? "Weekend"
              : isWeek && !isWeekend
                ? "Week"
                : isWeekend && isWeek
                  ? "Weekend + Week"
                  : "";

          return (
            <tr key={i}>
              <td>{formatUK(r.weekCommencing)}</td>
              <td>{duty}</td>
              <td>{buddy}</td>
            </tr>
          );
        })}
    </tbody>
  </table>
</div>

  </div>
</div>

        
      

      </div>
    </div>
  );
}
