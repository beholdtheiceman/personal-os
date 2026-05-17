// Thin wrappers around Firestore for common operations
// All data is stored under users/{userId}/collectionName so each user's data is isolated
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// Get a reference to a user's sub-collection
export const userCol = (userId: string, col: string) =>
  collection(db, "users", userId, col);

// Get a reference to a document inside a user's sub-collection
export const userDoc = (userId: string, col: string, docId: string) =>
  doc(db, "users", userId, col, docId);

// Add a new document (auto-generated ID)
export async function addUserDoc(
  userId: string,
  col: string,
  data: Record<string, unknown>
) {
  return addDoc(userCol(userId, col), {
    ...data,
    created_at: new Date().toISOString(),
  });
}

// Set a document with a specific ID (overwrites)
export async function setUserDoc(
  userId: string,
  col: string,
  docId: string,
  data: Record<string, unknown>
) {
  return setDoc(userDoc(userId, col, docId), data, { merge: true });
}

// Update specific fields on a document
export async function updateUserDoc(
  userId: string,
  col: string,
  docId: string,
  data: Record<string, unknown>
) {
  return updateDoc(userDoc(userId, col, docId), data);
}

// Delete a document
export async function deleteUserDoc(
  userId: string,
  col: string,
  docId: string
) {
  return deleteDoc(userDoc(userId, col, docId));
}

// Get all documents in a collection, ordered by a field
export async function getUserDocs<T>(
  userId: string,
  col: string,
  orderByField = "created_at",
  descending = true
): Promise<T[]> {
  const q = query(
    userCol(userId, col),
    orderBy(orderByField, descending ? "desc" : "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}
