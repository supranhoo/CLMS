import React, { useState, useEffect, useRef } from "react";
import { Table, Form, Button, Alert, Modal } from "react-bootstrap";
import axios from "../../api/axios.js";
import { FaSearch } from "react-icons/fa";
import styles from "./AddWageEarningsGrid.module.css";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";
import Select from "react-select";
import UploadEarnings from "../../components/UploadEarnings";

/* ================================
   Permission Helper (unchanged)
================================ */
const checkUserPermission = async (emp_id, activity_id) => {
  try {
    const response = await axios.post(
      "/api/assignRoles/getUserMenuActivityForSpecificMenu",
      { emp_id, activity_id },
      { headers: { "Cache-Control": "no-cache" } }
    );
    return !!(response.data && response.data.length > 0);
  } catch (error) {
    console.error("Error checking user permission:", error);
    return false;
  }
};

const customStyles = {
  control: (base) => ({
    ...base,
    minWidth: "200px",
    maxWidth: "400px",
    borderColor: "#aaa",
    boxShadow: "none",
    "&:hover": { borderColor: "#888" },
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

const AddWageEarningsGrid = () => {
  const [ernData, setErnData] = useState([]); // Stores fetched earning data

  const [pmonth, setPmonth] = useState([]); // options list based on billing cycle
  const [pmonthList, setPmonthList] = useState([]); // kept as baseline (even if not used)
  const [selectedPmonth, setSelectedPmonth] = useState(null);

  const [billingType, setBillingType] = useState(""); // kept baseline
  const [billingCycle, setBillingCycle] = useState([]);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState(null);

  const [ernCode, setErnCode] = useState(""); // kept baseline
  const [ernCodes, setErnCodes] = useState([]);
  const [selectedErnCode, setSelectedErnCode] = useState(null);

  const [ernValue, seternValue] = useState(""); // kept baseline
  const [remarks, setRemarks] = useState(""); // kept baseline
  const [contractorID, setContractorID] = useState([]); // kept baseline
  const [contractors, setContractors] = useState([]); // kept baseline

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [hasUploadPermission, setHasUploadPermission] = useState(false);

  const employee_codeRef = useRef(null);

  const [newEarning, setNewEarning] = useState({
    employee_code: "",
    display_name: "",
    pmonth: "",
    billingType: "",
    ernCode: "",
    ernValue: "",
    created_by: "",
    remarks: "",
  });

  const [successMessage, setSuccessMessage] = useState("");
  const [isAddDisabled, setIsAddDisabled] = useState(true); // 🔒 Add button controlled by validation

  const [showEmployeeSearch, setShowEmployeeSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();

  /* ================================
     INIT (baseline preserved)
  ================================ */
  useEffect(() => {
    const init = async () => {
      try {
        const response = await checkUserPermission(emp_id, 2);
        setHasUploadPermission(() => response);
      } catch (error) {
        console.error("Error fetching permission:", error);
      }

      fetchContractorData();
      fetchBillingCycleData();
      fetchPmonthData();
      fetchErnCodesData();
      setShowUpload(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================================
     Helpers (baseline)
  ================================ */
  const customHandleChangeSingle = (selectedOption, setSelectedOption) => {
    if (!selectedOption) {
      setSelectedOption(null);
      return;
    }
    setSelectedOption(selectedOption);
  };

  /* =========================================================
     ✅ CLMS UI Standard – Employee Input (ManualMuster Pattern)
     RULES:
     - No validation on typing
     - Validate ONLY on blur / Enter
     - Search select must force SAME validation function
     - Add enabled only after successful validation
  ========================================================= */

  // 1) onChange: only update, reset display name, lock Add
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setNewEarning((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "employee_code") {
      setIsAddDisabled(true);
      setError("");

      setNewEarning((prev) => ({
        ...prev,
        display_name: "",
      }));
    }
  };

  // 2) Single validation function (source of truth)
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
        employee_code: String(empCode), // ✅ ALWAYS STRING
      });

      // Support both array and object response (non-breaking safety)
      const rows = Array.isArray(response.data)
        ? response.data
        : response.data
          ? [response.data]
          : [];

      if (!rows || rows.length === 0) {
        setError("Employee code not found");
        return;
      }

      setNewEarning((prev) => ({
        ...prev,
        employee_code: String(empCode),
        display_name: rows[0].display_name || "",
      }));

      setIsAddDisabled(false); // ✅ VALID EMPLOYEE
    } catch (err) {
      console.error(err);
      setError("Error validating employee");
      setIsAddDisabled(true);
    }
  };

  /* ================================
     Update existing earning row
  ================================ */
  const handleUpdateInputChange = (e, earning) => {
    const { name, value } = e.target;
    const updatedEarning = { ...earning, [name]: value };
    const updatedData = ernData.map((item) =>
      item.employee_code === earning.employee_code ? updatedEarning : item
    );
    setErnData(updatedData);
  };

  /* ================================
     Add new earning (baseline preserved)
  ================================ */
  const handleAddEarning = async () => {
    try {
      setError("");
      setSuccessMessage("");

      // Non-breaking safety: avoid crash if dropdowns not selected
      if (
        !selectedBillingCycle?.value ||
        !selectedPmonth?.value ||
        !selectedErnCode?.value
      ) {
        setError("Please select Billing Type, Process Month and Earning Code.");
        return;
      }

      // In case user clicks Add without blur/enter, validate once (safe)
      if (isAddDisabled) {
        await handleEmployeeValidate(newEarning.employee_code);
        // if still disabled, stop
        if (isAddDisabled) return;
      }

      const response = await axios.post("/api/wages/addWageEarnings", {
        ...newEarning,
        pmonth: selectedPmonth.value,
        ernCode: selectedErnCode.value,
        billingType: selectedBillingCycle.value,
        created_by: emp_id,
      });

      if (response.status === 200) {
        // Refresh grid to show server values
        await fetchEarningData();

        setNewEarning({
          employee_code: "",
          display_name: "",
          pmonth: "",
          billingType: "",
          ernCode: "",
          ernValue: "",
          remarks: "",
          created_by: "",
        });

        setIsAddDisabled(true);

        setSuccessMessage("Record added successfully.");
        setTimeout(() => setSuccessMessage(""), 3000);

        employee_codeRef.current?.focus();
      } else {
        setError("Error adding earning.");
      }
    } catch (err) {
      console.error("Error adding earning:", err);
      setError(
        "Error adding earning: " +
          (err?.response?.data?.message || err?.message || "Unknown error")
      );
    }
  };

  /* ================================
     Fetch Earning Data
  ================================ */
  const fetchEarningData = async () => {
    try {
      setLoading(true);
      const response = await axios.post("/api/wages/getWageEarnings", {
        billingType: selectedBillingCycle?.value,
        pmonth: selectedPmonth?.value,
        ernCode: selectedErnCode?.value,
      });
      setErnData(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching getWageEarnings:", error);
      setError("Error fetching wage earnings.");
      setErnData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGetEarning = async () => {
    await fetchEarningData();
    employee_codeRef.current?.focus();
  };

  /* ================================
     Masters (baseline preserved)
  ================================ */
  const fetchContractorData = async () => {
    try {
      const response = await axios.get("/api/contractor/getAllContractors");
      setContractors(response.data || []);
    } catch (error) {
      console.error("Error fetching contractors:", error);
    }
  };

  const fetchBillingCycleData = async () => {
    try {
      const response = await axios.get("/api/employee/getBillingType");
      const formattedBillingCycle = (response.data || []).map((item) => ({
        value: item.billingtype_code,
        label: item.billingtype_name,
      }));
      setBillingCycle(formattedBillingCycle);
    } catch (error) {
      console.error("Error fetching Billing Cycles:", error);
    }
  };

  const fetchErnCodesData = async () => {
    try {
      const response = await axios.get("/api/wages/getErnCodes");
      const formattedErnCodes = (response.data || []).map((item) => ({
        value: item.ernCode,
        label: item.ernName,
      }));
      setErnCodes(formattedErnCodes);
    } catch (error) {
      console.error("Error fetching Earning Codes:", error);
    }
  };

  const fetchPmonthData = async () => {
    try {
      const response = await axios.post("/api/wages/getProcessMonth");
      const formattedPmonth = (response.data || []).map((item) => ({
        pmonth: item.pmonth,
      }));
      setPmonthList(formattedPmonth);
    } catch (error) {
      console.error("Error fetching Process Month:", error);
    }
  };

  const fetchPmonthByBillingCycle = async (billingType) => {
    try {
      const response = await axios.post(
        "/api/wages/getProcessMonthByBillingCycle",
        { billingtype: billingType }
      );

      const formattedPmonth = (response.data || []).map((item) => ({
        value: item.pmonth,
        label: item.pmonth,
      }));
      setPmonth(formattedPmonth);
    } catch (error) {
      console.error("Error fetching Process Months by Billing Type:", error);
    }
  };

  const handleBillingCycleChange = (selectedOption) => {
    setSelectedBillingCycle(selectedOption);

    if (selectedOption && selectedOption.value) {
      fetchPmonthByBillingCycle(selectedOption.value);
    } else {
      setPmonth([]);
    }
  };

  /* ================================
     Update / Delete (baseline preserved)
  ================================ */
  const handleUpdateEarning = async (updatedEarning) => {
    try {
      setError("");
      setSuccessMessage("");

      const response = await axios.post("/api/wages/updateWageEarnings", {
        ...updatedEarning,
        pmonth: selectedPmonth?.value,
        ernCode: selectedErnCode?.value,
        billingType: selectedBillingCycle?.value,
        modified_by: emp_id,
      });

      if (response.status === 200) {
        const updatedData = ernData.map((earning) =>
          earning.employee_code === updatedEarning.employee_code
            ? updatedEarning
            : earning
        );
        setErnData(updatedData);

        setSuccessMessage("Record updated successfully.");
        setTimeout(() => setSuccessMessage(""), 3000);

        employee_codeRef.current?.focus();
      } else {
        setError("Error updating earning.");
      }
    } catch (err) {
      console.error("Error updating earning:", err);
      setError(
        "Error updating earning: " +
          (err?.response?.data?.message || err?.message || "Unknown error")
      );
    }
  };

  const handleDeleteEarning = async (row) => {
    try {
      setError("");
      setSuccessMessage("");

      const response = await axios.post("/api/wages/deleteWageEarnings", {
        ...row,
        pmonth: selectedPmonth?.value,
        ernCode: selectedErnCode?.value,
        billingType: selectedBillingCycle?.value,
        modified_by: emp_id,
      });

      if (response.status === 200) {
        await fetchEarningData();
        setSuccessMessage("Record deleted successfully.");
        setTimeout(() => setSuccessMessage(""), 3000);

        employee_codeRef.current?.focus();
      } else {
        setError("Error deleting earning.");
      }
    } catch (err) {
      console.error("Error deleting earning:", err);
      setError(
        "Error deleting earning: " +
          (err?.response?.data?.message || err?.message || "Unknown error")
      );
    }
  };

  /* ================================
     Employee Search Modal (baseline preserved)
  ================================ */
  const openEmployeeSearch = () => setShowEmployeeSearch(true);
  const closeEmployeeSearch = () => setShowEmployeeSearch(false);

  const handleSearchEmployees = async () => {
    try {
      const response = await axios.post("/api/employee/searchEmployees", {
        searchTerm: searchTerm,
        ernCode: ernCode, // kept baseline variable (even if not used)
      });
      setSearchResults(response.data || []);
    } catch (err) {
      console.error("Error fetching employee search results:", err);
    }
  };

  const handleSelectEmployee = (employee) => {
    setNewEarning((prev) => ({
      ...prev,
      employee_code: employee.employee_code,
      display_name: "",
    }));

    setIsAddDisabled(true);
    setError("");
    closeEmployeeSearch();

    // 🔥 force SAME validation path (ManualMuster pattern)
    setTimeout(() => {
      handleEmployeeValidate(employee.employee_code);
    }, 0);
  };

  /* ================================
     Upload (baseline preserved)
  ================================ */
  const handleShowUpload = () => {
    setShowUpload(true);
  };

  /* ================================
     Auth Guard (baseline preserved)
  ================================ */
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
      <h3>Monthly Variable Earnings</h3>

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
            Earning Code
          </Form.Label>
          <Select
            options={ernCodes}
            value={selectedErnCode}
            onChange={(selectedOption) =>
              customHandleChangeSingle(selectedOption, setSelectedErnCode)
            }
            components={{ Option: CustomOption }}
            placeholder="Select Earning Code"
            styles={customStyles}
            closeMenuOnSelect={true}
            className={styles["small-input"]}
          />
        </Form.Group>

        <Form.Group className={styles["form-row"]}>
          <Button
            size="lg"
            onClick={handleGetEarning}
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
            Upload Earnings
          </Button>

          {showUpload && (
            <UploadEarnings setShowUpload={setShowUpload} created_by={emp_id} />
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
              <th>Earn Code</th>
              <th>Earn Name</th>
              <th>Amount</th>
              <th>Remarks</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {ernData.length > 0 ? (
              ernData.map((earning) => (
                <tr key={earning.employee_code}>
                  <td className={styles["left-justify"]}>
                    {earning.employee_code}
                  </td>
                  <td className={styles["left-justify"]}>
                    {earning.display_name || "No Name"}
                  </td>
                  <td>{earning.ernCode ? earning.ernCode : null}</td>
                  <td>{earning.ern_name ? earning.ern_name : null}</td>
                  <td>
                    <Form.Control
                      className={styles["small-input"]}
                      type="number"
                      step="0.01"
                      value={earning.ernValue}
                      onChange={(e) => handleUpdateInputChange(e, earning)}
                      name="ernValue"
                    />
                  </td>
                  <td>
                    <Form.Control
                      className={styles["small-input"]}
                      type="text"
                      value={earning.remarks || ""}
                      onChange={(e) => handleUpdateInputChange(e, earning)}
                      name="remarks"
                    />
                  </td>
                  <td>
                    <div>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateEarning(earning)}
                      >
                        Save
                      </Button>{" "}
                      <Button
                        size="sm"
                        onClick={() => handleDeleteEarning(earning)}
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

            {/* Add new earning row */}
            <tr>
              <td>
                <div className={styles["inline-fields"]}>
                  <Form.Control
                    type="text"
                    name="employee_code"
                    value={newEarning.employee_code}
                    onChange={handleInputChange}
                    onBlur={handleEmployeeValidate}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        // ManualMuster pattern: validate on Enter
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
                    title="Search Employee"
                  >
                    <FaSearch />
                  </Button>
                </div>
              </td>

              <td>
                <Form.Control
                  type="text"
                  name="display_name"
                  value={newEarning.display_name}
                  readOnly
                  className={styles["small-input"]}
                  placeholder="Display Name"
                />
              </td>

              <td>{selectedErnCode?.value || null}</td>
              <td>{selectedErnCode?.label || null}</td>

              <td>
                <Form.Control
                  className={styles["small-input"]}
                  type="number"
                  step="0.01"
                  value={newEarning.ernValue}
                  onChange={handleInputChange}
                  name="ernValue"
                />
              </td>

              <td>
                <Form.Control
                  type="text"
                  className={styles["small-input"]}
                  name="remarks"
                  value={newEarning.remarks}
                  onChange={handleInputChange}
                  placeholder="Remarks"
                />
              </td>

              <td>
                <Button
                  size="sm"
                  onClick={handleAddEarning}
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
            <ul style={{ marginTop: 10 }}>
              {searchResults.map((employee) => (
                <li
                  key={employee.employee_code}
                  style={{ cursor: "pointer", marginBottom: 6 }}
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

export default AddWageEarningsGrid;
