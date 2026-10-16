import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from "../../features/userSlice";
import Select, { components } from 'react-select';
import axios from '../../api/axios.js';
import exportApprovedVsPresntToXls from '../../components/ExportApprovedVsPresentToXLS';
import styles from './PrintDailyAttendance.module.css'; // Import CSS module

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

const PrintApprovedVsPresent = () => {
  const [contractor, setContractor] = useState([]);
  const [bu, setBu] = useState([]);
  const [entity, setEntity] = useState([]);
  const [department, setDepartment] = useState([]);
  const [selectedContractor, setSelectedContractor] = useState([]);
  const [selectedBU, setSelectedBU] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState([]);
  const [separatePage, setSeparatePage] = useState(false);
  
  const [empType, setEmpType] = useState([]);            // Dropdown options
  const [selectedEmpType, setSelectedEmpType] = useState({ value: 'SL', label: 'Supply Labour' }); // Default selection
  
  const [outputType, setOutputType] = useState('PDF'); // New state for Employee Type
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const user = useSelector(selectUser);
  const token = user?.token;
  const emp_id = user?.emp_id;

  const currentDate = new Date();
  console.log(currentDate);
  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is zero-based
    const year = date.getFullYear();
    return `${year}-${month}-${day}`; // Format as DD-MM-YYYY
  };
  const [fromDate, setFromDate] = useState(formatDate(currentDate)); // Replace with the desired initial date
  const [toDate, setToDate] = useState(formatDate(currentDate)); // Replace with the desired initial date
  const [errors, setErrors] = useState({}); // State for errors

  // Fetch BU data from the server
  const fetchBUData = async () => {
    try {
      const response = await axios.post('/api/entity/getAssignedBU', {emp_id});
      const formattedBUData = [{ value: 'ALL', label: 'Select All Business Units' }, ...response.data.map(item => ({
        value: item.bu_code,
        label: item.bu_name,
      }))];
      setBu(formattedBUData);
    } catch (error) {
      console.error('Error fetching BU data:', error);
    }
  };

  // Fetch Contractor data from the server
  const fetchContractorData = async () => {
    try {
      const response = await axios.get('/api/contractor/getAllContractors');
      const formattedContractorData = [{ value: 'ALL', label: 'Select All Contractors' }, ...response.data.map(item => ({
        value: item.Contractor_ID,
        label: item.Contractor_Name,
      }))];
      setContractor(formattedContractorData);
    } catch (error) {
      console.error('Error fetching Contractor data:', error);
    }
  };

  // Fetch Department data from the server
  const fetchDeptData = async () => {
    try {
      const response = await axios.post('/api/entity/getAllDept');
      const formattedDeptData = [{ value: 'ALL', label: 'Select All Departments' }, ...response.data.map(item => ({
        value: item.dept_code,
        label: item.dept_name,
      }))];
      setDepartment(formattedDeptData);
    } catch (error) {
      console.error('Error fetching Department data:', error);
    }
  };

  // Fetch Entity data from the server
  const fetchEntityData = async () => {
    try {
      const response = await axios.post('/api/entity/getAssignedEntity', {emp_id});
      const formattedEntityData = [{ value: 'ALL', label: 'Select All Entities' }, ...response.data.map(item => ({
        value: item.entity_code,
        label: item.entity_name,
      }))];
      setEntity(formattedEntityData);
    } catch (error) {
      console.error('Error fetching Entity data:', error);
    }
  };

  const fetchEmpType = async () => {
    try {
      const response = await axios.get('/api/employee/getEmpType');
      const formattedEmpTypeData = response.data.map(item => ({
        value: item.emp_type_code,
        label: item.emp_type_desc,
      }));
      setEmpType(formattedEmpTypeData);
  
      // Set default selection to 'SL'
      const defaultEmpType = formattedEmpTypeData.find(opt => opt.value === 'SL');
      if (defaultEmpType) {
        setSelectedEmpType(defaultEmpType);
      }
  
    } catch (error) {
      console.error('Error fetching Emp Type data:', error);
    }
  };

  // Load all data on component mount
  useEffect(() => {
    fetchEmpType();
  }, []);

  if (!token) {
    return (
      <div>
        <p>You must be logged in to print daily attendance.</p>
        <button onClick={() => navigate("/")}>Go to Login</button>
      </div>
    );
  }

  // Helper function to handle "Select All" logic
  const handleSelectAll = (options, selectedOptions, setSelectedOptions) => {
    const isAllSelected = selectedOptions.some(option => option.value === 'ALL');
    if (isAllSelected) {
      // If "ALL" is selected, select all options
      setSelectedOptions(options);
    } else {
      // Otherwise, deselect all options
      setSelectedOptions([]);
    }
  };

  const SelectAllOption = ({ innerRef, innerProps, selectAllFiltered }) => (
    <div ref={innerRef} {...innerProps} style={{ display: 'flex', alignItems: 'center' }}>
      <input type="checkbox" checked={false} onChange={selectAllFiltered} />
      <label style={{ marginLeft: 8 }}>Select All Filtered</label>
    </div>
  );
  
  const handleSelectAllFiltered = (filteredOptions) => {
    setSelectedBU(filteredOptions);
    setSearchTerm(""); // Clear search input after selecting all filtered options
  };
  
    // Filter options based on search term
    const filteredBUOptions = bu.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  
  const customHandleChange = (options, selectedOptions, setSelectedOptions) => {
    if (selectedOptions.some(option => option.value === 'ALL')) {
      handleSelectAll(options, selectedOptions, setSelectedOptions);
    } else {
      setSelectedOptions(selectedOptions);
    }
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

  const handlePrint = async () => {
    try {

      const data = {
        from_date: fromDate,
        emp_type: selectedEmpType?.value || '', // extract the code like 'SL'
        emp_id: emp_id,
        token: token,
      };

      await exportApprovedVsPresntToXls(data, {
          headers: {
            'Content-Type': 'application/json'
          }
      });
      alert('Attendance printed successfully!');
      
    } catch (error) {
      console.error('Error printing attendance:', error);
      alert('Failed to print attendance. Please try again.');
    }
  };

  return (
    <div>
      <div><br></br></div>
      <div className={styles.container}>
        <h2 className={styles.heading}>Export Approved Vs Present Manpower</h2>
        <form>
          {/* Date inputs */}
          <div className={styles.formGroup}>
            <label>Attendance Date:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              required
            />
          </div>

          {/* Employee Type Dropdown */}
          <div>
            <label>Employee Type:</label>
            <Select
              options={empType}
              value={selectedEmpType}
              onChange={(selectedOption) => setSelectedEmpType(selectedOption)}
              placeholder="Select Employee Type"
              styles={customStyles}
              className={styles.selectContainer}
            />
          </div>

          <div className={styles.buttonContainer}>
            <button type="button" className={styles.button} onClick={handlePrint}>
              Export Approved Vs Present
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PrintApprovedVsPresent;
