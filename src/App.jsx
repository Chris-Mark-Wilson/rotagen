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

/**
 * Deterministic "linear" generator with duty-type balancing:
 * - Prefer people with fewer of the current duty type
 * - Prefer people whose Weekend and Week counts are closest (balance)
 * - Still iterates from a moving pointer so it feels sequential
 * - Constraints at generation time:
 *   - No duplicates in the same week
 *   - If someone does Weekend in week W, they cannot do ANY duty in week W+1
 */
function generateRotaLinearBalanced({ names, startFriday, weeks }) {
  const cleanNames = (names || []).map((n) => String(n).trim()).filter(Boolean);

  if (cleanNames.length < 3) {
    return {
      rows: [],
      error: "You need at least 3 names for the weekend-cooldown rule to work.",
    };
  }
  if (!weeks || weeks < 1) {
    return { rows: [], error: "Number of weeks must be at least 1." };
  }

  const weekendCount = new Map(cleanNames.map((n) => [n, 0]));
  const weekCount = new Map(cleanNames.map((n) => [n, 0]));

  let pWeekend = 0;
  let pWeek = 0;

  function pickCandidate(type, excludeSet) {
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
      const balance = type === "weekend" ? wEnd - wDay : wDay - wEnd;

      const score = [dutyCount, balance, k]; // lower is better

      const better =
        !bestScore ||
        score[0] < bestScore[0] ||
        (score[0] === bestScore[0] && score[1] < bestScore[1]) ||
        (score[0] === bestScore[0] &&
          score[1] === bestScore[1] &&
          score[2] < bestScore[2]);

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
  let prevWeekend = null;

  for (let w = 0; w < weeks; w++) {
    const exclude = new Set();
    if (prevWeekend) exclude.add(prevWeekend); // cooldown: prev weekend person cannot do anything this week

    const weekend = pickCandidate("weekend", exclude);
    if (!weekend) {
      return {
        rows: [],
        error: "Could not allocate Weekend duty with current names/rules.",
      };
    }

    exclude.add(weekend); // no duplicates same week

    const weekDuty = pickCandidate("week", exclude);
    if (!weekDuty) {
      return {
        rows: [],
        error: "Could not allocate Week duty with current names/rules.",
      };
    }

    weekendCount.set(weekend, (weekendCount.get(weekend) || 0) + 1);
    weekCount.set(weekDuty, (weekCount.get(weekDuty) || 0) + 1);

    rows.push({
      weekCommencing: addDays(startFriday, w * 7),
      weekend,
      week: weekDuty,
    });

    prevWeekend = weekend;
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
  const [selectedNames, setSelectedNames] = useState([]); // names picked for generation

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

  // Global actions: swap / cover (two-person pick via ShiftCounter chips)
  const [twoPickMode, setTwoPickMode] = useState(null); // null | "swap" | "cover"
  const [twoPicked, setTwoPicked] = useState([]); // [first, second]
  const [peopleSwapError, setPeopleSwapError] = useState("");
  const [peopleCoverError, setPeopleCoverError] = useState("");

  const startFriday = useMemo(() => {
    const picked = new Date(startDateISO + "T00:00:00");
    return getNextOrSameFriday(picked);
  }, [startDateISO]);

  const activeNameSet = useMemo(() => buildActiveNameSetFromRota(rotaRows), [rotaRows]);

  // Subscribe Firestore people
  useEffect(() => {
    const unsub = subscribePeople((list) => {
      setPeople(list);
      setSelectedNames((prev) => (prev.length ? prev : list.map((p) => p.name)));
    });
    return () => unsub();
  }, []);

  // -------- Two-person pick logic (shared by swap + cover) --------
  const canApplyTwoPicked = twoPicked.length === 2 && twoPicked[0] && twoPicked[1] && twoPicked[0] !== twoPicked[1];

  function toggleTwoPick(name) {
    if (!twoPickMode) return;

    // clear mode-specific error when picking
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
      // IMPORTANT: first = covering, second = covered
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

    // When loading, restore who was "signed up" if present
    if (Array.isArray(s?.names)) setSelectedNames(s.names);

    if (Array.isArray(rows)) {
      setRotaRows(
        rows.map((r) => ({
          weekCommencing: new Date((r.weekCommencingISO || "1970-01-01") + "T00:00:00"),
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
  }

  // -------- Cell swap interactions --------
  function handleCellClick(sel) {
    if (!swapMode) return;
    setSwapError("");

    setSwapSelection((prev) => {
      const exists = prev.find((p) => p.weekIndex === sel.weekIndex && p.slot === sel.slot);
      if (exists) return prev.filter((p) => !(p.weekIndex === sel.weekIndex && p.slot === sel.slot));
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
        />

        <div style={{ marginTop: 10 }}>
          <RotaTable
            rows={rotaRows}
            swapMode={swapMode}
            selected={swapSelection}
            onCellClick={handleCellClick}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          {/* Swap panel (same as before, but selection is via ShiftCounter chips) */}
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

        <ShiftCounter
          rows={rotaRows}
          pickMode={twoPickMode != null}
          selectedPeople={twoPicked}
          onPersonClick={toggleTwoPick}
        />
      </div>
    </div>
  );
}
