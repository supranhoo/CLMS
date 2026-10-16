import React, { useState, useEffect, useRef } from "react";
import MainScreen from "../../components/MainScreen";
import { Table, Button, Row, Col, Form, Alert, Modal } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { registerEmployee, selectUser } from "../../features/userSlice";
import Loading from "../../components/Loading";
import ErrorMessage from "../../components/ErrorMessage";
import "./Wages.css";
import axios from "../../api/axios.js";
import "./Paginated1.css";
import "./Paginated2.css";
import styles from "../AttendanceMuster/RegularizePunchGrid.module.css";
import { FaSearch } from "react-icons/fa";

const ManageFixWages = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [errors, setErrors] = useState({}); // State for errors
  const [formData, setFormData] = useState([]);
  const [error1, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState(""); // Tracks success message

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneOffset = new Date().getTimezoneOffset();
  const timezoneOffsetInHours = timezoneOffset / 60;

  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const employeeIdRef = useRef(null); // Ref for EmployeeCode input field
  const BillingTypeRef = useRef(null);
  const eff_dateRef = useRef(null); // Add this at the top
  const BasicRateRef = useRef(null);
  const DARateRef = useRef(null);
  const JaggeryRateRef = useRef(null);
  const PFApplyRef = useRef(null);
  const ESIApplyRef = useRef(null);
  const LWFApplyRef = useRef(null);
  const gridRef = useRef(null);
  const OTHALWRTRef = useRef(null);
  const HRARTRef = useRef(null);
  const TRALWRTRef = useRef(null);
  const UNALWRTRef = useRef(null);
  const OTFactorRef = useRef(null);
  const MEDIALWRTRef = useRef(null);
  const CONALWRTRef = useRef(null);
  const HRAOLDRTRef = useRef(null);

  // Dropdown data states
  //const [salutationList, setSalutationList] = useState([]);
  const [employeeList, setEmployeeList] = useState([]);
  const [showEmployeeSearch, setShowEmployeeSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]); // Search results for employees

  const today = new Date(); // Current date
  const birthDate = new Date(formData.Dateof_Birth); // Date of birth from form

  useEffect(() => {
    fetchDropdownData();
    fetchEmployees();
  }, []);

  useEffect(() => {
    const filtered = employees.filter((employee) => {
      const { EmployeeCode, EmployeeName } = employee;
      if (!searchTerm) return true; // Return all if searchTerm is empty
      return (
        (EmployeeName &&
          EmployeeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (EmployeeCode &&
          EmployeeCode.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    });

    setFilteredEmployees(filtered);
  }, [searchTerm, employees]);

  useEffect(() => {
    console.log("Updated error1 state:", error1);
  }, [error1]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await axios.post("/api/wages/getFixWagesDump", {
        emp_id,
      }); // Adjust URL as per your backend API
      console.log("API response:", response.data); // Log the response data
      const employeesData = Array.isArray(response.data)
        ? response.data
        : [response.data];
      setEmployees(employeesData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching employees:", error);
      setLoading(false);
      // Handle error state as needed
    }
  };

  // Fetching dropdown data from APIs

  const fetchDropdownData = async () => {
    try {
      const [employeeRes] = await Promise.all([
        axios.get("/api/employee/getAllEmployees"),
      ]);
      setEmployeeList(employeeRes.data);
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
    }
  };

  const handleAddNewRecord = () => {
    setSelectedEmployee(null); // Reset form
    clearForm();
    employeeIdRef.current.focus(); // Set focus on EmployeeCode input field
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1); // Reset to first page when items per page change
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    const formattedDate = now.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
    return formattedDate + "Z";
  };

  const formatDateTimeForInput = (dateTime) => {
    const date = new Date(dateTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const convertLocalTimeToUTC = (localDateTime) => {
    const localDate = new Date(localDateTime);
    return localDate.toISOString();
  };

  // Function to convert UTC datetime to local time
  const convertUTCToLocalTime = (utcDateTime) => {
    const localDate = new Date(utcDateTime);
    return localDate.toLocaleString();
  };

  const clearForm = () => {
    setFormData({
      EmployeeCode: "",
      EmployeeName: "",
      BillingType: "",
      eff_date: "",
      BasicRate: "",
      DARate: "",
      JaggeryRate: "",
      OTHALWRT: "",
      HRART: "",
      TRALWRT: "",
      UNALWRT: "",
      PFApply: "",
      ESIApply: "",
      LWFApply: "",
      MEDIALWRT: "",
      CONALWRT: "",
      HRAOLDRT: "",
      OTFactor: "",
    });
  };

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevFormData) => ({
      ...prevFormData,
      [name]: type === "checkbox" ? checked : value === "" ? null : value,
    }));
  };

  const getEmployeeMasterOtFactor = (employeeCode) => {
    const employee = employeeList.find(
      (item) => item.Employee_Code === employeeCode,
    );
    return Number(employee?.ot_factor ?? 0);
  };

  const handleEmployeeChange = (e) => {
    const employeeCode = e.target.value;
    setFormData((previous) => ({
      ...previous,
      EmployeeCode: employeeCode,
      OTFactor: employeeCode ? getEmployeeMasterOtFactor(employeeCode) : "",
    }));
  };

  // Validation function
  const validateForm = () => {
    const newErrors = {};

    if (!formData.EmployeeCode) {
      newErrors.EmployeeCode = "Employee Code is required.";
      employeeIdRef.current.focus();
    }

    if (!formData.eff_date) {
      newErrors.eff_date = "Effective Date is required.";
      eff_dateRef.current.focus();
    }

    if (!formData.BasicRate) {
      newErrors.BasicRate = "Basic Rate Is Required";
      BasicRateRef.current.focus();
    } else if (formData.BasicRate <= 0) {
      newErrors.BasicRate = "Basic Rate can't be <= 0.";
      BasicRateRef.current.focus();
    }

    if (!formData.PFApply) {
      newErrors.PFApply = "PF Applicability is required.";
      PFApplyRef.current.focus();
    }

    if (formData.OTFactor === null || formData.OTFactor === "") {
      newErrors.OTFactor = "OT Factor is required.";
      OTFactorRef.current.focus();
    } else if (formData.EmployeeCode) {
      const masterOtFactor = getEmployeeMasterOtFactor(formData.EmployeeCode);
      const enteredOtFactor = Number(formData.OTFactor);
      if (
        !Number.isFinite(enteredOtFactor) ||
        enteredOtFactor.toFixed(2) !== masterOtFactor.toFixed(2)
      ) {
        newErrors.OTFactor = `OT Factor must match Employee Master (${masterOtFactor.toFixed(2)}).`;
        OTFactorRef.current.focus();
      }
    }

    if (!formData.ESIApply) {
      newErrors.ESIApply = "ESI Applicability is required.";
      ESIApplyRef.current.focus();
    }

    if (!formData.LWFApply) {
      newErrors.LWFApply = "LWF Applicability is required.";
      LWFApplyRef.current.focus();
    }

    // Add more validation rules as needed
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submitHandler = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      setMessage("Please fix the validation errors before submitting.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const updatedFormData = {
        ...formData,
      };

      let result;
      if (selectedEmployee) {
        const localDate = new Date(); // Assuming this is the local date you want to store
        const utcDate = convertLocalTimeToUTC(localDate);
        const tmp_date = formatDateTimeForInput(new Date());
        const utcDateFromBackend = "2024-06-18T12:31:34.945Z";
        const localDateForDisplay = convertUTCToLocalTime(utcDateFromBackend);
        const updatedFormData1 = {
          ...updatedFormData,
          eff_date: updatedFormData.eff_date
            ? formatDateForInput(updatedFormData.eff_date)
            : null,
          PFApply:
            updatedFormData.PFApply && updatedFormData.PFApply.trim() !== ""
              ? updatedFormData.PFApply
              : null,
          ESIApply:
            updatedFormData.ESIApply && updatedFormData.ESIApply.trim() !== ""
              ? updatedFormData.ESIApply
              : null,
          LWFApply:
            updatedFormData.LWFApply && updatedFormData.LWFApply.trim() !== ""
              ? updatedFormData.LWFApply
              : null,
          Created_By: emp_id,
          Modified_By: emp_id,
        };
        // Edit existing employee
        console.log("updatedFormData1:", updatedFormData1);
        try {
          const response = await axios.post(
            `/api/wages/updateFixWages`,
            updatedFormData1,
          );

          if (response.status == 200) {
            setShowSuccessModal(true);
            setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
            fetchEmployees(); // Refresh the employee data
            setSelectedEmployee(null); // Reset form
            clearForm();
            // Focus on the top of the grid after form submission
            if (gridRef.current) {
              gridRef.current.focus();
            }
          } else {
            if (response.data.error.originalError.info.message) {
              setError(
                "Error adding EMPLOYEE.1" +
                  response.data.error.originalError.info.message,
              );
            } else {
              setError("Error adding EMPLOYEE at 2" + response);
            }
            setLoading(false); // Reset loading after success
          }
          setLoading(false);
          employeeIdRef.current.focus();
        } catch (err) {
          console.log("Stage--6");
          console.log(err);
          const apiError = err.response?.data?.error;
          setError(
            typeof apiError === "string"
              ? apiError
              : apiError?.originalError?.info?.message ||
                  err.response?.data?.message ||
                  err.message,
          );
          setLoading(false); // Reset loading after success
          employeeIdRef.current.focus();
        }
      } else {
        // Add new employee
        const updatedFormData1 = {
          ...updatedFormData,
          Modified_By: emp_id,
          Modified_Date: null,
          eff_date: updatedFormData.eff_date
            ? formatDateForInput(updatedFormData.eff_date)
            : null,
          Created_By: emp_id,
          PFApply:
            updatedFormData.PFApply && updatedFormData.PFApply.trim() !== ""
              ? updatedFormData.PFApply
              : null,
          ESIApply:
            updatedFormData.ESIApply && updatedFormData.ESIApply.trim() !== ""
              ? updatedFormData.ESIApply
              : null,
          LWFApply:
            updatedFormData.LWFApply && updatedFormData.LWFApply.trim() !== ""
              ? updatedFormData.LWFApply
              : null,
        };
        try {
          //const response = await dispatch(registerEmployee(updatedFormData1));
          const response = await axios.post(
            "/api/wages/addFixWages",
            updatedFormData1,
          );
          if (response.status == 200) {
            setShowSuccessModal(true);
            setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
            fetchEmployees(); // Refresh the employee data
            setSelectedEmployee(null); // Reset form
            clearForm();
            // Focus on the top of the grid after form submission
            if (gridRef.current) {
              gridRef.current.focus();
            }
          } else {
            if (response.data.error.originalError.info.message) {
              setError(
                "Error adding Fix Wages.1" +
                  response.data.error.originalError.info.message,
              );
            } else {
              setError("Error adding Fix Wages at 2" + response);
            }
            setLoading(false); // Reset loading after success
          }
          setLoading(false);
          employeeIdRef.current.focus();
        } catch (err) {
          const apiError = err.response?.data?.error;
          setError(
            typeof apiError === "string"
              ? apiError
              : apiError?.originalError?.info?.message ||
                  err.response?.data?.message ||
                  err.message,
          );
          setLoading(false); // Reset loading after success
          employeeIdRef.current.focus();
        }
      }
    } catch (error) {
      setShowErrorModal(true);
      console.error("Submit Error:", error);
      setError("Error adding EMPLOYEE at 5" + error);
      setLoading(false);
      employeeIdRef.current.focus();
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
      });
      setSearchResults(response.data || []);
    } catch (err) {
      console.error("Error fetching employee search results:", err);
    }
  };

  // Select employee from search results
  const handleSelectEmployee = (employee) => {
    const employeeCode = employee.employee_code;
    setFormData((previous) => ({
      ...previous,
      EmployeeCode: employeeCode,
      EmployeeName: employee.display_name,
      OTFactor: getEmployeeMasterOtFactor(employeeCode),
    }));

    closeEmployeeSearch();
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setErrors({}); // Clear validation errors
    setMessage(""); // Clear error message
    navigate("/manageFixWages"); // Navigate to the home route after closing the modal
  };

  const handleEmployeeClick = (employee) => {
    setErrors({}); // Clear validation errors
    setMessage(""); // Clear error message
    setFormData({
      EmployeeCode: employee.EmployeeCode,
      BillingCycle: employee.BillingCycle,
      eff_date: employee.eff_date ? employee.eff_date : null,
      BasicRate: employee.BasicRate,
      DARate: employee.DARate,
      JaggeryRate: employee.JaggeryRate,
      OTHALWRT: employee.OTHALWRT,
      HRART: employee.HRART,
      TRALWRT: employee.TRALWRT,
      UNALWRT: employee.UNALWRT,
      PFApply: employee.PFApply,
      OTFactor: employee.OTFactor,
      ESIApply: employee.ESIApply,
      LWFApply: employee.LWFApply,
      MEDIALWRT: employee.MEDIALWRT,
      CONALWRT: employee.CONALWRT,
      HRAOLDRT: employee.HRAOLDRT,
      Created_By: employee.Created_By,
      Created_Date: employee.Created_Date
        ? formatDateTimeForInput(employee.Created_Date)
        : "",
      Modified_By: employee.Modified_By,
      Modified_Date: employee.Modified_Date
        ? formatDateTimeForInput(employee.Modified_Date)
        : "",
    });
    setSelectedEmployee(employee);
    console.log("formdata :", formData);
    // Use setTimeout to ensure the form is updated first, then set focus
    setTimeout(() => {
      employeeIdRef.current.focus(); // Set focus on EmployeeCode input field
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

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredEmployees.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  const TimezoneInfo = () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezoneOffset = new Date().getTimezoneOffset();
    const timezoneOffsetInHours = timezoneOffset / 60;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB"); // 'en-GB' will format the date as dd/mm/yyyy
  };
  const formatDateForInput = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return (
    <MainScreen title={<span className="main-screen-title">Manage Wages</span>}>
      <div className="employee-list">
        <div ref={gridRef} tabIndex="-1" style={{ outline: "none" }}></div>{" "}
        {/* Hidden focusable element */}
        <div className="Paginated1">
          <Table responsive striped bordered hover>
            <thead style={{ height: "20px", verticalAlign: "midle" }}>
              <td
                style={{ height: "20px", width: "5%", verticalAlign: "midle" }}
              >
                No.Records:
              </td>
              <td width={"5%"}>
                <div>
                  <Form.Control
                    size="sm"
                    as="select"
                    value={itemsPerPage}
                    onChange={handleItemsPerPageChange}
                    style={{ width: "60px", fontSize: "12px" }} // Adjust width and font size of dropdown
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </Form.Control>
                </div>
              </td>

              <td>
                <div
                  className="pagination-buttons"
                  style={{ width: "68%", color: "lightskyblue" }}
                >
                  <Button
                    variant="secondary"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                  >
                    {"<<"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    {"<"}
                  </Button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    {">"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    {">>"}
                  </Button>
                </div>
              </td>
              <td width={"5%"}></td>
              <td>
                <Form.Control
                  type="text"
                  placeholder="Search by code/name/mob/adhar"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  style={{
                    backgroundColor: "greenyellow", // Crayon-like background
                    border: "2px solid black", // Strong black border like a crayon
                    borderRadius: "5px", // Slight rounded corners to mimic crayon softness
                    boxShadow: "2px 2px 5px rgba(0, 0, 0, 0.2)", // Light shadow to give it a raised effect
                    color: "black", // Text color for contrast
                    fontSize: "12px", // Adjusted font size
                    padding: "5px", // Padding inside the input to make it look nicer
                    outline: "none", // Remove default input outline
                  }}
                />
              </td>
              <td className="button-cell">
                <Button
                  variant="primary"
                  onClick={() => handleAddNewRecord()}
                  style={{ padding: "2px 6px", fontSize: "12px" }} // Reduced padding and font size
                >
                  Add
                </Button>
                <Button
                  variant="secondary"
                  style={{ padding: "2px 6px", fontSize: "12px" }} // Reduced padding and font size
                >
                  Upload
                </Button>
                <Button
                  variant="secondary"
                  style={{ padding: "2px 6px", fontSize: "12px" }} // Reduced padding and font size
                >
                  Export
                </Button>
              </td>
            </thead>
          </Table>
        </div>
        <div className="Paginated2">
          <Table responsive striped bordered hover>
            <thead>
              <tr>
                <th>Employee Code</th>
                <th>Employee Name</th>
                <th>Designation</th>
                <th>Contractor</th>
                <th>Effective Date</th>
                <th>Basic Rate</th>
                <th>DA Rate</th>
                <th>Jaggery Rate</th>
                <th>Other Allw Rate</th>
                <th>HRA Rate</th>
                <th>Old HRA Rate</th>
                <th>Medical Alw</th>
                <th>COnveyance Alw</th>
                <th>Trining Rate</th>
                <th>Uniform Rate</th>
                <th>ESI Apply</th>
                <th>PF Apply</th>
                <th>OT Factor</th>
                <th>LWF Apply</th>
                <th>Is Active</th>
                <th>Emp Type</th>
                <th>Billing Cycle</th>
                <th>Department</th>
                <th>bu_name</th>
                <th>division_name</th>
                <th>entity_name</th>
                {/* Add more headers as needed */}
              </tr>
            </thead>
            <tbody>
              {currentItems.map((employee) => (
                <tr key={employee.EmployeeCode}>
                  <td>
                    <a href="#" onClick={() => handleEmployeeClick(employee)}>
                      {employee.EmployeeCode}
                    </a>
                  </td>
                  <td>{employee.EmployeeName}</td>
                  <td>{employee.Designation}</td>
                  <td>{employee.ContractorName}</td>
                  <td>{employee.eff_date}</td>
                  <td>{employee.BasicRate}</td>
                  <td>{employee.DARate}</td>
                  <td>{employee.JaggeryRate}</td>
                  <td>{employee.OTHALWRT}</td>
                  <td>{employee.HRART}</td>
                  <td>{employee.HRAOLDRT}</td>
                  <td>{employee.MEDIALWRT}</td>
                  <td>{employee.CONALWRT}</td>
                  <td>{employee.TRALWRT}</td>
                  <td>{employee.UNALWRT}</td>
                  <td>{employee.ESIApply}</td>
                  <td>{employee.PFApply}</td>
                  <td>{employee.OTFactor}</td>
                  <td>{employee.LWFApply}</td>
                  <td>{employee.Is_Active}</td>
                  <td>{employee.EmployeeType}</td>
                  <td>{employee.BillingCycle}</td>
                  <td>{employee.Department}</td>
                  <td>{employee.BusinessUnit}</td>
                  <td>{employee.Division}</td>
                  <td>{employee.CompanyName}</td>
                  {/* Add more columns as needed */}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
      <div className="loginContainer">
        {error1 && <Alert variant="danger">{error1}</Alert>}
        {message && <ErrorMessage variant="danger">{message}</ErrorMessage>}
        {loading && <Loading />}
        <Form onSubmit={submitHandler}>
          <Row className="d-flex ">
            {/* Frame 1: Wages Information */}
            <Col md={4}>
              <div className="form-frame">
                <h5 className="form-section-heading">Wages Information</h5>
                {/* Employee Code */}
                <Form.Group
                  controlId="EmployeeCode"
                  className="formGroup d-flex align-items-center"
                >
                  <Form.Control
                    as="select"
                    name="EmployeeCode"
                    value={formData.EmployeeCode || ""}
                    onChange={handleEmployeeChange}
                    ref={employeeIdRef}
                  >
                    <option value="">Select Employee</option>
                    {employeeList.map((item) => (
                      <option
                        key={item.Employee_Code}
                        value={item.Employee_Code}
                      >
                        {item.Employee_Code}-{item.display_name}
                      </option>
                    ))}
                  </Form.Control>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={openEmployeeSearch}
                    className={`${styles["icon-button"]} ml-3`}
                  >
                    <FaSearch /> {/* Search icon */}
                  </Button>

                  {errors.EmployeeCode && (
                    <div className="error-message">{errors.EmployeeCode}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="eff_date" className="formGroup">
                  <Form.Label>
                    Effective Date<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="date"
                    name="eff_date"
                    ref={eff_dateRef}
                    value={
                      formData.eff_date
                        ? formatDateForInput(formData.eff_date)
                        : ""
                    }
                    placeholder="Enter Effective Date"
                    onChange={handleChange}
                  />
                  {errors.eff_date && (
                    <div className="error-message">{errors.eff_date}</div>
                  )}
                </Form.Group>
                <Form.Group
                  controlId="BasicRate"
                  className="formGroup"
                  style={{ flexBasis: "20%" }}
                >
                  <Form.Label>
                    Basic Rate<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    name="BasicRate"
                    value={formData.BasicRate}
                    onChange={handleChange}
                    placeholder="Enter Basic Rate"
                    ref={BasicRateRef}
                  ></Form.Control>
                  {errors.BasicRate && (
                    <div className="error-message">{errors.BasicRate}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="DARate" className="formGroup">
                  <Form.Label>
                    DARate %<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01" // Allows up to two decimal places
                    min="0"
                    name="DARate"
                    value={formData.DARate}
                    placeholder="Enter DARate %"
                    onChange={handleChange}
                    ref={DARateRef}
                  />
                  {errors.DARate && (
                    <div className="error-message">{errors.DARate}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="JaggeryRate" className="formGroup">
                  <Form.Label>
                    Jaggery Amount<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01" // Allows up to two decimal places
                    min="0"
                    name="JaggeryRate"
                    value={formData.JaggeryRate}
                    placeholder="Enter Jaggery Amount"
                    onChange={handleChange}
                    ref={JaggeryRateRef}
                  />
                  {errors.JaggeryRate && (
                    <div className="error-message">{errors.JaggeryRate}</div>
                  )}
                </Form.Group>
              </div>
            </Col>

            <Col md={4}>
              <div className="form-frame">
                <Form.Group controlId="OTHALWRT" className="formGroup">
                  <Form.Label>
                    Other Allowance<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01" // Allows up to two decimal places
                    min="0"
                    name="OTHALWRT"
                    value={formData.OTHALWRT}
                    placeholder="Enter Other Allowance"
                    onChange={handleChange}
                    ref={OTHALWRTRef}
                  />
                  {errors.OTHALWRT && (
                    <div className="error-message">{errors.OTHALWRT}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="HRART" className="formGroup">
                  <Form.Label>
                    HRA Allowance<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01" // Allows up to two decimal places
                    min="0"
                    name="HRART"
                    value={formData.HRART}
                    placeholder="Enter HRA"
                    onChange={handleChange}
                    ref={HRARTRef}
                  />
                  {errors.HRART && (
                    <div className="error-message">{errors.HRART}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="HRAOLDRT" className="formGroup">
                  <Form.Label>
                    Old HRA Allowance<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01" // Allows up to two decimal places
                    min="0"
                    name="HRAOLDRT"
                    value={formData.HRAOLDRT}
                    placeholder="Enter Old HRA"
                    onChange={handleChange}
                    ref={HRAOLDRTRef}
                  />
                  {errors.HRAOLDRT && (
                    <div className="error-message">{errors.HRAOLDRT}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="MEDIALWRT" className="formGroup">
                  <Form.Label>
                    Medical Allowance<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01" // Allows up to two decimal places
                    min="0"
                    name="MEDIALWRT"
                    value={formData.MEDIALWRT}
                    placeholder="Enter Medical Allowance"
                    onChange={handleChange}
                    ref={MEDIALWRTRef}
                  />
                  {errors.MEDIALWRT && (
                    <div className="error-message">{errors.MEDIALWRT}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="CONALWRT" className="formGroup">
                  <Form.Label>
                    Conveyance Allowance<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01" // Allows up to two decimal places
                    min="0"
                    name="CONALWRT"
                    value={formData.CONALWRT}
                    placeholder="Enter Conveyance Alw"
                    onChange={handleChange}
                    ref={CONALWRTRef}
                  />
                  {errors.CONALWRT && (
                    <div className="error-message">{errors.CONALWRT}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="TRALWRT" className="formGroup">
                  <Form.Label>
                    Training Allowance<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01" // Allows up to two decimal places
                    min="0"
                    name="TRALWRT"
                    value={formData.TRALWRT}
                    placeholder="Enter Training Allowance"
                    onChange={handleChange}
                    ref={TRALWRTRef}
                  />
                  {errors.TRALWRT && (
                    <div className="error-message">{errors.TRALWRT}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="UNALWRT" className="formGroup">
                  <Form.Label>
                    Uniform Allowance<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01" // Allows up to two decimal places
                    min="0"
                    name="UNALWRT"
                    value={formData.UNALWRT}
                    placeholder="Enter Uniform Allowance"
                    onChange={handleChange}
                    ref={UNALWRTRef}
                  />
                  {errors.UNALWRT && (
                    <div className="error-message">{errors.UNALWRT}</div>
                  )}
                </Form.Group>
              </div>
            </Col>

            <Col md={4}>
              <div className="form-frame">
                <Form.Group controlId="OTFactor" className="formGroup">
                  <Form.Label>
                    OT Factor<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01" // Allows up to two decimal places
                    min="0"
                    name="OTFactor"
                    value={formData.OTFactor}
                    placeholder="Enter OT Factor"
                    ref={OTFactorRef}
                    readOnly
                  />
                  {errors.OTFactor && (
                    <div className="error-message">{errors.OTFactor}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="PFApply" className="formGroup">
                  <Form.Label>
                    PF Applicability<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="PFApply"
                    value={formData.PFApply || ""}
                    onChange={handleChange}
                    ref={PFApplyRef}
                  >
                    <option value="">Select PF Applicability</option>{" "}
                    {/* Optional default placeholder */}
                    <option value="0">0 - No PF Applicable</option>
                    <option value="1">1 - BASIC only (₹1800 cap) </option>
                    <option value="2">
                      2 - BASIC + Allowances (₹1800 cap)
                    </option>
                    <option value="3">3 - BASIC only (NO cap)</option>
                    <option value="4">4 - BASIC + Allowances (NO cap)</option>
                  </Form.Control>
                  {errors.PFApply && (
                    <div className="error-message">{errors.PFApply}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="ESIApply" className="formGroup">
                  <Form.Label>
                    ESI Applicability<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="ESIApply"
                    value={formData.ESIApply || ""}
                    onChange={handleChange}
                    ref={ESIApplyRef}
                  >
                    <option value="">Select ESI Applicability</option>{" "}
                    {/* Optional default placeholder */}
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                  </Form.Control>
                  {errors.ESIApply && (
                    <div className="error-message">{errors.ESIApply}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="LWFApply" className="formGroup">
                  <Form.Label>
                    LWF Applicability<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="LWFApply"
                    value={formData.LWFApply || ""}
                    onChange={handleChange}
                    ref={LWFApplyRef}
                  >
                    <option value="">Select LWF Applicability</option>{" "}
                    {/* Optional default placeholder */}
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                  </Form.Control>
                  {errors.LWFApply && (
                    <div className="error-message">{errors.LWFApply}</div>
                  )}
                </Form.Group>
              </div>
            </Col>
            <Col md={4}>
              <div className="form-frame">
                <Form.Group controlId="Created_By" className="formGroup">
                  <Form.Label>Created By</Form.Label>
                  <Form.Control
                    type="text"
                    name="Created_By"
                    value={formData.Created_By}
                    readOnly
                  />
                </Form.Group>
                <Form.Group controlId="Created_Date" className="formGroup">
                  <Form.Label>Created Date</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    name="Created_Date"
                    value={
                      formData.Created_Date
                        ? formatDateTimeForInput(formData.Created_Date)
                        : ""
                    }
                    readOnly
                  />
                </Form.Group>
                <Form.Group controlId="Modified_By" className="formGroup">
                  <Form.Label>Modified By</Form.Label>
                  <Form.Control
                    type="text"
                    name="Modified_By"
                    value={formData.Modified_By}
                    readOnly
                  />
                </Form.Group>
                <Form.Group controlId="Modified_Date" className="formGroup">
                  <Form.Label>Modified Date</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    name="Modified_Date"
                    value={
                      formData.Modified_Date
                        ? formatDateTimeForInput(formData.Modified_Date)
                        : ""
                    }
                    readOnly
                  />
                </Form.Group>
              </div>
            </Col>
          </Row>
          {/* Submit Button */}
          <div className="submit-button">
            <Button variant="primary" type="submit">
              Submit
            </Button>
          </div>
        </Form>
      </div>

      {/* Employee Search Modal */}
      <Modal show={showEmployeeSearch} onHide={closeEmployeeSearch}>
        <Modal.Header closeButton>
          <Modal.Title>Search Employee</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            type="text"
            placeholder="Enter employee code/name"
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

      <Modal show={showErrorModal} onHide={() => setShowErrorModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Error</Modal.Title>
        </Modal.Header>
        <Modal.Body>Unable to register</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowErrorModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showSuccessModal} onHide={handleSuccessModalClose}>
        <Modal.Header closeButton>
          <Modal.Title>Success</Modal.Title>
        </Modal.Header>
        <Modal.Body>User Registered Successfully</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleSuccessModalClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </MainScreen>
  );
};

export default ManageFixWages;
