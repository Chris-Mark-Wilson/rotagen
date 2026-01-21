import React, { useMemo, useState, useEffect } from "react";
import { addPerson, updatePerson, deletePerson } from "../services/peopleService";

export default function PeopleManagerModal({ open, onClose, people }) {
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) {
      setNewName("");
      setNewPhone("");
      setErr("");
    }
  }, [open]);

  const sorted = useMemo(() => {
    return [...(people || [])].sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""))
    );
  }, [people]);

  if (!open) return null;

  async function handleAdd() {
    setErr("");
    const name = newName.trim();
    const phone = newPhone.trim();
    if (!name) return;

    try {
      await addPerson(name, phone);
      setNewName("");
      setNewPhone("");
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function handleSave(personId, patch) {
    setErr("");
    try {
      await updatePerson(personId, patch);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function handleDelete(personId, name) {
    setErr("");
    const ok = window.confirm(`Delete "${name}"?\n\nThis removes them from the database.`);
    if (!ok) return;

    try {
      await deletePerson(personId);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(780px, 96vw)",
          maxHeight: "88vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          color: "black",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <h3 style={{ margin: 0 }}>Edit people</h3>
          <button type="button" onClick={onClose} style={{ padding: "8px 10px" }}>
            Close
          </button>
        </div>

        <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Add person</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name…"
              style={{ padding: 8 }}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone…"
              style={{ padding: 8 }}
              type="tel"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <button type="button" onClick={handleAdd} style={{ padding: "8px 12px" }}>
              Add
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            Tip: phone can be blank for now.
          </div>
        </div>

        {err ? (
          <div
            style={{
              marginTop: 10,
              background: "#ffecec",
              border: "1px solid #ffb3b3",
              padding: 10,
              borderRadius: 6,
            }}
          >
            {err}
          </div>
        ) : null}

        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>People</div>

          <div style={{ display: "grid", gap: 8 }}>
            {sorted.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ))}

            {sorted.length === 0 ? (
              <div style={{ padding: 10, opacity: 0.75 }}>
                No people in the database yet.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonRow({ person, onSave, onDelete }) {
  const [name, setName] = useState(person.name || "");
  const [phone, setPhone] = useState(person.phone || "");
  const [active, setActive] = useState(person.active !== false); // default true

  // keep row inputs in sync if firestore updates
  useEffect(() => {
    setName(person.name || "");
    setPhone(person.phone || "");
    setActive(person.active !== false);
  }, [person.id, person.name, person.phone, person.active]);

  const dirty =
    name.trim() !== String(person.name || "").trim() ||
    phone.trim() !== String(person.phone || "").trim() ||
    (active !== (person.active !== false));

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 10,
        padding: 10,
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto auto auto",
        gap: 8,
        alignItems: "center",
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} style={{ padding: 8 }} />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        style={{ padding: 8 }}
        type="tel"
      />

      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
        <input checked={active} onChange={(e) => setActive(e.target.checked)} type="checkbox" />
        Active
      </label>

      <button
        type="button"
        disabled={!dirty}
        onClick={() => onSave(person.id, { name, phone, active })}
        style={{ padding: "8px 10px" }}
      >
        Save
      </button>

      <button
        type="button"
        onClick={() => onDelete(person.id, person.name)}
        style={{ padding: "8px 10px" }}
      >
        Delete
      </button>
    </div>
  );
}
