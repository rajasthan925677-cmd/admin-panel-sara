import { useState, useCallback, useEffect } from "react"; // useEffect ऐड किया
import { collection, getDocs, query, where, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const useWithdrawRequests = () => {
  const [requests, setRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0); // नया: pending काउंट state
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [filterValues, setFilterValues] = useState({ date: "", requestStatus: "", mobile: "" });
  const [appliedFilters, setAppliedFilters] = useState({ date: "", requestStatus: "", mobile: "" });

  const [filteredApprovedTotal, setFilteredApprovedTotal] = useState(0);

  // Convert yyyy-mm-dd -> dd/mm/yyyy
  const formatDateForQuery = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  // नई फंक्शन: सिर्फ pending requests का काउंट फेच करें (status फिल्टर इग्नोर, date/mobile अप्लाई)
  const fetchPendingCount = useCallback(async (filters) => {
    try {
      const colRef = collection(db, "withdraw_requests");
      const constraints = [where("requestStatus", "==", "pending")]; // हमेशा pending

      if (filters.mobile) constraints.push(where("mobile", "==", filters.mobile));
      if (filters.date) constraints.push(where("requestDate", "==", filters.date));

      const q = constraints.length ? query(colRef, ...constraints) : query(colRef, where("requestStatus", "==", "pending"));
      const snap = await getDocs(q);
      setPendingCount(snap.size); // सिर्फ size से काउंट (full data ना लोड करें)
    } catch (err) {
      console.error("fetchPendingCount error:", err);
      setPendingCount(0);
    }
  }, []);

  const fetchRequests = useCallback(async (filters) => {
    setLoadingRequests(true);
    try {
      const colRef = collection(db, "withdraw_requests");
      const constraints = [];

      if (filters.mobile) constraints.push(where("mobile", "==", filters.mobile));
      if (filters.requestStatus) constraints.push(where("requestStatus", "==", filters.requestStatus));
      if (filters.date) constraints.push(where("requestDate", "==", filters.date));

      const q = constraints.length ? query(colRef, ...constraints) : query(colRef);
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRequests(data);



// YAHAN ADD KARO → FILTERED APPROVED TOTAL
      const approvedTotal = data
        .filter(req => req.requestStatus === "accepted")
        .reduce((sum, req) => sum + (parseFloat(req.amount) || 0), 0);

      setFilteredApprovedTotal(approvedTotal);
      



    } catch (err) {
      console.error("fetchWithdrawRequests error:", err);
      setRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  // Apply filters (format date and fetch data with new filters)
  const applyFilters = () => {
    const formattedDate = filterValues.date ? formatDateForQuery(filterValues.date) : "";
    const newFilters = { ...filterValues, date: formattedDate };
    setAppliedFilters(newFilters);
    
    // Requests फेच करें (सभी फिल्टर्स के साथ)
    fetchRequests(newFilters);
    
    // Pending काउंट फेच करें (status इग्नोर करके)
    const filtersForCount = { ...newFilters, requestStatus: "" }; // status को क्लियर करें
    fetchPendingCount(filtersForCount);
  };

  // Clear filters
  const clearFilters = () => {
    const cleared = { date: "", requestStatus: "", mobile: "" };
    setFilterValues(cleared);
    setAppliedFilters(cleared);
    setRequests([]); // Clear requests when filters are cleared
    
    // Pending काउंट रीसेट (सभी pending)
    fetchPendingCount(cleared);
  };

  const handleAccept = async (id, userId, amount) => {
    try {
      await updateDoc(doc(db, "withdraw_requests", id), { requestStatus: "accepted" });

      // Deduct user balance
      const userSnap = await getDoc(doc(db, "users", userId));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const newBalance = (userData.balance || 0) - Number(amount || 0);
      await updateDoc(doc(db, "users", userId), { balance: newBalance });

      fetchRequests(appliedFilters); // Use current appliedFilters
      // Pending काउंट अपडेट (क्योंकि accept से pending कम हो गया)
      const filtersForCount = { ...appliedFilters, requestStatus: "" };
      fetchPendingCount(filtersForCount);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id) => {
    try {
      await updateDoc(doc(db, "withdraw_requests", id), { requestStatus: "rejected" });
      fetchRequests(appliedFilters); // Use current appliedFilters
      // Pending काउंट अपडेट (क्योंकि reject से pending कम हो गया)
      const filtersForCount = { ...appliedFilters, requestStatus: "" };
      fetchPendingCount(filtersForCount);
    } catch (err) {
      console.error(err);
    }
  };

  // Initial load: सभी requests और pending काउंट
//useEffect(() => {
  //  fetchRequests(appliedFilters);
    //fetchPendingCount(appliedFilters);
  //}, [appliedFilters, fetchRequests, fetchPendingCount]); // Dependencies ऐड किए – ESLint फिक्स

  return {
    requests,
    pendingCount, // नया: return किया
    loadingRequests,
    filterValues,
    setFilterValues,
    applyFilters,
    handleAccept,
    handleReject,
    clearFilters,

    filteredApprovedTotal,
  };
};

export default useWithdrawRequests;