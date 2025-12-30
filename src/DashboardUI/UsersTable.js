import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // for navigation
import useUsers from "../DashboardHooks/useUsers"; // Hook import ऐड

const UsersTable = () => { // Props रिमूव – Standalone
  const navigate = useNavigate();
  const { users, editedUsers, setEditedUsers, loadingUsers, saveUser, deleteUser } = useUsers(); // Hook यूज
  const [editMode, setEditMode] = useState({}); // Track edit mode per user
  const [searchMobile, setSearchMobile] = useState(""); // Local search state

  const handleEditToggle = (id) => {
    setEditMode(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = async (id) => {
    if (window.confirm("⚠️ Are you sure you want to update this user?")) {
      try {
        await saveUser(id);
        setEditMode(prev => ({ ...prev, [id]: false })); // Turn off edit mode after save
      } catch (err) {
        console.error(err);
        alert("Failed to update user.");
      }
    }
  };

  // Back Button हैंडलर
  const handleBack = () => {
    navigate('/'); // Dashboard पर लौटें
  };

  // Safe users: undefined को empty array मान लें
  const safeUsers = users || [];

  if (loadingUsers) {
    return <div style={{ textAlign: "center", marginTop: "70px", fontSize: "18px" }}>Loading users...</div>;
  }

  return (
    <div style={{ marginTop: "70px", minHeight: "100vh" }}> {/* Full page height */}
      {/* Page Header with Back Button */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
        <button
          onClick={handleBack}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            backgroundColor: "#2563eb", color: "white", fontWeight: "600",
            padding: "8px 16px", borderRadius: "8px", border: "none",
            cursor: "pointer", transition: "background-color 0.3s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#1e40af")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
        >
          ← Back to Dashboard
        </button>
        <h2 style={{ textAlign: "center", marginLeft: "auto", marginBottom: "0", textDecoration: "underline", fontSize: "50px", color: "#0f65f0ff", flex: 1 }}>
          Users Management
        </h2>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by Mobile"
          style={{ padding: "6px", borderRadius: "5px", border: "1px solid #dcdde1", width: "200px", marginBottom: "10px" }}
          value={searchMobile}
          onChange={(e) => setSearchMobile(e.target.value)}
        />
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th>Sr. No.</th>
            <th>Name</th>
            <th>Mobile</th>
            <th>Role</th>
            <th>Balance</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(safeUsers.filter(user => user.mobile.includes(searchMobile))).map((user, index) => ( // Safe filter
            <tr key={user.id}>
              <td><input style={styles.input} value={index + 1} readOnly /> {/* नया: Sr. No. को input बॉक्स में डाला – बाकी जैसा दिखेगा */}</td>
              <td><input style={styles.input} value={editedUsers[user.id]?.name || ""} readOnly={!editMode[user.id]} onChange={(e) => setEditedUsers({...editedUsers, [user.id]: {...editedUsers[user.id], name: e.target.value}})} /></td>
              
              {/* Mobile Column as Button */}
              <td>
                <button style={styles.linkButton} onClick={() => navigate(`/user-detail/${user.mobile}`)}>
                  {user.mobile}
                </button>
              </td>

              <td><input style={styles.input} value={editedUsers[user.id]?.role || ""} readOnly={!editMode[user.id]} onChange={(e) => setEditedUsers({...editedUsers, [user.id]: {...editedUsers[user.id], role: e.target.value}})} /></td>
              
              <td><input style={styles.input} type="number" value={editedUsers[user.id]?.balance || 0} readOnly={!editMode[user.id]} onChange={(e) => setEditedUsers({...editedUsers, [user.id]: {...editedUsers[user.id], balance: Number(e.target.value)}})} /></td>
              
              <td>
                <div style={{ display: "flex", gap: "5px", flexWrap: "nowrap" }}>
                  <button
                    style={editMode[user.id] ? styles.saveBtn : styles.editBtn}
                    onClick={() => editMode[user.id] ? handleSave(user.id) : handleEditToggle(user.id)}
                  >
                    {editMode[user.id] ? "Save" : "Edit"}
                  </button>
                  <button style={styles.deleteBtn} onClick={() => deleteUser(user.id)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const styles = {
  table: { width: "100%", borderCollapse: "collapse", marginTop: "10px", minWidth: "700px" },
  input: { padding: "6px", borderRadius: "5px", border: "1px solid #dcdde1", width: "100%", boxSizing: "border-box" },
  saveBtn: { backgroundColor: "#00a8ff", color: "#fff", border: "none", padding: "5px 10px", marginRight: "5px", borderRadius: "5px", cursor: "pointer" },
  editBtn: { backgroundColor: "#4CAF50", color: "#fff", border: "none", padding: "5px 10px", marginRight: "5px", borderRadius: "5px", cursor: "pointer" },
  deleteBtn: { backgroundColor: "#e84118", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "5px", cursor: "pointer" },
  linkButton: { background: "none", borderRadius: "5px", border: "1px solid #dcdde1", color: "#0f65f0", width: "100%", textDecoration: "underline", cursor: "pointer", padding: "6px", font: "inherit" }
};

export default UsersTable;