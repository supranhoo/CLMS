import React, { useState, useEffect, useRef } from "react";
import { Table, Form, Button, Alert, Modal } from "react-bootstrap";
import axios from "../../api/axios.js";
import { FaSearch } from "react-icons/fa";
import styles from "./AddWageDeductionsGrid.module.css";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { registerEmployee, selectUser } from "../../features/userSlice";
import Select from 'react-select';
import UploadDeductions from '../../components/UploadDeductions';
import moment from 'moment'; // You can use the moment library for date formatting
import { apiErrorMessage } from '../../utils/apiError';

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
    minWidth: '200px',
    maxWidth: '400px',
    borderColor: '#aaa',
    boxShadow: 'none',
    '&:hover': {
      borderColor: '#888'
    }
  }),
  menu: (base) => ({
    ...base,
    maxWidth: '400px'
  })
};

// Custom Option component to include checkboxes in the dropdown
const CustomOption = (props) => {
  const { innerRef, innerProps, isSelected, data } = props;
  return (
    <div ref={innerRef} {...innerProps} style={{ display: 'flex', alignItems: 'center' }}>
      <input type="checkbox" checked={isSelected} onChange={() => null} />
      <label style={{ marginLeft: 8 }}>{data.label}</label>
    </div>
  );
};

const formatTime = (dateTimeString) => {
  // Split the string by 'T' to separate the date and time
  const [datePart, timePart] = dateTimeString.split('T');

  // Take only the HH:MM part from the time
  const timeWithoutSeconds = timePart ? timePart.substring(0, 5) : '00:00';

  // Return the formatted string in YYYY-MM-DD HH:MM format
  return `${datePart} ${timeWithoutSeconds}`;
};

