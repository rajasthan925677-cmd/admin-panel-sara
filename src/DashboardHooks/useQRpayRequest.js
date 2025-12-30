import { useState, useEffect, useCallback } from "react"; // useCallback ऐड किया
import {
  fetchQRPayRequests,
  updateQRPayRequestStatus,
  updateUserBalance,
} from "../DashboardServices/QRpayRequestServices";
import { collection, query, where, getDocs } from "firebase/firestore"; // Direct query के लिए import ऐड
import { db } from "../firebase"; // db import ऐड
import { format } from "date-fns";

const useQRpayRequest = () => {
  const [date, setDate] = useState(null);
  const [status, setStatus] = useState("all");
  const [mobile, setMobile] = useState("");
  const [requests, setRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0); // नया: pending काउंट state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filteredApprovedTotal, setFilteredApprovedTotal] = useState(0);

  // नई फंक्शन: सिर्फ pending requests का काउंट फेच करें (status फिल्टर इग्नोर, date/mobile अप्लाई)
  const fetchPendingCount = async (currentDate, currentMobile) => {
    try {
      let q = query(collection(db, "QRpayRequest"), where("requestStatus", "==", "pending")); // हमेशा pending

      // Apply mobile filter
      if (currentMobile) {
        if (!/^\d{10}$/.test(currentMobile)) {
          console.warn("Invalid mobile format for count:", currentMobile);
          setPendingCount(0);
          return;
        }
        q = query(q, where("mobile", "==", currentMobile));
      }

      // Apply date filter
      if (currentDate) {
        const formattedDate = format(currentDate, "dd/MM/yyyy");
        q = query(q, where("paymentDate", "==", formattedDate));
      }

      const snapshot = await getDocs(q);
      setPendingCount(snapshot.size); // सिर्फ size से काउंट
    } catch (err) {
      console.error("fetchPendingCount error:", err);
      setPendingCount(0);
    }
  };

  const normalizeMobile = (input) => {
    // Remove country code (+91), spaces, dashes, or other non-digits
    return input.replace(/^\+91|\D/g, "");
  };

  // handleSearch को useCallback में wrap – stable बनाने के लिए
  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const normalizedMobile = normalizeMobile(mobile);
     // console.log("Search parameters:", { date: date ? date.toISOString() : null, status, mobile, normalizedMobile });
      const fetchedRequests = await fetchQRPayRequests(date, status, normalizedMobile);
     // console.log("Fetched requests:", fetchedRequests.map(r => ({ id: r.id, mobile: r.mobile, paymentDate: r.paymentDate })));
      setRequests(fetchedRequests);


      // YAHAN ADD KARO → FILTERED APPROVED TOTAL CALCULATE
      const approvedTotal = fetchedRequests
        .filter(req => req.requestStatus === "approved")
        .reduce((sum, req) => sum + (parseFloat(req.amount) || 0), 0);

      setFilteredApprovedTotal(approvedTotal);



      
      // Pending काउंट फेच करें (status इग्नोर करके)
      const filtersForCount = { date, mobile: normalizedMobile, status: "all" };
      await fetchPendingCount(filtersForCount.date, filtersForCount.mobile);
    } catch (err) {
      console.error("fetchQRPayRequests error:", err);
      setError("Failed to fetch requests: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [date, status, mobile]); // Dependencies: date, status, mobile – stable रहेगा

  const clearFilters = () => {
    setDate(null);
    setStatus("all");
    setMobile("");
    setRequests([]);
    
    // Pending काउंट रीसेट (सभी pending)
    fetchPendingCount(null, "");
  };

  const handleAccept = async (requestId, amount, userId) => {
    try {
      setLoading(true);
      await updateQRPayRequestStatus(requestId, "approved");
      await updateUserBalance(userId, amount);
      setRequests((prev) =>
        prev.map((req) =>
          req.id === requestId ? { ...req, requestStatus: "approved" } : req
        )
      );
      
      // Pending काउंट अपडेट (क्योंकि accept से pending कम हो गया)
      await fetchPendingCount(date, normalizeMobile(mobile));
    } catch (err) {
      setError("Failed to accept request: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (requestId) => {
    try {
      setLoading(true);
      await updateQRPayRequestStatus(requestId, "rejected");
      setRequests((prev) =>
        prev.map((req) =>
          req.id === requestId ? { ...req, requestStatus: "rejected" } : req
        )
      );
      
      // Pending काउंट अपडेट (क्योंकि reject से pending कम हो गया)
      await fetchPendingCount(date, normalizeMobile(mobile));
    } catch (err) {
      setError("Failed to reject request: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial load: सभी requests और pending काउंट
 // useEffect(() => {
    // Initial fetch without filters
  //  handleSearch(); // ये status="all" के साथ सभी requests फेच करेगा
 // }, [handleSearch]); // Dependency ऐड: ESLint फिक्स (warning गया)

  return {
    date,
    setDate,
    status,
    setStatus,
    mobile,
    setMobile,
    requests,
    pendingCount, // नया: return किया
    loading,
    error,
    handleSearch,
    handleAccept,
    handleReject,
    clearFilters,

    filteredApprovedTotal,
  };
};

export default useQRpayRequest;