import React, { useEffect, useMemo, useState } from "react";
import { auth, db, googleProvider } from "../firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

function fmtLocal(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function RotaStore({ names, weeks, startDateISO, rotaRows, onLoadPayload, revision, setRevision }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("");
  const [items, setItems] = useState([]);

  // A simple "group key" so different settings can have their own revision stream
  const rotaKey = useMemo(() => `${startDateISO}_${Number(weeks) || 0}`, [startDateISO, weeks]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  async function login() {
    setStatus("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setStatus(e?.message || "Sign-in failed.");
    }
  }

  async function logout() {
    setStatus("");
    try {
      await signOut(auth);
    } catch (e) {
      setStatus(e?.message || "Sign-out failed.");
    }
  }

  async function refreshList() {
    setStatus("");
    try {
      const col = collection(db, "rota_revisions");
      const q = query(col, where("rotaKey", "==", rotaKey), orderBy("revision", "desc"), limit(30));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(rows);
    } catch (e) {
      setStatus(e?.message || "Failed to load revisions.");
    }
  }

  async function getNextRevision() {
    const col = collection(db, "rota_revisions");
    const q = query(col, where("rotaKey", "==", rotaKey), orderBy("revision", "desc"), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return 1;
    const top = snap.docs[0].data();
    return (Number(top.revision) || 0) + 1;
  }

  async function saveToFirestore() {
    setStatus("");
    // if (!user) {
    //   setStatus("Please sign in first.");
    //   return;
    // }
    if (!rotaRows || rotaRows.length === 0) {
      setStatus("Generate a rota first.");
      return;
    }

    try {
      const nextRev = await getNextRevision();

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
          weekCommencingISO: new Date(r.weekCommencing).toISOString().slice(0, 10),
          weekend: r.weekend,
          week: r.week,
        })),
      };

      await addDoc(collection(db, "rota_revisions"), {
        rotaKey,
        revision: nextRev,
        createdAt: serverTimestamp(),
        createdAtISO: new Date().toISOString(),
        ownerUid: user.uid,
        payload,
      });

      setRevision(nextRev);
      setStatus(`Saved revision ${nextRev}.`);
      await refreshList();
    } catch (e) {
      setStatus(e?.message || "Save failed.");
    }
  }

  function loadItemPayload(item) {
    if (!item?.payload) return;
    onLoadPayload(item.payload);
    if (typeof item.revision === "number") setRevision(item.revision);
  }

  useEffect(() => {
    // auto refresh when signed in or settings change
    setItems([]);
    if (user) refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, rotaKey]);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h4 style={{ margin: 0 }}>Cloud revisions (Firestore)</h4>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Rota key: <b>{rotaKey}</b></div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!user ? (
            <button onClick={login} style={{ padding: "10px 12px" }}>Sign in</button>
          ) : (
            <>
              <div style={{ fontSize: 12, opacity: 0.85, alignSelf: "center" }}>
                Signed in as <b>{user.email || user.uid}</b>
              </div>
              <button onClick={logout} style={{ padding: "10px 12px" }}>Sign out</button>
            </>
          )}
          <button onClick={saveToFirestore} disabled={/*!user*/ false} style={{ padding: "10px 12px" }}>
            Save to cloud (next rev)
          </button>
          <button onClick={refreshList} disabled={/*!user*/ false} style={{ padding: "10px 12px" }}>
            Refresh list
          </button>
        </div>
      </div>

      {status ? (
        <div style={{ marginTop: 10, background: "#fff3cd", border: "1px solid #ffeeba",color:"black", padding: 10, borderRadius: 6 }}>
          {status}
        </div>
      ) : null}

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
        Current local revision: <b>{revision || 0}</b>
      </div>

      <div style={{ marginTop: 10 }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {user ? "No revisions saved yet for this rota key." : "Sign in to see saved revisions."}
          </div>
        ) : (
          <table className="striped-table" style={{ width: "100%", marginTop: 8 }}>
            <thead>
              <tr>
                <th>Revision</th>
                <th>Saved</th>
                <th>Owner</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td><b>{it.revision}</b></td>
                  <td>{fmtLocal(it.createdAtISO)}</td>
                  <td style={{ fontSize: 12, opacity: 0.8 }}>{it.ownerUid?.slice?.(0, 8) || "-"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button onClick={() => loadItemPayload(it)} style={{ padding: "8px 10px" }}>
                      Load
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
