// src/services/peopleService.js
import { db } from "../firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

const col = collection(db, "people");

export function subscribePeople(onChange) {
  // sort by name (you can change to createdAt if you prefer)
  const q = query(col, orderBy("name", "asc"));

  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    onChange(list);
  });
}

// ✅ now supports phone + active
export async function addPerson(name, phone = "") {
  const cleanName = String(name || "").trim();
  const cleanPhone = String(phone || "").trim();
  if (!cleanName) throw new Error("Name is required.");

  return addDoc(col, {
    name: cleanName,
    phone: cleanPhone,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updatePerson(personId, patch) {
  if (!personId) throw new Error("Missing personId");
  const ref = doc(db, "people", personId);

  // only allow known fields (keeps it tidy)
  const safePatch = {};
  if ("name" in patch) safePatch.name = String(patch.name || "").trim();
  if ("phone" in patch) safePatch.phone = String(patch.phone || "").trim();
  if ("active" in patch) safePatch.active = !!patch.active;

  safePatch.updatedAt = serverTimestamp();
  return updateDoc(ref, safePatch);
}

export async function deletePerson(personId) {
  if (!personId) throw new Error("Missing personId");
  const ref = doc(db, "people", personId);
  return deleteDoc(ref);
}
