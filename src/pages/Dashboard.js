import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import SideBar from "../DashboardUI/SideBar";
import TopBar from "../DashboardUI/TopBar";
import AdminUPI from "../DashboardUI/AdminUPI";
import GamesTable from "../DashboardUI/GamesTable";
import StatsCards from "../DashboardUI/StatsCards";

import useAdminUPI from "../DashboardHooks/useAdminUPI";
import useGames from "../DashboardHooks/useGames";
import useUsers from "../DashboardHooks/useUsers";
import useTotalBidAmountToday from "../DashboardHooks/useTotalBidAmountToday";

const Dashboard = () => {
  const [activeCard, setActiveCard] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [showAdminUPI, setShowAdminUPI] = useState(false);

  const { adminUPI, setAdminUPI, updateAdminUPI, qrPayUPI, setQRPayUPI, updateQRPayUPI } = useAdminUPI();
  const { games, editedGames, setEditedGames, newGames, addNewGameRow, handleNewGameChange, saveGame, deleteGame, saveNewGame, toggleEditMode, loadingGames } = useGames();
  const { users } = useUsers();
  const { totalBidAmount } = useTotalBidAmountToday();

  const handleLogout = () => {
    localStorage.removeItem("adminLoggedIn");
    window.location.href = "/login";
  };

  useEffect(() => {
  }, [activeCard]);

  if (activeCard === "bidHistory") {
    return <Navigate to="/bid-history" replace />;
  }
  if (activeCard === "winHistory") {
    return <Navigate to="/win-history" replace />;
  }
  if (activeCard === "qrPayRequests") {
    return <Navigate to="/qr-pay-requests" replace />;
  }
  if (activeCard === "addFundRequests") {
    return <Navigate to="/add-fund-requests" replace />;
  }

  return (
    <div style={{ display: "flex", fontFamily: "Arial, sans-serif" }}>
      {showSidebar && <SideBar setActiveCard={setActiveCard} />}
      <div style={{ flex: 1, padding: "20px", boxSizing: "border-box" }}>
        <TopBar
          showSidebar={showSidebar}
          setShowSidebar={setShowSidebar}
          showAdminUPI={showAdminUPI}
          setShowAdminUPI={setShowAdminUPI}
          handleLogout={handleLogout}
        />

        {showAdminUPI && (
          <AdminUPI
            adminUPI={adminUPI}
            setAdminUPI={setAdminUPI}
            updateAdminUPI={updateAdminUPI}
            qrPayUPI={qrPayUPI}
            setQRPayUPI={setQRPayUPI}
            updateQRPayUPI={updateQRPayUPI}
          />
        )}

        <StatsCards
          usersCount={users?.length || 0}
          gamesCount={games?.length || 0}
          totalBidAmount={totalBidAmount}
          setActiveCard={setActiveCard}
        />

        {activeCard === "games" && (
          <GamesTable
            games={games}
            editedGames={editedGames}
            setEditedGames={setEditedGames}
            newGames={newGames}
            addNewGameRow={addNewGameRow}
            handleNewGameChange={handleNewGameChange}
            saveGame={saveGame}
            deleteGame={deleteGame}
            saveNewGame={saveNewGame}
            toggleEditMode={toggleEditMode}
            loadingGames={loadingGames}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;