const formatDateForNewInput = (dateString) => {
  if (!dateString) return "";  // Handle null or empty values
  const date = new Date(dateString);
  
  // Format to "YYYY-MM-DDTHH:mm:ss" for datetime-local input field
  const year = date.getFullYear();
  const month = (`0${date.getMonth() + 1}`).slice(-2);
  const day = (`0${date.getDate()}`).slice(-2);
  const hours = (`0${date.getHours()}`).slice(-2);
  const minutes = (`0${date.getMinutes()}`).slice(-2);
  const seconds = (`0${date.getSeconds()}`).slice(-2);
  //const seconds = date.getSeconds() !== 0 ? `:${(`0${date.getSeconds()}`).slice(-2)}` : ''; // Only include seconds if they are not zero
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const customHandleChangeSingle = (selectedOption, setSelectedOption) => {
  if (!selectedOption) {
    setSelectedOption(null);
    return;
  }

  setSelectedOption(selectedOption);  // Set the single selected option
};

const ManageProcessMonth = () => {
  const [processMonthData, setProcessMonthData] = useState([]); // Stores fetched deduction data
  const [pmonth, setPmonth] = useState(""); // Stores the selected date
  const [pmonthList, setPmonthList] = useState(""); // Stores the selected date
  const [selectedPmonth, setSelectedPmonth] = useState([]);

  const [billingCycle, setBillingCycle] = useState(""); // Stores the selected date
  const [selectedBillingCycle, setSelectedBillingCycle] = useState([]);
  const [selectedIsActive, setSelectedIsActive] = useState([]);
  const [startDate, setStartDate] = useState(""); // Stores the selected contractor ID
  const [endDate, setEndDate] = useState(""); // Stores the selected contractor ID
  const [isActive, setIsActive] = useState(""); // Stores the selected contractor ID
  
  const [error, setError] = useState(""); // Stores error messages
  const [loading, setLoading] = useState(false); // Tracks loading state for API calls
  const [showUpload, setShowUpload] = useState(true);

  const employee_codeRef = useRef(null);

  const [newProcessMonth, setNewProcessMonth] = useState({
    pmonth:"",
    billingType:"",
    start_date:"",
    end_date:"",
    is_active:"",
  });
  const [successMessage, setSuccessMessage] = useState(""); // Tracks success message
  const [isAddDisabled, setIsAddDisabled] = useState(true); // Disable "Add" button if employee code is invalid

  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Fetch contractors when component mounts
  useEffect(() => {
    fetchBillingCycleData();
    fetchAllProcessMonth();

  }, []);

  /*
  const handleInputChange = async (e) => {
    const { name, value } = e.target;
  
    if (name === "pmonth"  && newProcessMonth.billingType === 'F') {
      const day = new Date(value).getDate();
  
      // Validate the process month date
      if (day !== 1 && day !== 16) {
        setError("Process month must be either the 1st or 16th of the month.");
        setIsAddDisabled(true);
        return;
      }
  
      // Automatically derive start_date and end_date based on pmonth and billingType
      let updatedFields = {};
      if (day === 1) {
        updatedFields = {
          start_date: `${new Date(value).getFullYear()}-${(`0${new Date(value).getMonth() + 1}`).slice(-2)}-01`,
          end_date: `${new Date(value).getFullYear()}-${(`0${new Date(value).getMonth() + 1}`).slice(-2)}-15`,
        };
      } else if (day === 16) {
        const lastDay = new Date(new Date(value).getFullYear(), new Date(value).getMonth() + 1, 0).getDate();
        updatedFields = {
          start_date: `${new Date(value).getFullYear()}-${(`0${new Date(value).getMonth() + 1}`).slice(-2)}-16`,
          end_date: `${new Date(value).getFullYear()}-${(`0${new Date(value).getMonth() + 1}`).slice(-2)}-${lastDay}`,
        };
      }
  
      setNewProcessMonth({ ...newProcessMonth, pmonth: value, ...updatedFields });
      console.log(newProcessMonth);
      setError(""); // Clear any previous errors
      setIsAddDisabled(false); // Enable the Add button
    }
    else if (name === "pmonth"   && newProcessMonth.billingType === 'M') {
      const day = new Date(value).getDate();
  
      // Validate the process month date
      if (day !== 1 ) {
        setError("Process month must be the 1st of the month");
        setIsAddDisabled(true);
        return;
      }
  
      // Automatically derive start_date and end_date based on pmonth and billingType
      let updatedFields = {};
      updatedFields = {
        start_date: `${new Date(value).getFullYear()}-${(`0${new Date(value).getMonth() + 1}`).slice(-2)}-01`,
        end_date: (() => {
          const year = new Date(value).getFullYear();
          const month = new Date(value).getMonth() + 1;
          const lastDay = new Date(year, month, 0).getDate(); // Get the last day of the month
          return `${year}-${(`0${month}`).slice(-2)}-${lastDay}`;
        })(),        
      };

      setNewProcessMonth({ ...newProcessMonth, pmonth: value, ...updatedFields });
      console.log(newProcessMonth);
      setError(""); // Clear any previous errors
      setIsAddDisabled(false); // Enable the Add button
    }


    if (name === "billingType" && value) {
      let updatedFields = {};
      updatedFields = {
        pmonth:null,
        start_date:`${new Date(value).getFullYear()}-${(`0${new Date(value).getMonth() + 1}`).slice(-2)}-09`,
        end_date: null,
      };
      setNewProcessMonth({ ...newProcessMonth, billingType: value,  ...updatedFields });
      //setNewProcessMonth({ ...newProcessMonth, billingType: value });
  
      // Validate billingType-specific rules
      const day = new Date(newProcessMonth.pmonth).getDate();
      if (value === "M" && day !== 1) {
        setError("For billing type 'M', the process month must be the 1st of the month.");
        setIsAddDisabled(true);
      } else {
        setError(""); // Clear any previous errors
        setIsAddDisabled(false);
      }
    }
  };
  */

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
  
    if (name === "pmonth") {
      const day = new Date(value).getDate();
  
      if (newProcessMonth.billingType === 'F') {
        // Validate process month date for 'F'
        if (day !== 1 && day !== 16) {
          setError("Process month must be either the 1st or 16th of the month.");
          setIsAddDisabled(true);
          return;
        }
  
        // Derive start_date and end_date
        const updatedFields = day === 1
          ? {
              start_date: `${new Date(value).getFullYear()}-${(`0${new Date(value).getMonth() + 1}`).slice(-2)}-01`,
              end_date: `${new Date(value).getFullYear()}-${(`0${new Date(value).getMonth() + 1}`).slice(-2)}-15`,
            }
          : {
              start_date: `${new Date(value).getFullYear()}-${(`0${new Date(value).getMonth() + 1}`).slice(-2)}-16`,
              end_date: `${new Date(value).getFullYear()}-${(`0${new Date(value).getMonth() + 1}`).slice(-2)}-${new Date(new Date(value).getFullYear(), new Date(value).getMonth() + 1, 0).getDate()}`,
            };
  
        setNewProcessMonth({ ...newProcessMonth, pmonth: value, ...updatedFields });
        setError("");
        setIsAddDisabled(false);
      } else if (newProcessMonth.billingType === 'M') {
        // Validate process month date for 'M'
        if (day !== 1) {
          setError("Process month must be the 1st of the month.");
          setIsAddDisabled(true);
          return;
        }
  
        const updatedFields = {
          start_date: `${new Date(value).getFullYear()}-${(`0${new Date(value).getMonth() + 1}`).slice(-2)}-01`,
          end_date: `${new Date(value).getFullYear()}-${(`0${new Date(value).getMonth() + 1}`).slice(-2)}-${new Date(new Date(value).getFullYear(), new Date(value).getMonth() + 1, 0).getDate()}`,
        };
  
        setNewProcessMonth({ ...newProcessMonth, pmonth: value, ...updatedFields });
        setError("");
        setIsAddDisabled(false);
      }
    } else if (name === "billingType") {
      const updatedFields = {
        pmonth: null,
        start_date: null,
        end_date: null,
      };
  
      setNewProcessMonth({ ...newProcessMonth, billingType: value, ...updatedFields });
  
      // Clear errors and enable add button
      setError("");
      setIsAddDisabled(false);
    }
  };
  
  // Handle input changes for updating existing deductiones
  const handleUpdateInputChange = (e, deduction) => {
    const { name, value } = e.target;
    console.log("target");
    console.log(e.target);
    const updatedProcessMonth = { ...deduction, [name]: value };
    const updatedData = processMonthData.map((item) =>
    item.pmonth === deduction.pmonth && item.billingtype === deduction.billingtype
      ? updatedProcessMonth
      : item
  );    setProcessMonthData(updatedData); // Update deduction data in the state
  };

  
  const fetchBillingCycleData = async () => {
    try {
      const response = await axios.get('/api/employee/getBillingType');
      const formattedBillingCycle = response.data.map(item => ({
        value: item.billingtype_code,
        label: item.billingtype_name,
      }));
      setBillingCycle(formattedBillingCycle); // Set the correct formatted array
    } catch (error) {
      console.error('Error fetching Billing Cycles:', error);
    }
  };

  // Add new deduction record
  const handleAddProcessMonth = async () => {

    try {
      console.log("New Process Month at Insert:", newProcessMonth);
      const response = await axios.post("/api/wages/addProcessMonth", {newProcessMonth,});

      if (response.status == 200) {
        fetchAllProcessMonth();
        setProcessMonthData([...processMonthData, newProcessMonth]);

        // Reset the form fields
        setNewProcessMonth({
          pmonth:"",
          billingType:"",
          start_date:"",
          end_date:"",
          is_active:"",
        });

        // Show success message
        setSuccessMessage("Record added successfully.");
        setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
      } else {
        console.log("Testing---3");

        //if (response.data.error.originalError.info.message) {
          //setError("Error adding deduction.1"+response.data.error.originalError.info.message);
        //} else {
          setError("Error adding deduction at 2"+response);
        //}
      }
    } catch (err) {
      console.log("Testing---4");
      console.error("Error adding deduction at err:", err);
      //if (err.response.data.error.originalError.info.message) {
        //setError("Error adding deduction.3"+err.response.data.error.originalError.info.message);
      //} else {
        setError(`Error adding process month: ${apiErrorMessage(err)}`);
      //}
    }
  };

  const fetchAllProcessMonth = async () => {
    try {
      const response = await axios.post("/api/wages/getAllProcessMonth");
      console.log("Response,",response);
      setProcessMonthData(Array.isArray(response.data) ? response.data : []);
      console.log(response);
      console.log("processMonthData",processMonthData);
    } catch (error) {
      console.error("Error fetching getWageDeductions:", error);
    }
  }

  const handleBillingCycleChange = (selectedOption) => {
    setSelectedBillingCycle(selectedOption);
  };

  // Update existing deduction record
  const handleUpdateProcessMonth = async (updatedProcessMonth) => {
    console.log("updatedProcessMonth:", updatedProcessMonth);
    try {
      const response = await axios.post("/api/wages/updateProcessMonth", {updatedProcessMonth});

      if (response.status == 200) {
        setSuccessMessage("Record updated successfully.");
        setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
      } else {
        setError("Error updating process month at 2");
      }
    } catch (err) {
      console.error("Error updating deduction at 3:", err);
      setError(`Error updating process month: ${apiErrorMessage(err)}`);
    }
  };

  // Update existing deduction record
  const handleDeleteProcessMonth = async (updatedProcessMonth) => {
    try {
      const response = await axios.post("/api/wages/deleteProcessMonth", {updatedProcessMonth});
      console.log(response);
      if (response.status == 200) {
        const updatedData = processMonthData.map((deduction) =>
          deduction.employee_code === updatedProcessMonth.employee_code ? updatedProcessMonth : deduction
        );
        fetchAllProcessMonth();
        setSuccessMessage("Record deleted successfully.");
        setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
      } else {
        setError("Error updating process month at 2");
      }
    } catch (err) {
      console.error("Error updating deduction at 3:", err);
      setError(`Error updating process month: ${apiErrorMessage(err)}`);
    }
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
      <h3>Process Month - Config</h3>
      <div className={styles["form-inline-grid"]}>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>} {/* Success message */}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <Table bordered className={styles["compact-grid"]}>
          <thead>
            <tr>
              <th>Billing Type</th>
              <th>Process Month</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Is Open</th>
            </tr>
          </thead>
          <tbody>
            {processMonthData.length > 0 ? (
              processMonthData.map((processMonth) => (
                <tr key={`${processMonth.pmonth}-${processMonth.billingtype}`}>
                  <td>
                    <Form.Control
                      as="select"
                      value={processMonth.billingtype}
                      onChange={(e) => setSelectedBillingCycle(e.target.value)}
                      //onChange={(selectedOption) => customHandleChangeSingle(selectedOption, selectedBillingCycle)}
                      className={styles["small-input"]}
                      readOnly
                    >
                    <option value="" disabled>Select Billing Cycle</option>
                    {(Array.isArray(billingCycle) ? billingCycle : []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>                  
                      ))}
                    </Form.Control>
                  </td>
                  <td className={styles["left-justify"]}>
                    {moment(processMonth.pmonth).format('DD/MM/YYYY')}
                  </td>
                  <td>{processMonth.start_date ? moment(processMonth.start_date).format('DD/MM/YYYY') : null}</td>{/* Actual in deduction */}
                  <td>{processMonth.end_date ? moment(processMonth.end_date).format('DD/MM/YYYY')  : null}</td>{/* Actual out deduction */}
                  <td>
                    <Form.Control
                      as="select"
                      name="is_active"
                      value={processMonth.is_active}
                      //onChange={(e) => setSelectedIsActive(e.target.value)}
                      //onChange={(e) => setNewProcessMonth({ ...newProcessMonth, billingType: e.target.value })}
                      onChange={(e) => handleUpdateInputChange(e, processMonth)}
                      //setProcessMonthData
                      className={styles["small-input"]}
                    >
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                    </Form.Control>
                  </td>

                  <td>
                    <div>
                    <Button size="sm" onClick={() => handleUpdateProcessMonth(processMonth)}>
                      Save
                    </Button>
                    <Button size="sm" onClick={() => handleDeleteProcessMonth(processMonth)}>
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
                <Form.Control
                  as="select"
                  name="billingType"
                  value={newProcessMonth.billingType}
                  onChange={handleInputChange}
                  className={styles["small-input"]}
                >
                <option value="" disabled>Select Billing Cycle</option>
                {(Array.isArray(billingCycle) ? billingCycle : []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>                  
                  ))}
                </Form.Control>
              </td>
              <td>
                <Form.Control
                  type="date"
                  name="pmonth"
                  value={newProcessMonth.pmonth}
                  onChange={handleInputChange}
                  placeholder="Process Month"
                  className={styles["small-input"]}
                />
              </td>
              <td>
                <Form.Control
                  className={styles["small-input"]}
                  type="date"
                  value={newProcessMonth.start_date}
                  onChange={handleInputChange}
                  name="start_date"
                  readOnly
                />
              </td>
              <td>
                <Form.Control
                  className={styles["small-input"]}
                  type="date"
                  value={newProcessMonth.end_date}
                  onChange={handleInputChange}
                  name="end_date"
                  readOnly
                />
              </td>
              <td>
                <Form.Control
                  as="select"
                  value={newProcessMonth.is_active}
                  onChange={(e) => setNewProcessMonth({ ...newProcessMonth, is_active: e.target.value })}
                  className={styles["small-input"]}
                >
                <option value="" disabled>-- Select Status -- </option>
                <option value="Y">Yes</option>
                <option value="N">No</option>
                </Form.Control>
              </td>
              <td>
                <Button
                  size="sm"
                  onClick={handleAddProcessMonth}
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
    </div>
  );
};

export default ManageProcessMonth;
