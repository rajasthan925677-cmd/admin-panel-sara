import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { auth } from "./firebase";          // agar path alag hai to "./../firebase" kar lena



import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import UserDetail from "./DashboardUI/UserDetail";
import BidHistory from "./DashboardUI/BidHistory";
import WinHistory from "./DashboardUI/WinHistory";
import SendNotification from "./components/SendNotification";
import SetBackendUrl from "./components/SetBackendUrl"; // Added import for SetBackendUrl
import ResultDeclare from "./DashboardUI/ResultDeclare";
import TickerWhatsAppPage from "./pages/TickerWhatsAppPage";
import QRpayRequest from "./DashboardUI/QRpayRequest";
import AddFundRequests from "./DashboardUI/AddFundRequests";
import WithdrawRequests from "./DashboardUI/WithdrawRequests";
import DownloadUsers from "./DashboardUI/DownloadUsers";
import ResetUserPassword from "./components/ResetUserPassword"; // ✅ Import ResetUserPassword page
import UsersTable from "./DashboardUI/UsersTable"; // नया: Direct UsersTable import

// Simple auth check (can be replaced by context or state management)
// const PrivateRoute = ({ children }) => {
//   const isLoggedIn = !!localStorage.getItem("adminLoggedIn");
//   return isLoggedIn ? children : <Navigate to="/login" />;
// };

const PrivateRoute = ({ children }) => {
  const navigate = useNavigate();

  const isLoggedIn = React.useMemo(
    () => localStorage.getItem("adminLoggedIn") === "true",
    []
  );
  const savedUID = React.useMemo(() => localStorage.getItem("adminUID"), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isLoggedIn || !savedUID) return;

    const interval = setInterval(() => {
      onAuthStateChanged(auth, (user) => {
        if (!user || user.uid !== savedUID) {
          localStorage.removeItem("adminLoggedIn");
          localStorage.removeItem("adminUID");
          signOut(auth);
          navigate("/login", { replace: true });
        }
      });
    }, 60000); 

    return () => clearInterval(interval);
  }, [navigate]);

  if (!isLoggedIn || !savedUID) {
    return <Navigate to="/login" replace />;
  }

  return children;
};






const AppRouter = () => {
  return (
    <Router>
      <Routes>
        {/* Login page */}
        <Route path="/login" element={<Login />} />

        {/* Protected Dashboard */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        {/* नया: Protected Users Management page – Direct UsersTable */}
        <Route
          path="/users"
          element={
            <PrivateRoute>
              <UsersTable />
            </PrivateRoute>
          }
        />

        {/* Protected User Detail page */}
        <Route
          path="/user-detail/:mobile"
          element={
            <PrivateRoute>
              <UserDetail />
            </PrivateRoute>
          }
        />

        {/* Protected Bid History page */}
        <Route
          path="/bid-history"
          element={
            <PrivateRoute>
              <BidHistory />
            </PrivateRoute>
          }
        />

        {/* Protected Win History page */}
        <Route
          path="/win-history"
          element={
            <PrivateRoute>
              <WinHistory />
            </PrivateRoute>
          }
        />

        {/* Protected Send Notification page */}
        <Route
          path="/send-notification"
          element={
            <PrivateRoute>
              <SendNotification />
            </PrivateRoute>
          }
        />

        {/* Protected Set Backend URL page */}
        <Route
          path="/set-backend-url"
          element={
            <PrivateRoute>
              <SetBackendUrl />
            </PrivateRoute>
          }
        />

        {/* Protected Declare Result page */}
        <Route
          path="/declare-result"
          element={
            <PrivateRoute>
              <ResultDeclare />
            </PrivateRoute>
          }
        />

        {/* Protected Ticker and WhatsApp page */}
        <Route
          path="/ticker-whatsapp"
          element={
            <PrivateRoute>
              <TickerWhatsAppPage />
            </PrivateRoute>
          }
        />

        {/* Protected QR Pay Requests page */}
        <Route
          path="/qr-pay-requests"
          element={
            <PrivateRoute>
              <QRpayRequest />
            </PrivateRoute>
          }
        />

        {/* Protected Add Fund Requests page */}
        <Route
          path="/add-fund-requests"
          element={
            <PrivateRoute>
              <AddFundRequests />
            </PrivateRoute>
          }
        />

        {/* Protected Withdraw Requests page */}
        <Route
          path="/withdraw-requests"
          element={
            <PrivateRoute>
              <WithdrawRequests />
            </PrivateRoute>
          }
        />

        {/* ✅ Protected Reset User Password page */}
        <Route
          path="/reset-user-password"
          element={
            <PrivateRoute>
              <ResetUserPassword />
            </PrivateRoute>
          }
        />

        {/* Protected Download Users Excel page */}
        <Route
          path="/download-users"
          element={
            <PrivateRoute>
              <DownloadUsers />
            </PrivateRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

export default AppRouter;