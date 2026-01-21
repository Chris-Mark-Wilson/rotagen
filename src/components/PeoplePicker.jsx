import { useMemo } from "react";

export default function PeoplePicker({
  people,
  selectedNames,
  setSelectedNames,
  activeNameSet,
  onEditPeople,
  user
}) {
  const peopleNames = useMemo(() => people.map((p) => p.name), [people]);

  const toggleSelected = (name) => {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  return (
    <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <strong style={{ color: "black", backgroundColor: "#a58d8d", padding: 8 }}>
          People
        </strong>

        <button
          type="button"
          onClick={() => setSelectedNames(peopleNames)}
          style={{ padding: "6px 10px", cursor: "pointer" }}
          disabled={people.length === 0}
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
        <button
          type="button"
          onClick={onEditPeople}
          disabled={!user}
          title={user ? "" : "Sign in to edit people"}
          style={{
            padding: "6px 10px",
            cursor: user ? "pointer" : "not-allowed",
            opacity: user ? 1 : 0.5,
          }}
        >
          Edit people
        </button>

     
   

        <span
          style={{
            marginLeft: "auto",
            fontSize: 12,
            opacity: 0.8,
            color: "black",
            backgroundColor: "#a58d8d",
            padding: "4px 8px",
            borderRadius: 4,
          }}
        >
          Selected: <b>{selectedNames?.length ?? 0}</b>
        </span>
      </div>

      {/* Chips list */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {people.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.8, color: "black", backgroundColor: "#f0f0f0", padding: 6, borderRadius: 4  }}>
            No people yet — click <b>Edit people</b> to add names + phone numbers.
          </div>
        ) : (
          people.map((p) => {
            const name = p.name;
            const selected = selectedNames?.includes(name);
            const activeInRota = activeNameSet?.has?.(name);
            const active = p.active !== false;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleSelected(name)}
                title={
                  activeInRota
                    ? "Active in current rota"
                    : "Not in current rota"
                }
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid #bbb",
                  cursor: "pointer",
                  color: "black",
                  background: selected ? "#e7f1ff" : "#f7f7f7",
                  // inactive people look muted but still selectable if you want
                  opacity: active ? (selected ? 1 : 0.8) : 0.35,
                  fontWeight: selected ? 700 : 400,
                }}
              >
                {activeInRota ? "✔️ " : ""}
                {name}
              </button>
            );
          })
        )}
      </div>

      <div
        style={{
          fontSize: 12,
          opacity: 0.7,
          marginTop: 8,
          color: "black",
          backgroundColor: "#f0f0f0",
          padding: 6,
          borderRadius: 4,
        }}
      >
        ✔️ = appears in the currently loaded rota (derived automatically)
      </div>
    </div>
  );
}
