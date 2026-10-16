import React, { useState, useEffect, useRef } from "react";
import {
  Table,
  Form,
  Button,
  Alert,
  Modal,
  Tooltip,
  OverlayTrigger,
} from "react-bootstrap";
import axios from "../../api/axios.js";
import { FaSearch } from "react-icons/fa";
import styles from "./ManualMusterMark.module.css";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { registerEmployee, selectUser } from "../../features/userSlice";
import Select from "react-select";
import UploadManualMuster from "../../components/UploadManualMuster";
import { apiErrorMessage } from "../../utils/apiError";
import moment from "moment"; // You can use the moment library for date formatting

// Utility function to convert a date to DD/MM/YYYY format
function formatDate(date) {
  if (!date) return "";
  return date.substring(0, 10);
}

// Utility function to format datetime strings for <input type="datetime-local">
/*
const formatDateForInput = (dateString) => {
  if (!dateString) return ""; // Handle null or empty values
  const date = new Date(dateString);
  const formattedDate = date.toISOString().slice(0, 16); // This trims to "YYYY-MM-DDTHH:mm"
  return formattedDate;
};
};
*/
const formatDateForInput = (dateString) => {
  // A plain YYYY-MM-DD (or ISO) string already names the day: parsing it with new Date() and reading local
  // getters shows the previous day west of UTC.
  if (typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateString)) return dateString.slice(0, 10);
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const customStyles = {
  control: (base) => ({
    ...base,
    minWidth: "200px",
    maxWidth: "400px",
    borderColor: "#aaa",
    boxShadow: "none",
    "&:hover": {
      borderColor: "#888",
    },
  }),
  menu: (base) => ({
    ...base,
    maxWidth: "400px",
  }),
};

// Custom styles for react-select
const customStyles2 = {
  control: (base) => ({
    ...base,
    width: "80%", // Set width to 50% of the parent
    height: "40%", // Set height to 50% of the parent row height
    minHeight: "5px", // Optional: Set minimum height to avoid layout collapse
    fontSize: "10px", // Adjust control font size
  }),
};

// Custom Option component to include checkboxes in the dropdown
const CustomOption = (props) => {
  const { innerRef, innerProps, isSelected, data } = props;
  return (
    <div
      ref={innerRef}
      {...innerProps}
      style={{ display: "flex", alignItems: "center" }}
    >
      <input type="checkbox" checked={isSelected} onChange={() => null} />
      <label style={{ marginLeft: 8 }}>{data.label}</label>
    </div>
  );
};

const formatTime = (dateTimeString) => {
  // Split the string by 'T' to separate the date and time
  const [datePart, timePart] = dateTimeString.split("T");

  // Take only the HH:MM part from the time
  const timeWithoutSeconds = timePart ? timePart.substring(0, 5) : "00:00";

  // Return the formatted string in YYYY-MM-DD HH:MM format
  //return `${datePart} ${timeWithoutSeconds}`;
  return `${timeWithoutSeconds}`;
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
      }
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

