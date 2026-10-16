import React, { useState, useEffect, useRef } from "react";
import { Table, Form, Button, Alert, Modal } from "react-bootstrap";
import axios from "../../api/axios.js";
import { FaSearch } from "react-icons/fa";
import styles from "./AddWageDeductionsGrid.module.css";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { registerEmployee, selectUser } from "../../features/userSlice";
import Select from "react-select";
import UploadDeductions from "../../components/UploadDeductions";
import { apiErrorMessage } from "../../utils/apiError";

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

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const AddWageDeductionsGrid = () => {
  const [dedData, setDedData] = useState([]); // Stores fetched deduction data
  const [pmonth, setPmonth] = useState(""); // Stores the selected date
  const [pmonthList, setPmonthList] = useState(""); // Stores the selected date
  const [selectedPmonth, setSelectedPmonth] = useState([]);

  const [billingType, setBillingType] = useState(""); // Stores the selected date
  const [billingCycle, setBillingCycle] = useState(""); // Stores the selected date
  const [selectedBillingCycle, setSelectedBillingCycle] = useState([]);

  const [dedCode, setDedCode] = useState(""); // Stores the selected contractor ID
  const [dedCodes, setDedCodes] = useState(""); // Stores the selected contractor ID
  const [selectedDedCode, setSelectedDedCode] = useState(""); // Stores the selected contractor ID

  const [dedValue, setdedValue] = useState(""); // Stores the selected contractor ID
  const [remarks, setRemarks] = useState(""); // Stores the selected contractor ID
  const [contractorID, setContractorID] = useState([]); // Stores fetched contractors list
  const [contractors, setContractors] = useState([]); // Stores fetched contractors list
  const [error, setError] = useState(""); // Stores error messages
  const [loading, setLoading] = useState(false); // Tracks loading state for API calls
  const [showUpload, setShowUpload] = useState(true);
  const [hasUploadPermission, setHasUploadPermission] = useState(false); // Track permission for upload

  const employee_codeRef = useRef(null);

  const [newDeduction, setNewDeduction] = useState({
    employee_code: "",
    pmonth: "",
    billingType: "",
    dedCode: "",
    dedValue: "",
    created_by: "",
    remarks: "",
  });
  const [successMessage, setSuccessMessage] = useState(""); // Tracks success message

  // ✅ IMPORTANT: we keep this behavior: Add disabled until employee valid
  const [isAddDisabled, setIsAddDisabled] = useState(true);

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
        const response = await checkUserPermission(emp_id, 2);
        setHasUploadPermission(() => response);
      } catch (error) {
        console.error("Error fetching permission:", error);
      }
    };
    fetchPermission();
    fetchContractorData();
    fetchBillingCycleData();
    fetchPmonthData();
    fetchDedCodesData();
    setShowUpload(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGetDeduction = async () => {
    fetchDeductionData();
    employee_codeRef.current.focus();
  };

  /* =========================================================
     ✅ FIXED EMPLOYEE VALIDATION (ManualMuster / CLMS Standard)
     - No length check
     - Validate only on blur / Enter
     - Search selection triggers SAME path
  ========================================================= */
  const handleEmployeeValidate = async (empCodeParam) => {
    const empCode =
      typeof empCodeParam === "string"
        ? empCodeParam
        : empCodeParam?.target?.value;

    const code = String(empCode || "").trim();
    if (!code) {
      setIsAddDisabled(true);
      setNewDeduction((prev) => ({ ...prev, display_name: "" }));
      return;
    }

    try {
      setIsAddDisabled(true);
      setError("");

      const response = await axios.post("/api/employee/getEmployeeByCode", {
        employee_code: code, // ✅ ALWAYS STRING
      });

      if (!response.data || response.data.length === 0) {
        setError("Employee code not found");
        setIsAddDisabled(true);
        setNewDeduction((prev) => ({ ...prev, display_name: "" }));
        return;
      }

      setNewDeduction((prev) => ({
        ...prev,
        employee_code: code,
        display_name: response.data[0].display_name,
      }));

      setIsAddDisabled(false); // ✅ valid employee
    } catch (err) {
      console.error(err);
      setError("Error validating employee");
      setIsAddDisabled(true);
      setNewDeduction((prev) => ({ ...prev, display_name: "" }));
    }
  };

  /* =========================================================
     Handle input changes (baseline kept)
     ✅ Only change: do NOT validate while typing, just reset
  ========================================================= */
  const handleInputChange = async (e) => {
    const { name, value } = e.target;

    setNewDeduction((prev) => ({
      ...prev,
      [name]: value,
    }));

    // ✅ When employee_code changes, reset validation until blur/enter
    if (name === "employee_code") {
      setIsAddDisabled(true);
      setError("");
      setNewDeduction((prev) => ({
        ...prev,
        display_name: "",
      }));
    }
  };

  // Handle input changes for updating existing deductiones
  const handleUpdateInputChange = (e, deduction, index) => {
    const { name, value } = e.target;
    const updatedDeduction = { ...deduction, [name]: value };
    const updatedData = dedData.map((item, i) =>
      i === index ? updatedDeduction : item
    );
    setDedData(updatedData); // Update deduction data in the state
  };

  // Add new deduction record
  const handleAddDeduction = async () => {
    try {
      console.log("New Deduction at Insert:", newDeduction);
      const response = await axios.post("/api/wages/addWageDeductions", {
        ...newDeduction,
        pmonth: selectedPmonth.value,
        dedCode: selectedDedCode.value,
        billingType: selectedBillingCycle.value,
        created_by: emp_id, // Adjust based on actual user
      });

      console.log("Testing---1");
      console.log("Add response:", response);

      if (response.status == 200) {
        console.log("Testing---2");

        setDedData([
          ...dedData,
          {
            ...newDeduction,
            pmonth: selectedPmonth.value,
            dedCode: selectedDedCode.value,
            billingType: selectedBillingCycle.value,
          },
        ]);

        // Reset the form fields
        setNewDeduction({
          employee_code: "",
          display_name: "",
          pmonth: "",
          billingType: "",
          dedCode: "",
          dedValue: "",
          remarks: "",
          created_by: "",
        });

        // Reset validation
        setIsAddDisabled(true);

        // Show success message
        setSuccessMessage("Record added successfully.");
        setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
        employee_codeRef.current.focus();
      } else {
        console.log("Testing---3");
        setError("Error adding deduction at 2" + response);
      }
    } catch (err) {
      console.log("Testing---4");
      console.error("Error adding deduction at err:", err);
      setError(`Error adding deduction: ${apiErrorMessage(err)}`);
    }
  };

  const fetchDeductionData = async () => {
    try {
      console.log("Inputs:", billingType);
      const response = await axios.post("/api/wages/getWageDeductions", {
        billingType: selectedBillingCycle.value,
        pmonth: selectedPmonth.value,
        dedCode: selectedDedCode.value,
      });
      console.log("Response,", response);
      setDedData(Array.isArray(response.data) ? response.data : []);
      console.log(response);
      console.log("dedData", dedData);
    } catch (error) {
      console.error("Error fetching getWageDeductions:", error);
      setError(`Error fetching wage deductions: ${apiErrorMessage(error)}`);
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

  const fetchDedCodesData = async () => {
    try {
      const response = await axios.get("/api/wages/getDedCodes");
      const formattedDedCodes = response.data.map((item) => ({
        value: item.dedCode || item.ded_code,
        label: item.dedName || item.ded_name || item.ded_desc || item.dedCode || item.ded_code,
      }));
      setDedCodes(formattedDedCodes); // Set the correct formatted array
    } catch (error) {
      console.error("Error fetching Billing Cycles:", error);
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

  // Update existing deduction record
  const handleUpdateDeduction = async (updatedDeduction, index) => {
    console.log("updatedDeduction:", updatedDeduction);
    try {
      const response = await axios.post("/api/wages/updateWageDeductions", {
        ...updatedDeduction,
        pmonth: updatedDeduction.pmonth
          ? String(updatedDeduction.pmonth).slice(0, 10)
          : selectedPmonth?.value,
        dedCode:
          updatedDeduction.dedCode ||
          updatedDeduction.ded_code ||
          selectedDedCode?.value,
        billingType:
          updatedDeduction.billingType || selectedBillingCycle?.value,
        modified_by: emp_id, // Adjust based on actual user
      });

      if (response.status == 200) {
        const updatedData = dedData.map((deduction, i) =>
          i === index ? updatedDeduction : deduction
        );
        setDedData(updatedData); // Update the deduction data in the grid
        setSuccessMessage("Record updated successfully.");
        setTimeout(() => setSuccessMessage(""), 3000);
        employee_codeRef.current.focus();
      } else {
        setError("Error updating deduction at 2");
      }
    } catch (err) {
      console.error("Error updating deduction at 3:", err);
      setError(`Error updating deduction: ${apiErrorMessage(err)}`);
    }
  };

  // Delete existing deduction record
  const handleDeleteDeduction = async (updatedDeduction) => {
    try {
      const response = await axios.post("/api/wages/deleteWageDeductions", {
        ...updatedDeduction,
        pmonth: updatedDeduction.pmonth
          ? String(updatedDeduction.pmonth).slice(0, 10)
          : selectedPmonth?.value,
        dedCode:
          updatedDeduction.dedCode ||
          updatedDeduction.ded_code ||
          selectedDedCode?.value,
        billingType:
          updatedDeduction.billingType || selectedBillingCycle?.value,
        modified_by: emp_id,
      });

      if (response.status == 200) {
        fetchDeductionData();
        setSuccessMessage("Record deleted successfully.");
        setTimeout(() => setSuccessMessage(""), 3000);
        employee_codeRef.current.focus();
      } else {
        setError("Error updating deduction at 2");
      }
    } catch (err) {
      console.error("Error updating deduction at 3:", err);
      setError(`Error updating deduction: ${apiErrorMessage(err)}`);
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
        dedCode: dedCode,
      });
      setSearchResults(response.data || []);
    } catch (err) {
      console.error("Error fetching employee search results:", err);
    }
  };

  // ✅ Select employee from search results (FIXED to force validation)
  const handleSelectEmployee = (employee) => {
    setNewDeduction((prev) => ({
      ...prev,
      employee_code: employee.employee_code,
      display_name: "",
      pmonth: "",
      billingType: "",
      dedCode: "",
      dedValue: "",
      remarks: "",
      created_by: "",
    }));

    setIsAddDisabled(true);
    setError("");
    closeEmployeeSearch();

    // 🔥 force SAME validation path
    setTimeout(() => {
      handleEmployeeValidate(employee.employee_code);
    }, 0);
  };

  const handleShowUpload = () => {
    setShowUpload(true);
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
      <h3>Monthly Deductions</h3>
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
            Deduction Code
          </Form.Label>
          <Select
            options={dedCodes}
            value={selectedDedCode}
            onChange={(selectedOption) =>
              customHandleChangeSingle(selectedOption, setSelectedDedCode)
            }
            components={{ Option: CustomOption }}
            placeholder="Select Deduction Code"
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
            disabled={!hasUploadPermission}
          >
            Upload Deductions
          </Button>
          {showUpload && (
            <UploadDeductions
              setShowUpload={setShowUpload}
              created_by={user.emp_id}
            />
          )}
        </Form.Group>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <Table bordered className={styles["compact-grid"]}>
          <thead>
            <tr>
              <th>Employee Code</th>
              <th>Display Name</th>
              <th>Ded Code</th>
              <th>Ded Name</th>
              <th>Amount</th>
              <th>Remarks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {dedData.length > 0 ? (
              dedData.map((deduction, index) => (
                <tr
                  key={[
                    deduction.employee_code,
                    deduction.pmonth,
                    deduction.billingType,
                    deduction.dedCode,
                  ].join("|")}
                >
                  <td className={styles["left-justify"]}>
                    {deduction.employee_code}
                  </td>
                  <td className={styles["left-justify"]}>
                    {deduction.display_name || "No Name"}
                  </td>
                  <td>{deduction.dedCode ? deduction.dedCode : null}</td>
                  <td>{deduction.ded_name ? deduction.ded_name : null}</td>
                  <td>
                    <Form.Control
                      className={styles["small-input"]}
                      type="decimal"
                      value={deduction.dedValue}
                      onChange={(e) => handleUpdateInputChange(e, deduction, index)}
                      name="dedValue"
                    />
                  </td>
                  <td>
                    <Form.Control
                      className={styles["small-input"]}
                      type="remarks"
                      value={deduction.remarks}
                      onChange={(e) => handleUpdateInputChange(e, deduction, index)}
                      name="remarks"
                    />
                  </td>
                  <td>
                    <div>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateDeduction(deduction, index)}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDeleteDeduction(deduction)}
                      >
                        Delete
                      </Button>
                    </div>
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
                    value={newDeduction.employee_code}
                    onChange={handleInputChange}
                    onBlur={handleEmployeeValidate} // ✅ validate on blur
                    onKeyDown={(e) => {
                      // ✅ validate on enter
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleEmployeeValidate(newDeduction.employee_code);
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
                    <FaSearch />
                  </Button>
                </div>
              </td>

              <td>
                <Form.Control
                  type="text"
                  name="display_name"
                  value={newDeduction.display_name}
                  readOnly
                  className={styles["small-input"]}
                  placeholder="Display Name"
                />
              </td>

              <td>{newDeduction.dedCode ? newDeduction.dedCode : null}</td>
              <td>{newDeduction.ded_name ? newDeduction.ded_name : null}</td>

              <td>
                <Form.Control
                  className={styles["small-input"]}
                  type="decimal"
                  value={newDeduction.dedValue}
                  onChange={handleInputChange}
                  name="dedValue"
                />
              </td>

              <td>
                <Form.Control
                  type="text"
                  className={styles["small-input"]}
                  name="remarks"
                  value={newDeduction.remarks}
                  onChange={handleInputChange}
                  placeholder="Remarks"
                />
              </td>

              <td>
                <Button
                  size="sm"
                  onClick={handleAddDeduction}
                  className={styles["small-button"]}
                  disabled={isAddDisabled}
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

export default AddWageDeductionsGrid;
