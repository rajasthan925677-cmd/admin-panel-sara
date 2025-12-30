import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc } from "firebase/firestore";

const gamesCol = collection(db, "games");

export const getGames = async () => {
  try {
    const snapshot = await getDocs(gamesCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error("Error fetching games:", err);
    throw err;
  }
};

export const updateGame = async (id, data) => {
  try {
    console.log("Updating game with ID:", id, "Data:", data); // डिबगिंग के लिए
    const docRef = doc(db, "games", id);
    await updateDoc(docRef, data);
  } catch (err) {
    console.error("Error updating game:", err);
    throw err;
  }
};

export const deleteGame = async (id) => {
  try {
    console.log("Deleting game with ID:", id); // डिबगिंग के लिए
    const docRef = doc(db, "games", id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("Error deleting game:", err);
    throw err;
  }
};

export const addGame = async (data) => {
  try {
    console.log("Adding game with data:", data); // डिबगिंग के लिए
    if (!data || Object.keys(data).length === 0) {
      throw new Error("Invalid game data: Data is empty or undefined");
    }
    const docRef = await addDoc(gamesCol, data);
    if (!docRef.id) {
      throw new Error("Failed to get document ID after adding game");
    }
    console.log("Game added successfully with ID:", docRef.id); // डिबगिंग के लिए
    return docRef;
  } catch (err) {
    console.error("Error adding game:", err);
    throw err;
  }
};