const ManualMuster = () => {
  const [arrearsData, setArrearsData] = useState([]); // Stores fetched arrears data
  const [pmonth, setPmonth] = useState(""); // Stores the selected date
  const [selectedPmonth, setSelectedPmonth] = useState([]);

  const [billingType, setBillingType] = useState(""); // Stores the selected date
  const [billingCycle, setBillingCycle] = useState(""); // Stores the selected date
  const [selectedBillingCycle, setSelectedBillingCycle] = useState([]);
  const [pmonthList, setPmonthList] = useState(""); // Stores the selected date

  const [arrearCode, setArrearCode] = useState(""); // Stores the selected Deductions ID
  const [arrearCodes, setArrearCodes] = useState(""); // Stores the selected contractor ID
  const [selectedArrearCode, setSelectedArrearCode] = useState(""); // Stores the selected contractor ID

  const [shiftsList, setShiftsList] = useState([]); // Stores the selected date
  const [selectedShift, setSelectedShift] = useState(null);
  const [selectedPunchMark, setSelectedPunchMark] = useState(null);

  const [arrearValue, setArrearValue] = useState(""); // Stores the selected contractor ID
  const [remarks, setRemarks] = useState(""); // Stores the selected contractor ID
  const [contractorID, setContractorID] = useState([]); // Stores fetched contractors list
  const [contractors, setContractors] = useState([]); // Stores fetched contractors list
  const [error, setError] = useState(""); // Stores error messages
  const [loading, setLoading] = useState(false); // Tracks loading state for API calls
  const [showUpload, setShowUpload] = useState(true);
  const [hasUploadPermission, setHasUploadPermission] = useState(false); // Track permission for upload

  const employee_codeRef = useRef(null);

  const [newArrear, setNewDeduction] = useState({
    employee_code: "",
    attendance_date: "",
    shift: "",
    punch_mark: "",
    ot_hours: "",
    working_hours: "",
    created_by: "",
    remarks: "",
  });

  // Static options for shift selection
  const fallbackPunchMarksList = [
    { value: "P", label: "P - Present" },
    { value: "AB", label: "AB - Absent" },
    { value: "WO", label: "WO - Weekly Off" },
    { value: "CL", label: "CL - Casual Leave" },
    { value: "EL", label: "EL - Earned Leave" },
    { value: "SL", label: "SL - Sick Leave" },
    { value: "HLD", label: "HLD - Holiday" },
    { value: "OD", label: "OD - Outdoor Duty" },
    { value: "WFH", label: "WFH - Work From Home" },
    { value: "HD", label: "HD - Half Day" },
    { value: "LOP", label: "LOP - Loss Of Pay" },
  ];
  const [staticPunchMarksList, setPunchMarksList] = useState(
    fallbackPunchMarksList
  );

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
    const fetchPermission = async () => {
      try {
        const response = await checkUserPermission(emp_id, 4);
        setHasUploadPermission(() => response);
      } catch (error) {
        console.error("Error fetching permission:", error);
      }
    };

    fetchContractorData();
    fetchBillingCycleData();
    fetchPmonthData();
    fetchArrearCodesData();
    fetchEmpShifts();
    fetchPunchMarks();
    fetchPermission();
    setShowUpload(false);
  }, []);

  const handleGetDeduction = async () => {
    fetchDeductionData();
    employee_codeRef.current.focus();
  };

  // Handle input changes for adding new deductiones
  /*
  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    setNewDeduction({ ...newArrear, [name]: value });

    // Automatically fetch display_name and actual deduction times when entering employee_code
    if (name === "employee_code" && value.length > 3) {
      try {
        const response = await axios.post("/api/employee/getEmployeeByCode", {
          employee_code: value,
        });
        if (response.data) {
          setNewDeduction((prevState) => ({
            ...prevState,
            display_name: response.data[0].display_name, // Fetch the name based on the code
          }));
          setIsAddDisabled(false); // Disable Add button
          setError("");
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

    setNewDeduction((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "employee_code") {
      setIsAddDisabled(true); // disable until validated
      setError("");

      setNewDeduction((prev) => ({
        ...prev,
        display_name: "",
      }));
    }
  };

  const handleEmployeeValidate = async (empCodeParam) => {
    const empCode =
      typeof empCodeParam === "string"
        ? empCodeParam
        : empCodeParam?.target?.value;

    if (!empCode) return;

    try {
      setIsAddDisabled(true);
      setError("");

      const response = await axios.post("/api/employee/getEmployeeByCode", {
        employee_code: empCode, // ✅ ALWAYS STRING
      });

      if (!response.data || response.data.length === 0) {
        setError("Employee code not found");
        return;
      }

      setNewDeduction((prev) => ({
        ...prev,
        employee_code: empCode,
        display_name: response.data[0].display_name,
      }));

      setIsAddDisabled(false); // ✅ valid employee
    } catch (err) {
      console.error(err);
      setError("Error validating employee");
      setIsAddDisabled(true);
    }
  };

  // Handle input changes for updating existing deductiones
  const handleUpdateInputChange = (e, deduction) => {
    const { name, value } = e.target;
    const updatedPunch = { ...deduction, [name]: value };
    const updatedData = arrearsData.map((item) =>
      item.employee_code === deduction.employee_code ? updatedPunch : item
    );
    setArrearsData(updatedData); // Update deduction data in the state
  };

  // Add new deduction record
  const handleAddArrear = async () => {
    try {
      // Create an updated version of newArrear
      const updatedArrear = {
        ...newArrear,
        shift: selectedShift,
        punch_mark: selectedPunchMark,
        created_by: emp_id,
      };
      setNewDeduction(updatedArrear);
      const response = await axios.post("/api/attendance/addManualPunchMark", {
        updatedArrear,
      });
      /*
      const response = await axios.post("/api/attendance/addManualPunchMark", {
        ...newArrear,
        shift:selectedShift,
        punch_mark:selectedPunchMark,
        created_by: emp_id, // Adjust based on actual user
      });
      */
      console.log("Testing---1");
      console.log("Add response:", response);

      if (response.status == 200) {
        console.log("Testing---2");

        setArrearsData([...arrearsData, updatedArrear]);
        setSelectedShift(null);
        setSelectedPunchMark(null);

        // Reset the form fields
        setNewDeduction({
          employee_code: "",
          attendance_date: "",
          shift: "",
          punch_mark: "",
          ot_hours: "",
          working_hours: "",
          created_by: "",
          remarks: "",
        });

        // Show success message
        setSuccessMessage("Record added successfully.");
        setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
        employee_codeRef.current.focus();
      } else {
        console.log("Testing---3");

        //if (response.data.error.originalError.info.message) {
        //setError("Error adding deduction.1"+response.data.error.originalError.info.message);
        //} else {
        setError("Error adding deduction at 2" + response);
        //}
      }
    } catch (err) {
      console.log("Testing---4");
      console.error("Error adding deduction at err:", err);
      //if (err.response.data.error.originalError.info.message) {
      //setError("Error adding deduction.3"+err.response.data.error.originalError.info.message);
      //} else {
      setError(apiErrorMessage(err));
      //}
    }
  };

  const fetchDeductionData = async () => {
    try {
      console.log("Inputs:", billingType);
      const response = await axios.post("/api/attendance/getManualMuster", {
        billingType: selectedBillingCycle.value,
        pmonth: selectedPmonth.value,
      });
      console.log("Response,", response);
      setArrearsData(Array.isArray(response.data) ? response.data : []);
      console.log(response);
      console.log("arrearsData", arrearsData);
    } catch (error) {
      console.error("Error fetching getWageArrears:", error);
    }
  };

  const fetchContractorData = async () => {
    try {
      const response = await axios.get("/api/contractor/getAllContractors");
      setContractors(response.data);
    } catch (error) {
      console.error("Error fetching contractors:", error);
    }
  };

  const fetchBillingCycleData = async () => {
    try {
      const response = await axios.get("/api/employee/getBillingType");
      const formattedBillingCycle = response.data.map((item) => ({
        value: item.billingtype_code,
        label: item.billingtype_name,
      }));
      setBillingCycle(formattedBillingCycle); // Set the correct formatted array
    } catch (error) {
      console.error("Error fetching Billing Cycles:", error);
    }
  };

  const fetchArrearCodesData = async () => {
    try {
      const response = await axios.get("/api/wages/getArrearCodes");
      const formattedDedCodes = response.data.map((item) => ({
        value: item.arrearCode,
        label: item.arrearName,
      }));
      setArrearCodes(formattedDedCodes); // Set the correct formatted array
    } catch (error) {
      console.error("Error fetching Arrear Codes:", error);
    }
  };

  const fetchPmonthData = async () => {
    try {
      const response = await axios.post("/api/wages/getProcessMonth");
      const formattedPmonth = response.data.map((item) => ({
        pmonth: item.pmonth,
      }));
      setPmonthList(formattedPmonth); // Set the correct formatted array
    } catch (error) {
      console.error("Error fetching Process Month:", error);
    }
  };

  const fetchPunchMarks = async () => {
    try {
      const response = await axios.post("/api/attendance/getPunchMarks", {});
      const options = (Array.isArray(response.data) ? response.data : [])
        .filter((item) => item.punch_mark)
        .map((item) => ({
          value: item.punch_mark,
          label: item.punch_mark_desc
            ? `${item.punch_mark} - ${item.punch_mark_desc}`
            : item.punch_mark,
        }));
      if (options.length) setPunchMarksList(options);
    } catch (error) {
      console.error("Error fetching punch marks:", error);
    }
  };

  const fetchEmpShifts = async () => {
    try {
      const response = await axios.get("/api/attendance/getShift");
      console.log(response);
      const formattedEmpShifts = response.data.map((item) => ({
        value: item.sh_code,
        label: item.sh_code,
      }));
      setShiftsList(formattedEmpShifts); // Set the correct formatted array
      console.log("Emp Shifts:", shiftsList);
    } catch (error) {
      console.error("Error fetching Process Month:", error);
    }
  };

  const fetchPmonthByBillingCycle = async (billingType) => {
    try {
      const response = await axios.post(
        "/api/wages/getProcessMonthByBillingCycle",
        {
          billingtype: billingType,
        }
      );

      // Format the process month data
      const formattedPmonth = response.data.map((item) => ({
        value: item.pmonth,
        //label:item.pmonth,
        label: moment(item.pmonth).format("DD/MM/YYYY"), // Display as DD/MM/YYYY
      }));
      setPmonth(formattedPmonth); // Update the pmonth dropdown options
    } catch (error) {
      console.error("Error fetching Process Months by Billing Type:", error);
    }
  };

  const handleBillingCycleChange = (selectedOption) => {
    setSelectedBillingCycle(selectedOption);

    // Fetch corresponding process months based on the selected billing cycle
    if (selectedOption && selectedOption.value) {
      fetchPmonthByBillingCycle(selectedOption.value);
    } else {
      setPmonth([]); // Reset pmonth options if no billing cycle is selected
    }
  };

  const customHandleChangeSingle = (selectedOption, setSelectedOption) => {
    if (!selectedOption) {
      setSelectedOption(null);
      return;
    }

    setSelectedOption(selectedOption); // Set the single selected option
  };

  const handleShowUpload = () => {
    setShowUpload(true); // Set showUpload to true to render the UploadDeductions component
  };

  // Update existing deduction record
  const handleDeleteDeduction = async (updatedDeduction) => {
    try {
      const response = await axios.post(
        "/api/attendance/deleteManualPunchMark",
        {
          ...updatedDeduction,
        }
      );

      if (response.status == 200) {
        fetchDeductionData();
        setSuccessMessage("Record deleted successfully.");
        setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
        employee_codeRef.current.focus();
      } else {
        setError("Error updating deduction. " + apiErrorMessage({ response }));
      }
    } catch (err) {
      console.error("Error updating deduction at 3:", err);
      setError("Error updating deduction. " + apiErrorMessage(err));
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
        arrearCode: arrearCode,
      });
      setSearchResults(response.data || []);
    } catch (err) {
      console.error("Error fetching employee search results:", err);
    }
  };

  // Select employee from search results
  /*
  const handleSelectEmployee = (employee) => {
    setNewDeduction({
      employee_code: employee.employee_code,
      display_name: employee.display_name,
      pmonth: "",
      billingType: "",
      arrearCode: "",
      arrearValue: "",
      remarks: "",
      created_by: "",
    });
    closeEmployeeSearch();
  };
  */
  const handleSelectEmployee = (employee) => {
    setNewDeduction((prev) => ({
      ...prev,
      employee_code: employee.employee_code,
      display_name: "",
    }));

    setIsAddDisabled(true);
    setError("");
    closeEmployeeSearch();

    // 🔥 force SAME validation path
    setTimeout(() => {
      handleEmployeeValidate(employee.employee_code);
    }, 0);
  };

  // Define your tooltip for input file headers
  const renderTooltip = (props) => (
    <Tooltip id="button-tooltip" {...props}>
      The input file should have headers:
      <strong>
        EmployeeCode, AttendanceDate, Shift, MusterMark, WorkingHours, OTHours,
        Remarks
      </strong>
    </Tooltip>
  );

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
      <h3>Manual Muster</h3>
      <div className={styles["form-inline-grid"]}>
        <Form.Group className={styles["form-row"]}>
          <Form.Label className={styles["inline-label"]}>
            Billing Type
          </Form.Label>
          <Select
            options={billingCycle}
            value={selectedBillingCycle}
            onChange={handleBillingCycleChange}
            components={{ Option: CustomOption }}
            placeholder="Select Billing Cycle"
            className={styles["small-input"]}
            closeMenuOnSelect={true}
          />
        </Form.Group>

        <Form.Group className={styles["form-row"]}>
          <Form.Label className={styles["inline-label"]}>
            Process Month
          </Form.Label>
          <Select
            options={pmonth}
            value={selectedPmonth}
            onChange={(selectedOption) =>
              customHandleChangeSingle(selectedOption, setSelectedPmonth)
            }
            components={{ Option: CustomOption }}
            placeholder="Select Process Month"
            styles={customStyles}
            closeMenuOnSelect={true}
            className={styles["small-input"]}
          />
        </Form.Group>

        <Form.Group className={styles["form-row"]}>
          <Button
            size="lg"
            onClick={handleGetDeduction}
            className={styles["small-button"]}
          >
            Show Data
          </Button>
        </Form.Group>

        <Form.Group className={styles["form-row"]}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 250, hide: 400 }}
            overlay={renderTooltip}
          >
            <Button
              size="lg"
              onClick={handleShowUpload}
              className={styles["small-button"]}
              disabled={!hasUploadPermission} // Disable button if no permission
            >
              Upload Manual Muster
            </Button>
          </OverlayTrigger>
          {showUpload && (
            <UploadManualMuster
              setShowUpload={setShowUpload}
              created_by={user.emp_id}
            />
          )}
        </Form.Group>
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
              <th style={{ width: "15%" }}>Employee Code</th>
              <th style={{ width: "15%" }}>Employee Name</th>
              <th style={{ width: "12%" }}>Date</th>
              <th style={{ width: "8%" }}>Shift</th>
              <th style={{ width: "10%" }}>Muster Mark</th>
              <th style={{ width: "10%" }}>T.Work Hrs</th>
              <th style={{ width: "10%" }}>OT Hours</th>
              <th style={{ width: "15%" }}>Remarks</th>
              <th style={{ width: "15%" }}>Created By</th>
              <th style={{ width: "15%" }}>Created Date</th>
              <th style={{ width: "15%" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {arrearsData.length > 0 ? (
              arrearsData.map((arrear) => (
                <tr key={`${arrear.employee_code}-${arrear.attendance_date}`}>
                  <td className={styles["left-justify"]}>
                    {arrear.employee_code}
                  </td>
                  <td className={styles["left-justify"]}>
                    {arrear.display_name || "No Name"}
                  </td>
                  <td>
                    {arrear.attendance_date
                      ? formatDate(arrear.attendance_date)
                      : null}
                  </td>{" "}
                  {/* Actual in arrear */}
                  <td>{arrear.shift ? arrear.shift : null}</td>{" "}
                  {/* Actual out arrear */}
                  <td>{arrear.punch_mark ? arrear.punch_mark : null}</td>{" "}
                  {/* Actual out deduction */}
                  <td>
                    {arrear.working_hours
                      ? formatTime(arrear.working_hours)
                      : null}
                  </td>{" "}
                  {/* Actual out arrear */}
                  <td>
                    {arrear.ot_hours ? formatTime(arrear.ot_hours) : null}
                  </td>{" "}
                  {/* Actual out arrear */}
                  <td>{arrear.remarks ? arrear.remarks : null}</td>{" "}
                  {/* Actual out arrear */}
                  <td>{arrear.created_by ? arrear.created_by : null}</td>{" "}
                  {/* Actual out arrear */}
                  <td>
                    {arrear.created_date
                      ? formatDate(arrear.created_date)
                      : null}
                  </td>{" "}
                  {/* Actual out arrear */}
                  <td>
                    <Button
                      size="sm"
                      onClick={() => handleDeleteDeduction(arrear)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9">No records found for the selected date</td>
              </tr>
            )}
            {/* Add new deduction row */}
            <tr>
              <td>
                <div className={styles["inline-fields"]}>
                  <Form.Control
                    type="text"
                    name="employee_code"
                    value={newArrear.employee_code}
                    onChange={handleInputChange}
                    onBlur={handleEmployeeValidate}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleEmployeeValidate();
                      }
                    }}
                    placeholder="Employee Code"
                    ref={employee_codeRef}
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
                  value={newArrear.display_name}
                  readOnly
                  className={styles["small-input"]}
                  placeholder="Display Name"
                />
              </td>
              <td>
                <Form.Control
                  type="date"
                  name="attendance_date"
                  //value={formatDateForNewInput(newArrear.attendance_date)}
                  value={
                    newArrear.attendance_date
                      ? formatDateForInput(newArrear.attendance_date)
                      : ""
                  }
                  onChange={handleInputChange}
                  className={styles["small-input"]}
                  placeholder="Display Name"
                />
              </td>
              <td>
                <Select
                  options={shiftsList}
                  value={shiftsList.find(
                    (option) => option.value === selectedShift
                  ) || null}
                  onChange={(selectedOption) =>
                    setSelectedShift(selectedOption.value)
                  }
                  //value={newArrear.shift}
                  //onChange={(selectedOption) => customHandleChangeSingle(selectedOption, setSelectedShift)}
                  components={{ Option: CustomOption }}
                  placeholder="Select Shift"
                  styles={customStyles2}
                  isSearchable={false}
                  menuPortalTarget={document.body} // Render dropdown in body
                  menuPosition="fixed" // Position dropdown relative to viewport
                  closeMenuOnSelect={true}
                  className={`${styles["small-input"]} small-select`} // Add the custom CSS class here
                />
              </td>
              <td>
                <Select
                  options={staticPunchMarksList}
                  value={staticPunchMarksList.find(
                    (option) => option.value === selectedPunchMark
                  ) || null}
                  onChange={(selectedOption) =>
                    setSelectedPunchMark(selectedOption.value)
                  }
                  //value={newArrear.punch_mark}
                  //onChange={(selectedOption) => customHandleChangeSingle(selectedOption, setSelectedPunchMark)}
                  components={{ Option: CustomOption }}
                  placeholder="Select Muster Mark"
                  styles={customStyles2}
                  isSearchable={false}
                  menuPortalTarget={document.body} // Render dropdown in body
                  menuPosition="fixed" // Position dropdown relative to viewport
                  closeMenuOnSelect={true}
                  className={`${styles["small-input"]} small-select`} // Add the custom CSS class here
                />
              </td>

              <td>
                <Form.Control
                  className={styles["small-input2"]}
                  type="time"
                  value={newArrear.working_hours}
                  onChange={handleInputChange}
                  name="working_hours"
                />
              </td>
              <td>
                <Form.Control
                  className={styles["small-input2"]}
                  type="time"
                  value={newArrear.ot_hours}
                  onChange={handleInputChange}
                  name="ot_hours"
                />
              </td>
              <td colSpan={3}>
                <Form.Control
                  type="text"
                  className={styles["small-input"]}
                  name="remarks"
                  value={newArrear.remarks}
                  onChange={handleInputChange}
                  placeholder="Remarks"
                />
              </td>
              <td>
                <Button
                  size="sm"
                  onClick={handleAddArrear}
                  className={styles["small-button"]}
                  disabled={isAddDisabled || !newArrear.attendance_date || !selectedShift || !selectedPunchMark} // Disable the Add button when no valid employee code
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

export default ManualMuster;
