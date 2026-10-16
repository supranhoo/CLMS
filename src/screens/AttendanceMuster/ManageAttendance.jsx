import React, { useState, useEffect, useRef  } from "react";
import AttendanceGrid from "../../components/AttendanceGrid";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {  selectUser } from "../../features/userSlice";
import Loading from "../../components/Loading";
import ErrorMessage from "../../components/ErrorMessage";
import axios from "../../api/axios.js";

const ManageAttendance = () => {
  const currentDate = new Date();
  console.log(currentDate);
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  console.log(firstDayOfMonth);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  console.log(lastDayOfMonth);
  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is zero-based
    const year = date.getFullYear();
    return `${year}-${month}-${day}`; // Format as DD-MM-YYYY
  };
  const [fromDate, setFromDate] = useState(formatDate(firstDayOfMonth)); // Replace with the desired initial date
  const [toDate, setToDate] = useState(formatDate(lastDayOfMonth)); // Replace with the desired initial date
  const [errors, setErrors] = useState({}); // State for errors

  const handleFromDateChange = (e) => setFromDate(e.target.value);
  const handleToDateChange = (e) => setToDate(e.target.value);

  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();
  const dispatch = useDispatch();

  if (!token) {
    return (
      <div>
        <p>You must be logged in to register a contractor.</p>
        <button onClick={() => navigate("/")}>Go to Login</button>
      </div>
    );
  }

  return (
    <div className="legacy-attendance">
      <h1>Manage Attendance</h1>
      <div>
        <label>From Date: </label>
        <input type="date" value={fromDate} onChange={handleFromDateChange} />
        <label>To Date: </label>
        <input type="date" value={toDate} onChange={handleToDateChange} />
      </div>
      <AttendanceGrid from_date={fromDate} to_date={toDate} emp_id={emp_id}/>
    </div>
  );
};

export default ManageAttendance;
