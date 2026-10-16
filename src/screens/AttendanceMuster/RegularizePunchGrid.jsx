import React, { useState, useEffect } from "react";
import { Table, Form, Button, Alert, Modal } from "react-bootstrap";
import axios from "../../api/axios.js";
import { FaSearch } from "react-icons/fa";
import styles from "./RegularizePunchGrid.module.css";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { registerEmployee, selectUser } from "../../features/userSlice";
import { apiErrorMessage } from "../../utils/apiError";

// Utility function to format datetime strings for <input type="datetime-local">
const formatDateForInput = (dateString) => {
  if (!dateString) return ""; // Handle null or empty values
  const date = new Date(dateString);
  const formattedDate = date.toISOString().slice(0, 16); // This trims to "YYYY-MM-DDTHH:mm"
  return formattedDate;
};

const formatTime = (dateTimeString) => {
  // Split the string by 'T' to separate the date and time
  const [datePart, timePart] = dateTimeString.split("T");

  // Take only the HH:MM part from the time
  const timeWithoutSeconds = timePart ? timePart.substring(0, 5) : "00:00";

  // Return the formatted string in YYYY-MM-DD HH:MM format
  return `${datePart} ${timeWithoutSeconds}`;
};

const formatDateForNewInput = (dateString) => {
  if (!dateString) return ""; // Handle null or empty values
  const date = new Date(dateString);

  // Format to "YYYY-MM-DDTHH:mm:ss" for datetime-local input field
  const year = date.getFullYear();
  const month = `0${date.getMonth() + 1}`.slice(-2);
  const day = `0${date.getDate()}`.slice(-2);
  const hours = `0${date.getHours()}`.slice(-2);
  const minutes = `0${date.getMinutes()}`.slice(-2);
  const seconds = `0${date.getSeconds()}`.slice(-2);
  //const seconds = date.getSeconds() !== 0 ? `:${(`0${date.getSeconds()}`).slice(-2)}` : ''; // Only include seconds if they are not zero

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const RegularizePunchGrid = () => {
  const [punchData, setPunchData] = useState([]); // Stores fetched punch data
  const [attendanceDate, setAttendanceDate] = useState(""); // Stores the selected date
  const [contractorId, setContractorId] = useState(""); // Stores the selected contractor ID
  const [contractors, setContractors] = useState([]); // Stores fetched contractors list
  const [error, setError] = useState(""); // Stores error messages
  const [loading, setLoading] = useState(false); // Tracks loading state for API calls
  const [newPunch, setNewPunch] = useState({
    employee_code: "",
    display_name: "",
    in_punch: "",
    out_punch: "",
    approved: "N",
    approved_by: "",
    remarks: "",
    in_punch_actual: "",
    out_punch_actual: "", // New fields for actual punch data
  });
  const [successMessage, setSuccessMessage] = useState(""); // Tracks success message
  const [isAddDisabled, setIsAddDisabled] = useState(true); // Disable "Add" button if employee code is invalid

  const [showEmployeeSearch, setShowEmployeeSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]); // Search results for employees
  const [searchTerm, setSearchTerm] = useState(""); // Stores search term input

  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Fetch contractors when component mounts
  useEffect(() => {
    const fetchContractorData = async () => {
      try {
        const response = await axios.get("/api/contractor/getAllContractors");
        setContractors(response.data);
      } catch (error) {
        console.error("Error fetching contractors:", error);
      }
    };
    fetchContractorData();
  }, []);

  // Fetch regularized punches for the selected date and contractor
  useEffect(() => {
    const fetchPunchData = async () => {
      if (!attendanceDate || !contractorId) return; // Ensure a date and contractor are selected
      setLoading(true);
      setError("");
      setSuccessMessage("");
      console.log("Stage----1a");
      try {
        const response = await axios.post(
          "/api/attendance/getRegularisedPunches",
          {
            attendance_date: attendanceDate,
            contractor_id: contractorId, // Pass the contractor ID
          }
        );
        console.log("Stage----1b", response);
        setPunchData(
          Array.isArray(response.data.recordset) ? response.data.recordset : []
        );
      } catch (err) {
        console.error("Error fetching punches data:", err);
        setError("Error fetching punches data.");
      } finally {
        setLoading(false);
      }
    };
    fetchPunchData();
  }, [attendanceDate, contractorId]);

  const handleEmployeeCodeValidate = async (empCodeParam) => {
    const empCode = (
      typeof empCodeParam === "string"
        ? empCodeParam
        : empCodeParam?.target?.value ?? newPunch.employee_code
    )?.trim();
    if (!empCode) return;

    if (!attendanceDate || !contractorId) {
      setError("Please select Contractor and Attendance Date first");
      setIsAddDisabled(true);
      return;
    }

    try {
      setIsAddDisabled(true);
      setError("");

      // 1️⃣ Validate employee
      const empRes = await axios.post("/api/employee/getEmployeeByCode", {
        employee_code: empCode,
      });

      if (!empRes.data || empRes.data.length === 0) {
        setError("Employee code not found");
        return;
      }

      setNewPunch((prev) => ({
        ...prev,
        display_name: empRes.data[0].display_name,
      }));

      // 2️⃣ Fetch attendance muster
      const musterRes = await axios.post("/api/attendance/getAtndMusterByEmp", {
        emp_code: empCode,
        from_date: attendanceDate,
        to_date: attendanceDate,
      });

      if (!musterRes.data || musterRes.data.length === 0) {
        setError("No attendance record found for this employee");
        return;
      }

      const { in_punch, out_punch } = musterRes.data[0];

      setNewPunch((prev) => ({
        ...prev,
        in_punch_actual: in_punch,
        out_punch_actual: out_punch,
      }));

      // 3️⃣ 🔥 CRITICAL BUSINESS RULE (RESTORED)
      if (in_punch || out_punch) {
        setIsAddDisabled(false); // ✅ ENABLE
      } else {
        setError("Employee has no IN/OUT punch to regularise");
        setIsAddDisabled(true); // ❌ DISABLE
      }
    } catch (err) {
      console.error(err);
      setError("Error validating employee: " + apiErrorMessage(err));
      setIsAddDisabled(true);
    }
  };

  // Handle input changes for adding new punches
  /*
  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    setNewPunch({ ...newPunch, [name]: value });

    // Automatically fetch display_name and actual punch times when entering employee_code
    if (name === "employee_code") {
      try {
        console.log("Stage----1c");
        const response = await axios.post("/api/employee/getEmployeeByCode", {
          employee_code: value,
        });
        console.log("Stage----1d", response);
        if (response.data) {
          setNewPunch((prevState) => ({
            ...prevState,
            display_name: response.data[0].display_name, // Fetch the name based on the code
          }));

          // Fetch the actual in_punch and out_punch
          const musterResponse = await axios.post(
            `/api/attendance/getAtndMusterByEmp`,
            {
              emp_code: value,
              from_date: attendanceDate,
              to_date: attendanceDate,
            }
          );
          console.log("muster response:", musterResponse);
          if (musterResponse.data.length > 0) {
            setNewPunch((prevState) => ({
              ...prevState,
              in_punch_actual: musterResponse.data[0].in_punch, // Set actual punch times
              out_punch_actual: musterResponse.data[0].out_punch,
            }));
            setIsAddDisabled(false); // Enable the Add button
            setError("");
          } else {
            setError("Employee No Punch found");
            setIsAddDisabled(true); // Disable Add button
          }
        } else {
          setError("Employee code not found");
          setIsAddDisabled(true); // Disable Add button
        }
      } catch (err) {
        console.error("Error fetching employee details:", err);
        setError("Error fetching employee details.");
        setIsAddDisabled(true); // Disable Add button
      }
    } else if (name === "employee_code") {
      setIsAddDisabled(true); // Disable Add button if employee code is empty
    }
  };
  
  */

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setNewPunch((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "employee_code") {
      setIsAddDisabled(true);
      setError("");

      setNewPunch((prev) => ({
        ...prev,
        display_name: "",
        in_punch_actual: "",
        out_punch_actual: "",
      }));
    }
  };

  // Handle input changes for updating existing punches
  const handleUpdateInputChange = (e, punch) => {
    const { name, value } = e.target;
    const updatedPunch = { ...punch, [name]: value };
    const updatedData = punchData.map((item) =>
      item.employee_code === punch.employee_code ? updatedPunch : item
    );
    setPunchData(updatedData); // Update punch data in the state
  };

  // Add new punch record
  const handleAddPunch = async () => {
    try {
      console.log("New Punch at Insert:", newPunch);
      const response = await axios.post("/api/attendance/addRegularisePunch", {
        ...newPunch,
        attendance_date: attendanceDate,
        contractor_id: contractorId, // Pass the contractor ID
        created_by: emp_id, // Adjust based on actual user
        created_date: new Date(),
      });

      console.log("Testing---1");
      console.log("Add response:", response);

      if (response.status == 200) {
        console.log("Testing---2");

        // Re-fetch so the new row carries the server's attendance_date and key
        try {
          const refreshed = await axios.post(
            "/api/attendance/getRegularisedPunches",
            { attendance_date: attendanceDate, contractor_id: contractorId }
          );
          setPunchData(
            Array.isArray(refreshed.data.recordset)
              ? refreshed.data.recordset
              : []
          );
        } catch (refreshErr) {
          console.error("Error refreshing punches:", refreshErr);
        }

        // Reset the form fields
        setNewPunch({
          employee_code: "",
          display_name: "",
          in_punch: "",
          out_punch: "",
          approved: "N",
          approved_by: "",
          remarks: "",
          in_punch_actual: "",
          out_punch_actual: "", // Reset actual punch fields
        });

        // Show success message
        setSuccessMessage("Record added successfully.");
        setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
      } else {
        console.log("Testing---3");

        setError("Error adding punch. " + apiErrorMessage({ response }));
      }
    } catch (err) {
      console.log("Testing---4");

      console.error("Error adding punch at err:", err);
      setError("Error adding punch. " + apiErrorMessage(err));
    }
  };

  const reviewPunch = async (punch) => {
    setError("");
    try {
      const approved = punch.approved === "Y" ? "N" : "Y";
      await axios.post("/api/attendance/approveRegularisePunch", { employee_code: punch.employee_code, attendance_date: punch.attendance_date, approved });
      const response = await axios.post("/api/attendance/getRegularisedPunches", { attendance_date: attendanceDate, contractor_id: contractorId });
      setPunchData(response.data.recordset || []);
      setSuccessMessage(approved === "Y" ? "Local regularisation approved." : "Local regularisation approval withdrawn.");
    } catch (error) { setError(apiErrorMessage(error)); }
  };

  // Update existing punch record
  const handleUpdatePunch = async (updatedPunch) => {
    try {
      const response = await axios.post(
        "/api/attendance/updateRegularisePunch",
        {
          ...updatedPunch,
          modified_by: emp_id, // Adjust based on actual user
          modified_date: new Date(),
        }
      );
      if (response.status == 200) {
        const updatedData = punchData.map((punch) =>
          punch.employee_code === updatedPunch.employee_code
            ? updatedPunch
            : punch
        );
        setPunchData(updatedData); // Update the punch data in the grid
        // Show success message
        setSuccessMessage("Record updated successfully.");
        setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
      } else {
        setError("Error updating punch. " + apiErrorMessage({ response }));
      }
    } catch (err) {
      console.error("Error updating punch at 3:", err);
      setError("Error updating punch. " + apiErrorMessage(err));
    }
  };

  // Open employee search modal
  const openEmployeeSearch = () => {
    setShowEmployeeSearch(true);
  };

  // Close employee search modal
  const closeEmployeeSearch = () => {
    setShowEmployeeSearch(false);
  };

  // Fetch employees based on the search term
  const handleSearchEmployees = async () => {
    try {
      const response = await axios.post("/api/employee/searchEmployees", {
        searchTerm: searchTerm,
        contractorId: contractorId,
      });
      setSearchResults(response.data || []);
    } catch (err) {
      console.error("Error fetching employee search results:", err);
    }
  };

  // Select employee from search results
  /*
  const handleSelectEmployee = (employee) => {
    setNewPunch({
      employee_code: employee.employee_code,
      display_name: employee.display_name,
      in_punch: "",
      out_punch: "",
      approved: "N",
      approved_by: "",
      remarks: "",
    });
    closeEmployeeSearch();
  };
  */

  const handleSelectEmployee = (employee) => {
    setNewPunch((prev) => ({
      ...prev,
      employee_code: employee.employee_code,
      display_name: employee.display_name,
      in_punch_actual: "",
      out_punch_actual: "",
    }));

    setIsAddDisabled(true);
    setError("");
    closeEmployeeSearch();

    // 🔥 Force same validation path
    setTimeout(() => {
      handleEmployeeCodeValidate(employee.employee_code);
    }, 0);
  };

  if (!token) {
    return (
      <div>
        <p>You must be logged in to register a employee.</p>
        <button onClick={() => navigate("/")}>Go to Login</button>
      </div>
    );
  }

  return (
    <div className={styles["regularize-punch-grid-container"]}>
      <h3>Regularize Punches</h3>
      <Form.Group>
        <Form.Label>Select Contractor</Form.Label>
        <select
          value={contractorId}
          onChange={(e) => setContractorId(e.target.value)}
          className={styles["small-input"]}
        >
          <option value="">Select Contractor</option>
          {contractors.length > 0
            ? contractors.map((contractor) => (
                <option
                  key={contractor.Contractor_ID}
                  value={contractor.Contractor_ID}
                >
                  {contractor.Contractor_Name}
                </option>
              ))
            : "Loading..."}
        </select>
      </Form.Group>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          width: "100%",
        }}
      >
        <Form.Label style={{ whiteSpace: "nowrap", margin: 0 }}>
          Select Attendance Date
        </Form.Label>
        <Form.Control
          type="date"
          value={attendanceDate}
          onChange={(e) => setAttendanceDate(e.target.value)}
          style={{
            width: "150px",
            padding: "2px",
            height: "24px",
            boxSizing: "border-box",
          }} // Inline style for width and padding
        />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}{" "}
      {/* Success message */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <Table bordered className={styles["compact-grid"]}>
          <thead>
            <tr>
              <th>Employee Code</th>
              <th>Display Name</th>
              <th>Actual In Punch</th>
              <th>Actual Out Punch</th>
              <th>Regularised In Punch</th>
              <th>Regularised Out Punch</th>
              <th>Approved</th>
              <th>Approved BY</th>
              <th>Remarks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {punchData.length > 0 ? (
              punchData.map((punch) => (
                <tr key={`${punch.employee_code}-${punch.attendance_date}`}>
                  <td className={styles["left-justify"]}>
                    {punch.employee_code}
                  </td>
                  <td className={styles["left-justify"]}>
                    {punch.display_name || "No Name"}
                  </td>
                  <td>
                    {punch.in_punch_actual
                      ? formatTime(punch.in_punch_actual)
                      : null}
                  </td>
                  {/* Actual in punch */}
                  <td>
                    {punch.out_punch_actual
                      ? formatTime(punch.out_punch_actual)
                      : null}
                  </td>
                  {/* Actual out punch */}
                  <td>
                    <Form.Control
                      className={styles["small-input"]}
                      type="datetime-local"
                      value={punch.in_punch ? formatTime(punch.in_punch) : null}
                      disabled={punch.approved === "Y"}
                      onChange={(e) => handleUpdateInputChange(e, punch)}
                      name="in_punch"
                    />
                  </td>
                  <td>
                    <Form.Control
                      className={styles["small-input"]}
                      type="datetime-local"
                      value={
                        punch.out_punch ? formatTime(punch.out_punch) : null
                      }
                      disabled={punch.approved === "Y"}
                      onChange={(e) => handleUpdateInputChange(e, punch)}
                      name="out_punch"
                    />
                  </td>
                  <td>{punch.approved}</td>
                  <td>{punch.approved_by}</td>
                  <td>
                    <Form.Control
                      type="text"
                      className={styles["small-input"]}
                      value={punch.remarks || ""}
                      onChange={(e) => handleUpdateInputChange(e, punch)}
                      name="remarks"
                    />
                  </td>
                  <td>
                    <Button size="sm" disabled={punch.approved === "Y"} onClick={() => handleUpdatePunch(punch)}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline-success" onClick={() => reviewPunch(punch)}>{punch.approved === "Y" ? "Withdraw approval" : "Approve"}</Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9">No records found for the selected date</td>
              </tr>
            )}
            {/* Add new punch row */}
            <tr>
              <td>
                <div className={styles["inline-fields"]}>
                  <Form.Control
                    type="text"
                    name="employee_code"
                    value={newPunch.employee_code}
                    onChange={(e) =>
                      setNewPunch({
                        ...newPunch,
                        employee_code: e.target.value,
                      })
                    }
                    onBlur={handleEmployeeCodeValidate} // 🔥 KEY
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleEmployeeCodeValidate();
                      }
                    }}
                    placeholder="Employee Code"
                    className={styles["employee-code-input"]}
                  />
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={openEmployeeSearch}
                    className={styles["icon-button"]}
                  >
                    <FaSearch /> {/* Search icon */}
                  </Button>
                </div>
              </td>
              <td>
                <Form.Control
                  type="text"
                  name="display_name"
                  value={newPunch.display_name}
                  readOnly
                  className={styles["small-input"]}
                  placeholder="Display Name"
                />
              </td>
              <td>{newPunch.in_punch_actual || "N/A"}</td>
              {/* Actual in punch */}
              <td>{newPunch.out_punch_actual || "N/A"}</td>
              {/* Actual out punch */}
              <td>
                <Form.Control
                  className={styles["small-input"]}
                  type="datetime-local"
                  name="in_punch"
                  value={formatDateForNewInput(newPunch.in_punch)}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <Form.Control
                  className={styles["small-input"]}
                  type="datetime-local"
                  name="out_punch"
                  value={formatDateForNewInput(newPunch.out_punch)}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <Form.Control
                  className={styles["small-input"]}
                  type="text"
                  name="approved"
                  value={newPunch.approved}
                  readOnly
                  placeholder="N"
                />
              </td>
              <td></td>
              <td>
                <Form.Control
                  type="text"
                  className={styles["small-input"]}
                  name="remarks"
                  value={newPunch.remarks}
                  onChange={handleInputChange}
                  placeholder="Remarks"
                />
              </td>
              <td>
                <Button
                  size="sm"
                  onClick={handleAddPunch}
                  className={styles["small-button"]}
                  disabled={isAddDisabled} // Disable the Add button when no valid employee code
                >
                  Add
                </Button>
              </td>
            </tr>
          </tbody>
        </Table>
      )}
      {/* Employee Search Modal */}
      <Modal show={showEmployeeSearch} onHide={closeEmployeeSearch}>
        <Modal.Header closeButton>
          <Modal.Title>Search Employee</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            type="text"
            placeholder="Enter employee name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles["small-input"]}
          />
          <Button
            size="sm"
            onClick={handleSearchEmployees}
            className={styles["small-button"]}
          >
            Search
          </Button>
          {searchResults.length > 0 && (
            <ul>
              {searchResults.map((employee) => (
                <li
                  key={employee.employee_code}
                  onClick={() => handleSelectEmployee(employee)}
                >
                  {employee.display_name} ({employee.employee_code})
                </li>
              ))}
            </ul>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="secondary" onClick={closeEmployeeSearch}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default RegularizePunchGrid;
