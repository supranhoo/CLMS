import React, { useState, useEffect, useRef } from "react";
import { Table, Form, Button, Alert, Modal } from "react-bootstrap";
import axios from "../../api/axios.js";
import { FaSearch } from "react-icons/fa";
import styles from "./AddWageDeductionsGrid.module.css";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { registerEmployee, selectUser } from "../../features/userSlice";
import Select from "react-select";
import UploadArrears from "../../components/UploadArrears";

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

// Utility function to format datetime strings for <input type="datetime-local">
const formatDateForInput = (dateString) => {
  if (!dateString) return ""; // Handle null or empty values
  const date = new Date(dateString);
  const formattedDate = date.toISOString().slice(0, 16); // This trims to "YYYY-MM-DDTHH:mm"
  return formattedDate;
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

const AddWageArrearsGrid = () => {
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

  const [arrearPmonthList, setArrearPmonthList] = useState([]); // Stores the selected date
  const [selectedArrearPmonth, setSelectedArrearPmonth] = useState([]);

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
    pmonth: "",
    billingType: "",
    arrearCode: "",
    arrearValue: "",
    created_by: "",
    remarks: "",
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
    const fetchPermission = async () => {
      try {
        const response = await checkUserPermission(emp_id, 3);
        setHasUploadPermission(() => response);
      } catch (error) {
        console.error("Error fetching permission:", error);
      }
    };

    fetchPermission();
    fetchContractorData();
    fetchBillingCycleData();
    fetchPmonthData();
    fetchArrearCodesData();
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
    if (name === "employee_code" && value.length == 7) {
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
    setNewDeduction({ ...newArrear, [name]: value });

    if (name === "employee_code") {
      setIsAddDisabled(true); // lock Add while typing
      setNewDeduction((prev) => ({
        ...prev,
        display_name: "",
      }));
    }
  };

  // Handle input changes for updating existing deductiones
  const handleUpdateInputChange = (e, deduction) => {
    const { name, value } = e.target;
    const updatedPunch = { ...deduction, [name]: value };
    const updatedData = arrearsData.map((item) =>
      item.employee_code === deduction.employee_code ? updatedPunch : item,
    );
    setArrearsData(updatedData); // Update deduction data in the state
  };

  // Update existing deduction record
  const handleUpdateArrear = async (updatedDeduction) => {
    console.log("updatedDeduction:", updatedDeduction);
    try {
      const response = await axios.post("/api/wages/updateWageArrears", {
        ...updatedDeduction,
        pmonth: selectedPmonth.value,
        arrearCode: selectedArrearCode.value,
        billingType: selectedBillingCycle.value,
        modified_by: emp_id, // Adjust based on actual user
      });

      if (response.status == 200) {
        const updatedData = arrearsData.map((deduction) =>
          deduction.employee_code === updatedDeduction.employee_code
            ? updatedDeduction
            : deduction,
        );
        setArrearsData(updatedData); // Update the deduction data in the grid
        // Show success message
        setSuccessMessage("Record updated successfully.");
        setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
        employee_codeRef.current.focus();
      } else {
        if (response.data.error.originalError.info.message) {
          setError(
            "Error updating deduction.1" +
              response.data.error.originalError.info.message,
          );
        } else {
          setError("Error updating deduction at 2" + response);
        }
      }
    } catch (err) {
      console.error("Error updating deduction at 3:", err);
      if (err.response.data.message) {
        setError("Error updating deduction.3" + err.response.data.message);
      } else {
        setError("Error updating deduction.3" + err);
      }
    }
  };

  // ---------------- EMPLOYEE VALIDATION (CLMS STANDARD) ----------------
  const validateEmployeeCode = async (empCode) => {
    if (!empCode) {
      setIsAddDisabled(true);
      return;
    }

    try {
      const response = await axios.post("/api/employee/getEmployeeByCode", {
        employee_code: empCode,
      });

      if (response.data && response.data.length > 0) {
        setNewDeduction((prev) => ({
          ...prev,
          employee_code: empCode,
          display_name: response.data[0].display_name,
        }));
        setIsAddDisabled(false);
        setError("");
      } else {
        setError("Employee code not found");
        setIsAddDisabled(true);
      }
    } catch (err) {
      console.error("Employee validation error:", err);
      setError("Error validating employee");
      setIsAddDisabled(true);
    }
  };

  // Add new deduction record
  const handleAddArrear = async () => {
    try {
      const response = await axios.post("/api/wages/addWageArrears", {
        ...newArrear,
        pmonth: selectedPmonth.value,
        arrearRefPmonth: selectedArrearPmonth.value,
        arrearCode: selectedArrearCode.value,
        billingType: selectedBillingCycle.value,
        created_by: emp_id, // Adjust based on actual user
      });

      console.log("Testing---1");
      console.log("Add response:", response);

      if (response.status == 200) {
        console.log("Testing---2");

        setArrearsData([...arrearsData, newArrear]);

        // Reset the form fields
        setNewDeduction({
          employee_code: "",
          display_name: "",
          pmonth: "",
          billingType: "",
          arrearCode: "",
          arrearValue: "",
          remarks: "",
          created_by: "",
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
      setError("Error adding deduction.3" + err);
      //}
    }
  };

  const fetchDeductionData = async () => {
    try {
      console.log("Inputs:", billingType);
      const response = await axios.post("/api/wages/getWageArrears", {
        billingType: selectedBillingCycle.value,
        pmonth: selectedPmonth.value,
        arrearCode: selectedArrearCode.value,
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
        value: item.arrearCode || item.arrear_code,
        label: item.arrearName || item.arrear_name || item.arrear_desc || item.arrearCode || item.arrear_code,
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

  const fetchArrearPmonthData = async (billingType) => {
    try {
      const response = await axios.post("/api/wages/getArrearProcessMonth", {
        billingtype: billingType,
      });
      console.log(response);
      const formattedAllPmonth = response.data.map((item) => ({
        value: item.pmonth,
        label: item.pmonth,
      }));
      setArrearPmonthList(formattedAllPmonth); // Set the correct formatted array
      console.log("ref.Pmonth:", arrearPmonthList);
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
        },
      );

      // Format the process month data
      const formattedPmonth = response.data.map((item) => ({
        value: item.pmonth,
        label: item.pmonth,
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
      fetchArrearPmonthData(selectedOption.value);
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
      const response = await axios.post("/api/wages/deleteWageArrears", {
        ...updatedDeduction,
        pmonth: selectedPmonth.value,
        ArrearCode: selectedArrearCode.value,
        billingType: selectedBillingCycle.value,
        modified_by: emp_id, // Adjust based on actual user
      });

      if (response.status == 200) {
        const updatedData = arrearsData.map((deduction) =>
          deduction.employee_code === updatedDeduction.employee_code
            ? updatedDeduction
            : deduction,
        );
        fetchDeductionData();
        //setDedData(updatedData); // Update the deduction data in the grid
        // Show success message
        setSuccessMessage("Record deleted successfully.");
        setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
        employee_codeRef.current.focus();
      } else {
        if (response.data.error.originalError.info.message) {
          setError(
            "Error updating deduction.1" +
              response.data.error.originalError.info.message,
          );
        } else {
          setError("Error updating deduction at 2" + response);
        }
      }
    } catch (err) {
      console.error("Error updating deduction at 3:", err);
      if (err.response.data.message) {
        setError("Error updating deduction.3" + err.response.data.message);
      } else {
        setError("Error updating deduction.3" + err);
      }
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
    closeEmployeeSearch();

    // force validation
    setTimeout(() => {
      validateEmployeeCode(employee.employee_code);
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
      <h3>Monthly Arrears</h3>
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
          <Form.Label className={styles["inline-label"]}>
            Arrear Code
          </Form.Label>
          <Select
            options={arrearCodes}
            value={selectedArrearCode}
            onChange={(selectedOption) =>
              customHandleChangeSingle(selectedOption, setSelectedArrearCode)
            }
            components={{ Option: CustomOption }}
            placeholder="Select Arrear Code"
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
          <Button
            size="lg"
            onClick={handleShowUpload}
            className={styles["small-button"]}
            disabled={!hasUploadPermission} // Disable button if no permission
          >
            Upload Arrears
          </Button>
          {showUpload && (
            <UploadArrears
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
              <th style={{ width: "10%" }}>Employee Code</th>
              <th style={{ width: "15%" }}>Employee Name</th>
              <th style={{ width: "10%" }}>Arrear Code</th>
              <th style={{ width: "15%" }}>Description</th>
              <th style={{ width: "15%" }}>Ref .Month</th>
              <th style={{ width: "5%" }}>Days</th>
              <th style={{ width: "5%" }}>Amount</th>
              <th style={{ width: "10%" }}>Remarks</th>
              <th style={{ width: "10%" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {arrearsData.length > 0 ? (
              arrearsData.map((arrear) => (
                <tr key={arrear.employee_code}>
                  <td className={styles["left-justify"]}>
                    {arrear.employee_code}
                  </td>
                  <td className={styles["left-justify"]}>
                    {arrear.display_name || "No Name"}
                  </td>
                  <td>
                    {arrear.arrearCode || arrear.arrear_code || ""}
                  </td>{" "}
                  {/* Actual in arrear */}
                  <td>
                    {arrear.arrearName || arrear.arrear_name || arrear.arrear_desc || ""}
                  </td>{" "}
                  {/* Actual out arrear */}
                  <td>
                    {arrear.arrearRefPmonth
                      ? formatTime(arrear.arrearRefPmonth)
                      : null}
                  </td>{" "}
                  {/* Actual out deduction */}
                  <td>
                    <Form.Control
                      className={styles["small-input"]}
                      type="decimal"
                      value={arrear.arrearDays}
                      onChange={(e) => handleUpdateInputChange(e, arrear)}
                      name="arrearDays"
                    />
                  </td>
                  <td>
                    <Form.Control
                      className={styles["small-input"]}
                      type="decimal"
                      value={arrear.arrearValue}
                      onChange={(e) => handleUpdateInputChange(e, arrear)}
                      name="arrearValue"
                    />
                  </td>
                  <td>
                    <Form.Control
                      className={styles["small-input"]}
                      type="remarks"
                      value={arrear.remarks}
                      onChange={(e) => handleUpdateInputChange(e, arrear)}
                      name="remarks"
                    />
                  </td>
                  <td>
                    <Button
                      size="sm"
                      onClick={() => handleUpdateArrear(arrear)}
                    >
                      Save
                    </Button>
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
                    placeholder="Employee Code"
                    ref={employee_codeRef}
                    className={styles["employee-code-input"]}
                    onBlur={(e) => validateEmployeeCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        validateEmployeeCode(e.target.value);
                      }
                    }}
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
              <td styles={customStyles2}>
                {newArrear.arrearCode ? newArrear.arrearCode : null}
              </td>
              <td>{newArrear.arrearName || newArrear.arrear_name || selectedArrearCode?.label || ""}</td>
              <td>
                <Select
                  options={arrearPmonthList}
                  value={newArrear.arrearRefPmonth}
                  onChange={(selectedOption) =>
                    customHandleChangeSingle(
                      selectedOption,
                      setSelectedArrearPmonth,
                    )
                  }
                  components={{ Option: CustomOption }}
                  placeholder="Select Ref. Month"
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
                  type="decimal"
                  value={newArrear.arrearDays}
                  onChange={handleInputChange}
                  name="arrearDays"
                />
              </td>
              <td>
                <Form.Control
                  className={styles["small-input2"]}
                  type="decimal"
                  value={newArrear.arrearValue}
                  onChange={handleInputChange}
                  name="arrearValue"
                />
              </td>
              <td>
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

export default AddWageArrearsGrid;
