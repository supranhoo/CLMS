import React, { useState, useEffect } from "react";
import { Table, Form, Button, Alert } from "react-bootstrap";
import axios from "../api/axios.js";
import "./AttendanceGrid.css";
import AttendancePage from "./MusterGrid";
import printAtndReg from "./PrintAtndReg";
import UploadManualPunches from "./UploadManualPunches";

// Full YYYY-MM-DD key for a date, so a range that crosses two months never collides on the day number
const dateKeyOf = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

// Function to check user permission to access Upload Manual Muster button
const checkUserPermission = async (emp_id, activity_id) => {
  try {
    const response = await axios.post(
      "/api/assignRoles/getUserMenuActivityForSpecificMenu",
      {
        emp_id,
        activity_id,
      },
      {
        headers: { "Cache-Control": "no-cache" },
      },
    );
    if (response.data && response.data.length > 0) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error("Error checking user permission:", error);
    return false;
  }
};

const AttendanceGrid = ({ from_date, to_date, emp_id }) => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateError, setDateError] = useState(""); // Track date validation errors
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadResponse, setUploadResponse] = useState([]);
  const [filteredGroupedData, setFilteredGroupedData] = useState([]); // New state for filtered data
  const [searchTerm, setSearchTerm] = useState("");
  const [hasUploadPermission, setHasUploadPermission] = useState(false); // Track permission for upload
  const [punchMaster, setPunchMaster] = useState([]);
  const [punchMap, setPunchMap] = useState({});

  // Validation function to check if from_date is greater than to_date
  const isDateRangeValid = () => {
    const startDate = new Date(from_date);
    const endDate = new Date(to_date);
    return startDate <= endDate;
  };

  useEffect(() => {
    // Clear any existing date errors before new validation
    setDateError("");

    // Check if date range is valid
    if (!from_date || !to_date || !isDateRangeValid()) {
      setDateError("From date cannot be greater than To date.");
      return; // Do not proceed with fetching data if dates are invalid
    }

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
        console.error("Punch master error", error);
      }
    };

    const fetchAttendanceData = async () => {
      try {
        setLoading(true);
        const response = await axios.post(`/api/attendance/getAtndMusterAll`, {
          from_date,
          to_date,
        });
        setAttendanceData(response.data);
        setLoading(false);
      } catch (err) {
        setError("Error fetching attendance data.", err);
        setLoading(false);
      }
    };

    const fetchPermission = async () => {
      try {
        const response = await checkUserPermission(emp_id, 1);
        setHasUploadPermission(() => response);
      } catch (error) {
        console.error("Error fetching permission:", error);
      }
    };
    fetchPermission();
    fetchAttendanceData();
    fetchPunchMaster();
  }, [from_date, to_date]);

  // This useEffect will filter the groupedData whenever searchTerm or attendanceData changes
  useEffect(() => {
    const groupedData = attendanceData.reduce((acc, record) => {
      const { employee_code, display_name } = record;
      if (!acc[employee_code]) {
        acc[employee_code] = { display_name, days: {} };
      }
      const day = dateKeyOf(new Date(record.attendance_date));
      acc[employee_code].days[day] = record;
      return acc;
    }, {});

    const filtered = Object.entries(groupedData).filter(
      ([employee_code, employeeData]) => {
        const { display_name } = employeeData;

        return (
          display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          employee_code.toLowerCase().includes(searchTerm.toLowerCase())
        );
      },
    );

    setFilteredGroupedData(filtered); // Update state with the filtered data
  }, [searchTerm, attendanceData]); // Re-run when searchTerm or attendanceData changes

  // Only proceed with date calculations if the dates are valid
  if (!from_date || !to_date || !isDateRangeValid()) {
    return <Alert variant="danger">Please enter a valid date range.</Alert>;
  }

  const startDate = new Date(from_date);
  const endDate = new Date(to_date);

  // Calculate days in range only when dates are valid
  const daysInRange =
    startDate && endDate
      ? Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
      : 0;

  const groupedData = attendanceData.reduce((acc, record) => {
    const { employee_code, display_name } = record;
    if (!acc[employee_code]) {
      acc[employee_code] = { display_name, days: {} };
    }
    const day = dateKeyOf(new Date(record.attendance_date));
    acc[employee_code].days[day] = record;
    return acc;
  }, {});

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

    // Keep your approval logic for Present
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

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleEmployeeClick = (employee_code) => {
    setSelectedEmployee(
      selectedEmployee === employee_code ? null : employee_code,
    );
  };

  // Event handler for Print SL
  const handlePrintSL = () => {
    printAtndReg(from_date, to_date, "SL");
  };

  // Event handler for Print PR
  const handlePrintPR = () => {
    printAtndReg(from_date, to_date, "PR");
  };

  // Event handler for Upload Manual Punches
  const handleUploadPunches = () => {
    // Logic to call uploadPunches.js will go here
    setShowUpload(true);
  };

  // Pagination logicfilteredGroupedData.
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredGroupedData.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );
  const totalPages = Math.ceil(
    Object.entries(filteredGroupedData).length / itemsPerPage,
  );

  return (
    <div className="attendance-grid-container">
      <div className="attendance-grid">
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p>{error}</p>
        ) : (
          <>
            <div className="legends">
              {punchMaster.map((item) => (
                <div className="legend" key={item.punch_mark}>
                  <div
                    className="legend-box"
                    style={{
                      backgroundColor: item.bg_color,
                      border: `1px solid ${item.border_color || "#ccc"}`,
                    }}
                  ></div>

                  <span>
                    {item.icon} {item.punch_mark} - {item.punch_mark_desc}
                  </span>
                </div>
              ))}
            </div>

            {/* Buttons and pagination controls in the same row */}
            <div
              className="action-pagination-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "nowrap", // Ensure they all fit in one row
                height: "35px", // Smaller height
              }}
            >
              <div
                className="action-buttons"
                style={{
                  display: "flex",
                  gap: "10px",
                  fontSize: "12px", // Smaller font size
                }}
              >
                <Button
                  variant="primary"
                  size="sm" // Small button size
                  onClick={handlePrintSL}
                  style={{
                    padding: "2px 10px",
                    fontSize: "12px",
                    minWidth: "100px", // Ensure buttons are wide enough
                    whiteSpace: "nowrap", // Ensure text is in one line
                  }}
                >
                  Print SL
                </Button>
                <Button
                  variant="primary"
                  size="sm" // Small button size
                  onClick={handlePrintPR}
                  style={{
                    padding: "2px 10px",
                    fontSize: "12px",
                    minWidth: "100px", // Ensure buttons are wide enough
                    whiteSpace: "nowrap", // Ensure text is in one line
                  }}
                >
                  Print PR
                </Button>
                <Button
                  variant="success"
                  size="sm" // Small button size
                  onClick={handleUploadPunches}
                  disabled={!hasUploadPermission} // Disable button if no permission
                  style={{
                    padding: "2px 10px",
                    fontSize: "12px",
                    minWidth: "150px", // Ensure buttons are wide enough
                    whiteSpace: "nowrap", // Ensure text is in one line
                  }}
                >
                  Upload Manual Punches
                </Button>
                {showUpload && (
                  <UploadManualPunches
                    setShowUpload={setShowUpload}
                    setUploadResponse={setUploadResponse}
                  />
                )}
              </div>
              <div
                className="action-buttons"
                style={{
                  display: "flex",
                  gap: "10px",
                  color: "greenyellow",
                  padding: "2px 10px",
                  minWidth: "150px",
                  fontSize: "10px", // Smaller font size
                }}
              >
                <Form.Control
                  type="text"
                  size="sm"
                  placeholder="Search by code/name"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  style={{
                    backgroundColor: "greenyellow", // Crayon-like background
                    border: "2px solid black", // Strong black border like a crayon
                    borderRadius: "5px", // Slight rounded corners to mimic crayon softness
                    boxShadow: "2px 2px 5px rgba(0, 0, 0, 0.2)", // Light shadow to give it a raised effect
                    color: "black", // Text color for contrast
                    fontSize: "10px", // Adjusted font size
                    padding: "5px", // Padding inside the input to make it look nicer
                    outline: "none", // Remove default input outline
                  }}
                />
              </div>
              <div
                className="pagination-controls"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  justifyContent: "flex-end", // Align pagination controls to the right
                }}
              >
                <Form.Control
                  as="select"
                  size="sm" // Small dropdown size
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{ width: "60px", fontSize: "10px" }} // Adjust width and font size of dropdown
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </Form.Control>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  style={{ padding: "2px 6px", fontSize: "10px" }} // Reduced padding and font size
                >
                  {"<<"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{ padding: "2px 6px", fontSize: "10px" }} // Reduced padding and font size
                >
                  {"<"}
                </Button>
                <span style={{ fontSize: "10px" }}>
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{ padding: "2px 6px", fontSize: "10px" }} // Reduced padding and font size
                >
                  {">"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  style={{ padding: "2px 6px", fontSize: "10px" }} // Reduced padding and font size
                >
                  {">>"}
                </Button>
              </div>
            </div>

            <Table bordered>
              <thead>
                <tr>
                  <th>Employee Code</th>
                  <th>Employee Name</th>
                  {[...Array(daysInRange).keys()].map((_, i) => (
                    <th key={i + 1}>
                      {new Date(
                        startDate.getTime() + i * 24 * 60 * 60 * 1000,
                      ).getDate()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentItems.map(([employee_code, { display_name, days }]) => (
                  <tr
                    key={employee_code}
                    onClick={() => handleEmployeeClick(employee_code)}
                  >
                    <td>{employee_code}</td>
                    <td className="left-justify">{display_name}</td>
                    {[...Array(daysInRange).keys()].map((_, i) => {
                      const date = new Date(
                        startDate.getTime() + i * 24 * 60 * 60 * 1000,
                      );
                      const day = dateKeyOf(date);
                      const record = days[day];
                      const cellStyle = record ? getCellStyle(record) : {};
                      return (
                        <td key={day} className="punch-mark" style={cellStyle}>
                          {record
                            ? `${punchMap[record.punch_mark]?.icon || ""} ${record.punch_mark}`
                            : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </div>
      {selectedEmployee && (
        <AttendancePage
          employee_code={selectedEmployee}
          from_date={from_date}
          to_date={to_date}
        />
      )}
    </div>
  );
};

export default AttendanceGrid;
