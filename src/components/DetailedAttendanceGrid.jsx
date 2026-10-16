import React, { useState, useEffect } from "react";
import { Table } from "react-bootstrap";
import axios from "../api/axios.js";
import "./DetailedAttendanceGrid.css";

const DetailedAttendanceGrid = ({ employee_code, from_date, to_date }) => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [employeeName, setEmployeeName] = useState("");

  const [punchMaster, setPunchMaster] = useState([]);
  const [punchMap, setPunchMap] = useState({});

  // Fetch attendance data whenever employee_code, from_date, or to_date changes
  useEffect(() => {
    const fetchPunchMaster = async () => {
      try {
        const response = await axios.post("/api/attendance/getPunchMarks");

        setPunchMaster(response.data);

        const map = {};
        response.data.forEach((item) => {
          map[item.punch_mark] = item;
        });

        setPunchMap(map);
      } catch (error) {
        console.error("Punch master error:", error);
      }
    };
    const fetchAttendanceData = async () => {
      try {
        setLoading(true);
        const response = await axios.post(
          `/api/attendance/getAtndMusterByEmp`,
          {
            emp_code: employee_code,
            from_date,
            to_date,
          },
        );
        setAttendanceData(response.data);
        setEmployeeName(response.data[0]?.display_name || "");
        setLoading(false);
      } catch (err) {
        setError("Error fetching attendance data.");
        setLoading(false);
      }
    };
    fetchPunchMaster();
    fetchAttendanceData();
  }, [employee_code, from_date, to_date]); // Ensure useEffect runs when date range changes

  /*
  const getBackgroundColorClass = (record) => {
    if (record.punch_mark === "P") {
      if (record.atnd_approved === "Y" && record.hr_approved === "Y") {
        return "green-bg";
      } else if (record.atnd_approved === "Y" && record.hr_approved === "N") {
        return "light-yellow-bg";
      } else if (record.atnd_approved === "N") {
        return "light-grey-bg";
      }
    } else if (record.punch_mark === "AB") {
      return "light-red-bg";
    } else if (record.punch_mark === "WO" || record.punch_mark === "CL") {
      return "light-white-bg";
    }
    return "";
  };
  */
  const getCellStyle = (record) => {
    if (!record) return {};

    if (record.punch_mark === "P") {
      if (record.atnd_approved === "Y" && record.hr_approved === "Y") {
        return {
          backgroundColor: "#198754",
          color: "white",
        };
      }

      if (record.atnd_approved === "Y") {
        return {
          backgroundColor: "#fff3cd",
          color: "black",
        };
      }

      return {
        backgroundColor: "#e2e3e5",
        color: "black",
      };
    }

    const item = punchMap[record.punch_mark];

    if (!item) return {};

    return {
      backgroundColor: item.bg_color,
      color: item.text_color,
      border: `1px solid ${item.border_color || "#ddd"}`,
    };
  };
  /*
  const formatTime = (datetime) => {
    const date = new Date(datetime);
    return date.toTimeString().slice(0, 5); // Get HH:MM format
  };
  */

  const formatTime = (dateTimeString) => {
    // Split the string by 'T' to separate the date and time
    const [datePart, timePart] = dateTimeString.split("T");

    // Take only the HH:MM part from the time
    const timeWithoutSeconds = timePart ? timePart.substring(0, 5) : "00:00";

    // Return the formatted string in YYYY-MM-DD HH:MM format
    return `${datePart} ${timeWithoutSeconds}`;
    /*
    const date = new Date(dateTimeString);
  
    const day = String(date.getDate()).padStart(2, '0'); // Get day and pad with 0 if needed
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Get month and pad with 0 (months are 0-indexed)
    const year = String(date.getFullYear()).slice(-2); // Get last 2 digits of the year
  
    const hours = String(date.getHours()).padStart(2, '0'); // Get hours and pad with 0
    const minutes = String(date.getMinutes()).padStart(2, '0'); // Get minutes and pad with 0
  
    return `${day}/${month}/${year} ${hours}:${minutes}`; // Return formatted date and time
    */
  };

  /*--
  const renderCellContent = (record) => (
    <div className="cell-content">
      <div className="row-1">{new Date(record.attendance_date).getDate()}</div>
      <div className="row-2">Shift: {record.shift}</div>
      <div className="time-container">
        <div className="row-3">
          <span className="time-label">In Time:</span>
          <span className="time-value">{record.in_punch ? formatTime(record.in_punch) : ""}</span>
        </div>
        <div className="row-4">
          <span className="time-label">Out Time:</span>
          <span className="time-value">{record.out_punch ? formatTime(record.out_punch) : ""}</span>
        </div>
      </div>
      <div
        className="row-5"
        style={getCellStyle(record)}
      >
        Punch Mark: {punchMap[record.punch_mark]?.icon || ""} {record.punch_mark}
      </div>
      <div className="row-6">Working Hours: {record.working_hours ? record.working_hours.substring(0, 5) : "00:00"}</div>
      <div className="row-7">OT Hours: {record.ot_hours ? record.ot_hours.substring(0, 5) : "00:00"}</div>
    </div>
  );
  --*/

  const renderCellContent = (record) => {
    // Assuming working_hours and ot_hours are stored in the database as TIME (e.g., '08:30')
    const formatTimeField = (timeString) => {
      if (!timeString) return "00:00"; // Handle null or undefined values
      if (typeof timeString === "string") {
        return timeString.slice(0, 5); // Extract HH:MM from the time string
      }
      return "00:00"; // Default for unexpected cases
    };

    return (
      <div className="cell-content">
        <div className="row-1">
          {new Date(record.attendance_date).getDate()}
        </div>
        <div className="row-2">
          Shift: {record.shift}
          {record.sh_start_time && record.sh_end_time
            ? ` (${record.sh_start_time.slice(0, 5)} - ${record.sh_end_time.slice(0, 5)})`
            : ""}
          {record.punch_regularised ? " Regularised" : ""}
        </div>
        <div className="time-container">
          <div className="row-3">
            <span className="time-label">In Time:</span>
            <span className="time-value">
              {record.punch_regularised === "Y" && record.reg_in_punch
                ? formatTime(record.reg_in_punch)
                : record.in_punch
                  ? formatTime(record.in_punch)
                  : ""}
            </span>
          </div>
          <div className="row-4">
            <span className="time-label">Out Time:</span>
            <span className="time-value">
              {record.punch_regularised === "Y" && record.reg_out_punch
                ? formatTime(record.reg_out_punch)
                : record.out_punch
                  ? formatTime(record.out_punch)
                  : ""}
            </span>
          </div>
        </div>
        <div className="row-5" style={getCellStyle(record)}>
          Punch Mark: {punchMap[record.punch_mark]?.icon || ""}{" "}
          {record.punch_mark}
        </div>
        <div className="row-6">
          Working Hours: {formatTimeField(record.working_hours)}
        </div>
        <div className="row-7">
          OT Hours: {formatTimeField(record.ot_hours)}
        </div>
      </div>
    );
  };

  const renderEmptyContent = (currentDate) => (
    <div className="cell-content">
      <div className="row-1">{new Date(currentDate).getDate()}</div>
    </div>
  );

  // Generate week rows with the current date range
  const generateWeekRows = () => {
    const startDate = new Date(from_date); // Initialize startDate based on new input
    const endDate = new Date(to_date); // Initialize endDate based on new input

    const rows = [];
    let currentDate = new Date(startDate); // Always reinitialize currentDate

    // Calculate the day of the week for startDate (Sunday = 0, Monday = 1, ..., Saturday = 6)
    // Adjust so Monday is 0, Sunday is 6 (i.e., shift Sunday to the end of the week)
    let currentWeekday = currentDate.getDay();
    currentWeekday = currentWeekday === 0 ? 6 : currentWeekday - 1; // Align Sunday as last day

    // First week: Fill in the empty cells before the start date, if necessary
    const firstWeek = [];
    for (let i = 0; i < currentWeekday; i++) {
      firstWeek.push(
        <td key={i}>
          {" "}
          <div className="cell-content">--</div>
        </td>,
      ); // Fill empty cells
    }

    // Fill the rest of the first week

    while (currentWeekday < 7 && currentDate <= endDate) {
      const record = attendanceData.find(
        (r) =>
          new Date(r.attendance_date).toDateString() ===
          currentDate.toDateString(),
      );

      firstWeek.push(
        <td key={currentWeekday}>
          {record ? (
            renderCellContent(record)
          ) : (
            <div className="cell-content"></div>
          )}
        </td>,
      );
      currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
      currentWeekday++;
    }
    rows.push(<tr key={`first-week-${currentDate}`}>{firstWeek}</tr>); // Push the first week

    // Continue for subsequent weeks
    while (currentDate <= endDate) {
      const week = [];

      // For a complete week (Monday-Sunday)
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        if (currentDate > endDate) {
          week.push(
            <td key={`empty-${dayIndex}`}>
              {" "}
              <div className="cell-content"></div>
            </td>,
          );
        } else {
          const record = attendanceData.find(
            (r) =>
              new Date(r.attendance_date).toDateString() ===
              currentDate.toDateString(),
          );

          week.push(
            <td key={dayIndex}>
              {record
                ? renderCellContent(record)
                : renderEmptyContent(currentDate)}
            </td>,
          );
        }
        currentDate.setDate(currentDate.getDate() + 1); // Move to next day
      }

      rows.push(<tr key={`week-${currentDate}`}>{week}</tr>);
    }

    return rows;
  };

  return (
    <div className="detailed-attendance-grid">
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p>{error}</p>
      ) : (
        <>
          <h4>
            👤 Employee: {employee_code} - {employeeName}
          </h4>{" "}
          <Table bordered>
            <thead>
              <tr>
                {[
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ].map((day) => (
                  <th key={day}>{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>{generateWeekRows()}</tbody>
          </Table>
        </>
      )}
    </div>
  );
};

export default DetailedAttendanceGrid;
