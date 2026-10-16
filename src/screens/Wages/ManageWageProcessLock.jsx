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

const ManageWageProcessLock = () => {
  const [processMonthData, setProcessMonthData] = useState([]); // Stores fetched data
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

  const [contractorList, setContractorList] = useState([]); // Stores the selected date
  const [selectedContractor, setSelectedContractor] = useState([]);

  const [entityList, setEntityList] = useState([]); // Stores the selected date
  const [selectedEntity, setSelectedEntity] = useState([]);

  const [billingCycleLoading, setBillingCycleLoading] = useState(true);
  const [pmonthListLoading, setPmonthListLoading] = useState(true);
  const [entityListLoading, setEntityListLoading] = useState(true);
  const [contractorListLoading, setContractorListLoading] = useState(true);
  const [allPmonthLoading, setAllPmonthLoading] = useState(true);

  const employee_codeRef = useRef(null);

  const [newProcessMonth, setNewProcessMonth] = useState({
    pmonth:"",
    billingType:"",
    entityCode:"",
    ContractorId:"",
  });
  const [successMessage, setSuccessMessage] = useState(""); // Tracks success message
  const [isAddDisabled, setIsAddDisabled] = useState(true); // Disable "Add" button if employee code is invalid

  const refBillingCycle = useRef(null);

  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Fetch contractors when component mounts
  useEffect(() => {
    fetchAllPmonth();
    fetchPmonthByBillingCycle();
    fetchContractorData();
    fetchEntityData();
    fetchBillingCycleData();
    fetchWageProcessLock();
}, []);

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
  };
  
  const fetchContractorData = async () => {
    try {
      const response = await axios.get("/api/contractor/getAllContractors");
      const formattedContractorList = [{ value: "ALL", label: "ALL" }, ...response.data.map(item => ({
        value: item.Contractor_ID,
        label: item.Contractor_Name,
      }))];
      setContractorList(formattedContractorList); // Set the correct formatted array
    } catch (error) {
      console.error("Error fetching contractors:", error);
    } finally {
      setContractorListLoading(false);
    }
  };

  const fetchEntityData = async () => {
    try {
      //setLoading(true);
      const response = await axios.get("/api/entity");
      const formattedEntityList = [{ value: "ALL", label: "ALL" }, ...response.data.map(item => ({
        value: item.entity_code,
        label: item.entity_name,
      }))];
      setEntityList(formattedEntityList); // Set the correct formatted array
    } catch (error) {
      console.error("Error fetching contractors:", error);
    }
    finally {
      setEntityListLoading(false);
    }
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
    }  finally {
      setBillingCycleLoading(false);
    }
  };

  const fetchAllPmonth = async () => {
    try {
      //setLoading(true);
      const response = await axios.post('/api/wages/getAllProcessMonth');
      const formattedBillingCycle = response.data.map(item => ({
        value: item.pmonth,
        //label:item.pmonth,
        label: moment(item.pmonth).format('DD/MM/YYYY'), // Display as DD/MM/YYYY
      }));
      setPmonthList(formattedBillingCycle); // Set the correct formatted array
    } catch (error) {
      console.error('Error fetching Billing Cycles:', error);
    }  finally {
      setAllPmonthLoading(false);
    }
  };

  const fetchPmonthByBillingCycle = async (billingType) => {
    try {
      const response = await axios.post('/api/wages/getProcessMonthByBillingCycle', {
        billingtype: billingType,
      });

      // Format the process month data
      const formattedPmonth = response.data.map(item => ({
        value: item.pmonth,
        //label:item.pmonth,
        label: moment(item.pmonth).format('DD/MM/YYYY'), // Display as DD/MM/YYYY
      }));
      setPmonth(formattedPmonth);  // Update the pmonth dropdown options
    } catch (error) {
      console.error('Error fetching Process Months by Billing Type:', error);
    }
  };

  const handleBillingCycleChange = (selectedOption) => {
    setSelectedBillingCycle(selectedOption);
  
    // Fetch corresponding process months based on the selected billing cycle
    if (selectedOption && selectedOption.value) {
      fetchPmonthByBillingCycle(selectedOption.value);
    } else {
      setPmonth([]);  // Reset pmonth options if no billing cycle is selected
    }
  };

  const handlePmonthChange = (selectedOption) => {
    setSelectedPmonth(selectedOption);
  };
  const handleContractorChange = (selectedOption) => {
    setSelectedContractor(selectedOption);
    setIsAddDisabled(false);
  };
  const handleEntityChange = (selectedOption) => {
    setSelectedEntity(selectedOption);
  };

  // Add new deduction record
  const handleAddProcessMonth = async () => {

    try {
      console.log("New Process Month at Insert:", newProcessMonth);
      const response = await axios.post("/api/wages/addWageProcessLock", {
        pmonth:selectedPmonth.value,
        billingType:selectedBillingCycle.value,
        entityCode:selectedEntity.value,
        ContractorId:selectedContractor.value,
      });

      if (response.status == 200) {
        fetchWageProcessLock();

        // Reset the form fields
        setNewProcessMonth({
          pmonth:"",
          billingType:"",
          entityCode:"",
          ContractorId:"",
        });
        // Show success message
        setSuccessMessage("Record added successfully.");
        setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
        refBillingCycle.current.focus();
      } else {
        console.log("Testing---3");
        setError("Error adding deduction at 2"+response);
      }
    } catch (err) {
      console.log("Testing---4");
      console.error("Error adding deduction at err:", err);
      setError(`Error adding wage lock: ${apiErrorMessage(err)}`);
    }
  };

  const fetchWageProcessLock = async () => {
    try {
      const response = await axios.post("/api/wages/getWageProcessLock");
      console.log("Response,",response);
      //setProcessMonthData(Array.isArray(response.data) ? response.data : []);
      setProcessMonthData([...response.data]);
      console.log(response.data);
      console.log("processMonthData",processMonthData);
    } catch (error) {
      console.error("Error fetching getWageDeductions:", error);
      setError(`Error fetching wage locks: ${apiErrorMessage(error)}`);
    }
  }
  
  useEffect(() => {
    console.log("Updated processMonthData:", processMonthData);
  }, [processMonthData]); // Runs whenever processMonthData changes

  // Update existing deduction record
  const handleDeleteProcessMonth = async (updatedProcessMonth) => {
    try {
      const response = await axios.post("/api/wages/deleteWageProcessLock", {updatedProcessMonth});

      if (response.status == 200) {
        //const updatedData = processMonthData.map((deduction) =>
          //deduction.employee_code === updatedProcessMonth.employee_code ? updatedProcessMonth : deduction
        //);
        fetchWageProcessLock();
        setSuccessMessage("Record deleted successfully.");
        setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
        //employee_codeRef.current.focus();
      } else {
        setError("Error deleting wage lock at 2");
      }
    } catch (err) {
      console.error("Error updating deduction at 3:", err);
      setError(`Error deleting wage lock: ${apiErrorMessage(err)}`);
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
      <h3>Open Month Wage Process Locking - Entity Wise Contractor Wise</h3>
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
              <th>Entity Code</th>
              <th>Contractor</th>
            </tr>
          </thead>
          <tbody>
            {processMonthData.length > 0 ? (
              processMonthData.map((processMonth) => {
                const lockPmonth = String(processMonth.pmonth || "").slice(0, 10);
                const lockContractor = processMonth.ContractorId ?? processMonth.contractorId;
                const labelOf = (list, value) => list?.find((option) => option.value === value)?.label ?? value;
                return (
                <tr key={`${lockPmonth}-${processMonth.billingType}-${processMonth.entityCode}-${lockContractor}`}>
                  <td>{labelOf(billingCycle, processMonth.billingType)}</td>
                  <td>
                    {labelOf(
                      pmonthList?.map((option) => ({ ...option, value: String(option.value).slice(0, 10) })),
                      lockPmonth
                    )}
                  </td>
                  <td>{labelOf(entityList, processMonth.entityCode)}</td>
                  <td>{labelOf(contractorList, lockContractor)}</td>
                  <td>
                    <div>
                    <Button size="sm" onClick={() => handleDeleteProcessMonth(processMonth)}>
                      Delete
                    </Button>
                    </div>
                  </td>
                </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9">No records found for the selected date</td>
              </tr>
            )}
            {/* Add new deduction row */}
            <tr>
              <td>
                <Select
                  options={billingCycle}
                  value={selectedBillingCycle}
                  onChange={handleBillingCycleChange}
                  components={{ Option: CustomOption }}
                  placeholder="Select Billing Cycle"
                  isSearchable={false}
                  menuPortalTarget={document.body}  // Render dropdown in body
                  menuPosition="fixed"              // Position dropdown relative to viewport  
                  closeMenuOnSelect={true}
                  ref={refBillingCycle}
                  className={`${styles["small-input"]} small-select`}  // Add the custom CSS class here
                />
              </td>
              <td>
                <Select
                  options={pmonth}
                  value={selectedPmonth}
                  onChange={handlePmonthChange}
                  components={{ Option: CustomOption }}
                  placeholder="Select Process Month"
                  isSearchable={false}
                  menuPortalTarget={document.body}  // Render dropdown in body
                  menuPosition="fixed"              // Position dropdown relative to viewport  
                  closeMenuOnSelect={true}
                  className={`${styles["small-input"]} small-select`}  // Add the custom CSS class here
                />
              </td>
              <td>
                <Select
                  options={entityList}
                  value={selectedEntity}
                  onChange={handleEntityChange}
                  components={{ Option: CustomOption }}
                  placeholder="Select Entity"
                  isSearchable={false}
                  menuPortalTarget={document.body}  // Render dropdown in body
                  menuPosition="fixed"              // Position dropdown relative to viewport  
                  closeMenuOnSelect={true}
                  className={`${styles["small-input"]} small-select`}  // Add the custom CSS class here
                />
              </td>
              <td>
                <Select
                  options={contractorList}
                  value={selectedContractor}
                  onChange={handleContractorChange}
                  components={{ Option: CustomOption }}
                  placeholder="Select Contractor"
                  isSearchable={false}
                  menuPortalTarget={document.body}  // Render dropdown in body
                  menuPosition="fixed"              // Position dropdown relative to viewport  
                  closeMenuOnSelect={true}
                  className={`${styles["small-input"]} small-select`}  // Add the custom CSS class here
                />
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

export default ManageWageProcessLock;
