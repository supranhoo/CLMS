import React, { useState, useEffect } from "react";
import { Table } from "react-bootstrap";
import axios from "../api/axios.js";
import "./PunchesGrid.css";

const PunchesGrid = ({ employee_code, from_date, to_date }) => {
  const [punchesData, setPunchesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch punches data based on employee_code, from_date, and to_date
  useEffect(() => {
    const fetchPunchesData = async () => {
      try {
        setLoading(true);
        const response = await axios.post(
          `/api/attendance/getPunchesDataByEmp`, // Updated endpoint
          {
            emp_code: employee_code,
            from_date:from_date,
            to_date: to_date,
          }
        );
        setPunchesData(response.data);
        setLoading(false);
      } catch (err) {
        setError("Error fetching punches data.");
        setLoading(false);
      }
    };

    fetchPunchesData();
  }, [employee_code, from_date, to_date]); // Ensure data updates when employee_code or dates change

  return (
    <div className="punches-grid">
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p>{error}</p>
      ) : (
        <>
          <h4>Punches Data</h4>
          <Table bordered>
            <thead>
              <tr>
                <th>BM ID</th>
                <th>Employee Code</th>
                <th>Punch Time</th>
                <th>Created Date</th>
              </tr>
            </thead>
            <tbody>
              {punchesData.map((punch, index) => (
                <tr key={index}>
                  <td>{punch.BIOMETRICMACHINE_ID}</td>
                  <td>{punch.EMPLOYEE_CODE}</td>
                  <td>{punch.ATTENDANCE_DATE_WITH_TIME}</td>
                  <td>{punch.CREATED_DATE}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </div>
  );
};

export default PunchesGrid;
