import { useMemo, useState } from "react";
import { addPerson } from "../services/peopleService";

export default function PeoplePicker({
  people,
  selectedNames,
  setSelectedNames,
  activeNameSet,
}) {
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");

  const peopleNames = useMemo(() => people.map((p) => p.name), [people]);

  const toggleSelected = (name) => {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const handleAdd = async () => {
    setAddError("");
    const name = newName.trim();
    if (!name) return;

    try {
      await addPerson(name);
      setNewName("");
    } catch (err) {
      console.error("addPerson failed:", err);
      setAddError(err?.message || String(err));
    }
  };
return (
  <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
      <strong style={{ color: "black", backgroundColor: "#a58d8d",padding:8 }}>People</strong>

      <button
        type="button"
        onClick={() => setSelectedNames(peopleNames)}
        style={{ padding: "6px 10px", cursor: "pointer" }}
      >
        Select all
      </button>

      <button
        type="button"
        onClick={() => setSelectedNames([])}
        style={{ padding: "6px 10px", cursor: "pointer" }}
      >
        Clear
      </button>

      <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8, color: "black",backgroundColor:"#a58d8d",padding:"4px 8px",borderRadius:4 }}>
        Selected: <b>{selectedNames?.length ?? 0}</b>
      </span>
    </div>

    {/* Chips list */}
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      {people.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.8, color: "black" }}>
          No people yet — add one below.
        </div>
      ) : (
        people.map((p) => {
          const name = p.name;
          const selected = selectedNames?.includes(name);
          const active = activeNameSet?.has?.(name);

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleSelected(name)}
              title={active ? "Active in current rota" : "Not in current rota"}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #bbb",
                cursor: "pointer",
                color: "black",
                background: selected ? "#e7f1ff" : "#f7f7f7",
                opacity: active ? (selected ? 1 : 0.8) : (selected ? 0.7 : 0.45),

                fontWeight: selected ? 700 : 400,
              }}
            >
              {active ? "✔️ " : ""}
              {name}
            </button>
          );
        })
      )}
    </div>

    {/* Add person */}
    <div style={{ display: "flex", gap: 8 }}>
      <input
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="Add a name…"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
        }}
        style={{ flex: 1, padding: 8 }}
      />
      <button type="button" onClick={handleAdd} style={{ padding: "8px 12px" }}>
        Add
      </button>
    </div>

    {/* Status / error */}
    {addError ? (
      <div
        style={{
          marginTop: 8,
          background: "#ffecec",
          border: "1px solid #ffb3b3",
          color: "black",
          padding: 10,
          borderRadius: 6,
        }}
      >
        {addError}
      </div>
    ) : (
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8, color: "black",backgroundColor:"#f0f0f0",padding:6,borderRadius:4 }}>
        ✔️ = appears in the currently loaded rota (derived automatically)
      </div>
    )}
  </div>
);

 
}
