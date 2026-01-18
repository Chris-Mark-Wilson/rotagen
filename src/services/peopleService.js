import { collection, onSnapshot, addDoc, query, orderBy } from "firebase/firestore";
import { db } from "../firebase"; // adjust path if yours differs

const peopleCol = collection(db, "people");

export function subscribePeople(callback) {
  const q = query(peopleCol, orderBy("name", "asc"));
  return onSnapshot(q, (snap) => {
    const people = snap.docs.map((d) => ({
      id: d.id,
      name: (d.data()?.name ?? "").trim(),
    })).filter(p => p.name.length > 0);
    callback(people);
  });
}

export async function addPerson(name) {
  const clean = String(name ?? "").trim();
  if (!clean) return;
  await addDoc(peopleCol, { name: clean });
}
