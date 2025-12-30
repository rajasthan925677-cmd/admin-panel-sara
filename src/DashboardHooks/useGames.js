import { useState, useEffect } from "react";
import * as gameService from "../DashboardServices/GamesService";

const useGames = () => {
  const [games, setGames] = useState([]);
  const [editedGames, setEditedGames] = useState({});
  const [newGames, setNewGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);

  const fetchGames = async () => {
    setLoadingGames(true);
    try {
      const gamesData = await gameService.getGames();
      const sortedGames = [...gamesData].sort((a, b) => a.openTime.localeCompare(b.openTime));
      setGames(sortedGames);

      const editState = {};
      sortedGames.forEach(game => {
        editState[game.id] = { ...game, enabled: game.enabled ?? true, isEditing: false };
      });
      setEditedGames(editState);
    } catch (err) {
      console.error("Error fetching games:", err);
    } finally {
      setLoadingGames(false);
    }
  };

  const saveGame = async (id) => {
    if (window.confirm("⚠️ Are you sure you want to update this game?")) {
      try {
        const updatedGame = { ...editedGames[id], isEditing: false };
        await gameService.updateGame(id, updatedGame);
        setGames(prevGames =>
          prevGames.map(game =>
            game.id === id ? { ...game, ...updatedGame } : game
          ).sort((a, b) => a.openTime.localeCompare(b.openTime))
        );
        setEditedGames(prev => ({
          ...prev,
          [id]: { ...updatedGame, isEditing: false },
        }));
      } catch (err) {
        console.error("Error updating game:", err);
        alert("Failed to update game: " + err.message);
      }
    }
  };

  const deleteGame = async (id) => {
    if (window.confirm("⚠️ Are you sure you want to DELETE this game?")) {
      try {
        await gameService.deleteGame(id);
        setGames(prevGames => prevGames.filter(game => game.id !== id));
        setEditedGames(prev => {
          const newState = { ...prev };
          delete newState[id];
          return newState;
        });
      } catch (err) {
        console.error("Error deleting game:", err);
        alert("Failed to delete game: " + err.message);
      }
    }
  };

  const addNewGameRow = () => {
    setNewGames([...newGames, { gameName: "", openTime: "", closeTime: "", openResult: "", closeResult: "", enabled: true }]);
  };

  const handleNewGameChange = (index, field, value) => {
    const updated = [...newGames];
    updated[index][field] = value;
    setNewGames(updated);
  };

  const saveNewGame = async (index) => {
    if (window.confirm("⚠️ Are you sure you want to add this game?")) {
      try {
        const newGame = { ...newGames[index] };
        console.log("Attempting to add new game with data:", newGame); // डिबगिंग के लिए
        const docRef = await gameService.addGame(newGame);
        if (!docRef || !docRef.id) {
          throw new Error("Failed to get document reference for new game");
        }
        console.log("New game added with ID:", docRef.id); // डिबगिंग के लिए
        setNewGames(prev => prev.filter((_, i) => i !== index));
        setGames(prevGames =>
          [...prevGames, { id: docRef.id, ...newGame }].sort((a, b) => a.openTime.localeCompare(b.openTime))
        );
        setEditedGames(prev => ({
          ...prev,
          [docRef.id]: { ...newGame, isEditing: false },
        }));
      } catch (err) {
        console.error("Error adding new game:", err);
        alert("Failed to add game: " + err.message);
      }
    }
  };

  const toggleEditMode = (id) => {
    setEditedGames(prev => ({
      ...prev,
      [id]: { ...prev[id], isEditing: !prev[id].isEditing },
    }));
  };

  useEffect(() => { fetchGames(); }, []);

  return { games, editedGames, setEditedGames, newGames, addNewGameRow, handleNewGameChange, saveGame, deleteGame, saveNewGame, toggleEditMode, loadingGames };
};

export default useGames;