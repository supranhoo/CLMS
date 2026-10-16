import React, { useState, useEffect , useRef} from "react";
import { Form, Button, Alert, Tooltip, OverlayTrigger, } from "react-bootstrap";
import axios from "../../api/axios.js";
//import { FaSearch } from "react-icons/fa";
import styles from "./UploadInActiveEmp.module.css";
import {  useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";
//import Select from 'react-select';
import UploadInActiveEmp from '../../components/UploadInActiveEmp';
//import moment from 'moment'; // You can use the moment library for date formatting

// Utility function to convert a date to DD/MM/YYYY format
//function formatDate(date) {
//  if (!date) return '';
//  return date.substring(0, 10);
//}

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
/*
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
*/
/*
// Custom styles for react-select
const customStyles2 = {
  control: (base) => ({
    ...base,
    width: '80%',       // Set width to 50% of the parent
    height: '40%',      // Set height to 50% of the parent row height
    minHeight: '5px',  // Optional: Set minimum height to avoid layout collapse
    fontSize: '10px',   // Adjust control font size
  }),
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
*/
/*
const formatTime = (dateTimeString) => {
  // Split the string by 'T' to separate the date and time
  const [datePart, timePart] = dateTimeString.split('T');

  // Take only the HH:MM part from the time
  const timeWithoutSeconds = timePart ? timePart.substring(0, 5) : '00:00';

  // Return the formatted string in YYYY-MM-DD HH:MM format
  //return `${datePart} ${timeWithoutSeconds}`;
  return `${timeWithoutSeconds}`;
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
*/
// Function to check user permission to access Upload Manual Muster button
const checkUserPermission = async (emp_id, activity_id) => {
  try {
    const response = await axios.post('/api/assignRoles/getUserMenuActivityForSpecificMenu', {
      emp_id,
      activity_id,
    }, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (response.data && response.data.length > 0) {
      return true;
    } else {
      return false;
    }  
  } catch (error) {
    console.error('Error checking user permission:', error);
    return false;
  }
};

const InActiveEmp = () => {
/*
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
  const [selectedShift, setSelectedShift] = useState([]);
  const [selectedPunchMark, setSelectedPunchMark] = useState([]);

  const [arrearValue, setArrearValue] = useState(""); // Stores the selected contractor ID
  const [remarks, setRemarks] = useState(""); // Stores the selected contractor ID
  const [contractorID, setContractorID] = useState([]); // Stores fetched contractors list
  const [contractors, setContractors] = useState([]); // Stores fetched contractors list
  const [loading, setLoading] = useState(false); // Tracks loading state for API calls
*/
  const [error, setError] = useState(""); // Stores error messages
  const [showUpload, setShowUpload] = useState(true);
  const [hasUploadPermission, setHasUploadPermission] = useState(false); // Track permission for upload

  //const employee_codeRef = useRef(null);

  const [newArrear, setNewDeduction] = useState({
    employee_code:"",
    attendance_date:"",
  });

  /*
  // Static options for shift selection
  const staticPunchMarksList = [
    { value: 'P', label: 'P - Present' },
    { value: 'A', label: 'A - Absent' },
    { value: 'HDP', label: 'HDP - Half Day Present' },
    { value: 'OD', label: 'OD - Outdoor Duty' },
  ];
*/
  const [successMessage, setSuccessMessage] = useState(""); // Tracks success message
  const [isAddDisabled, setIsAddDisabled] = useState(true); // Disable "Add" button if employee code is invalid

  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();
  //const dispatch = useDispatch();

  // Fetch contractors when component mounts
  useEffect(() => {
    const fetchPermission = async () => {
      try {
        const response = await checkUserPermission(emp_id, 5);
        setHasUploadPermission(() => response);
      } catch (error) {
        console.error("Error fetching permission:", error);
      }
    };

    fetchPermission();
    setShowUpload(false);
  }, []);

  // Handle input changes for adding new deductiones
  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    setNewDeduction({ ...newArrear, [name]: value });

    // Automatically fetch display_name and actual deduction times when entering employee_code
    if (name === "employee_code" && value.length == 7) {
      try {
        const response = await axios.post("/api/employee/getEmployeeByCode", {employee_code:value});
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

  const handleShowUpload = () => {
    setShowUpload(true); // Set showUpload to true to render the UploadDeductions component
  };


  // Define your tooltip for input file headers
  const renderTooltip = (props) => (
    <Tooltip id="button-tooltip" {...props}>
      The input file should have headers: 
      <strong>
          EmployeeCode, InActiveDate
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
      <h3>Upload In-Active Employees</h3>
      <div className={styles["form-inline-grid"]}>

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
            Upload In-Active Employees
          </Button>
          </OverlayTrigger>
          {showUpload && <UploadInActiveEmp setShowUpload={setShowUpload} created_by={user.emp_id} />}
        </Form.Group>

      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>} {/* Success message */}

    </div>
  );
};

export default InActiveEmp;
