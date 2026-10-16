import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from "../../features/userSlice";
import Select, { components } from 'react-select';
import axios from '../../api/axios.js';
import styles from './RegenerateMuster.module.css'; // Import CSS module

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

const ManualProcessAttendance = () => {
  const [employeeCode, setEmployeeCode] = useState('');
  const [contractor, setContractor] = useState([]);
  const [billingCycle, setBillingCycle] = useState([]);
  const [pmonth, setPmonth] = useState([]);
  const [entity, setEntity] = useState([]);
  const [selectedContractor, setSelectedContractor] = useState([]);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState(null);
  const [selectedPmonth, setSelectedPmonth] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState([]);
  const [loading, setLoading] = useState(false); // Loading state
  const [errors, setErrors] = useState({}); // State for validation errors
  const [resultMessage, setResultMessage] = useState('');
  const navigate = useNavigate();

  const user = useSelector(selectUser);
  const token = user?.token;

  const handleProcess = async () => {
    // Basic validation to check if all required inputs are provided
    setLoading(true); // Start loading
    try {
      const data = {
        contractorFilter: "",
        billingtype: "",
        entityFilter: "",
        pmonth: "",
        employeeCode: "'",
      };

      //const response = await axios.post('/api/attendance/manualProcessAttendance',data);
      const response = await axios.post('/api/attendance/triggerTask',{taskName:'LOCAL_IMPORTED_PUNCHES'});
      setResultMessage(`${response.data.message} Worker-days summarized: ${response.data.processedCount}; changed: ${response.data.changedCount}.`);
    } catch (error) {
      console.error('Error regenerating Muster:', error);
      setResultMessage(error.response?.data?.message || 'Local punch processing failed.');
    } finally {
      setLoading(false); // Stop loading
    }
  };

  return (
    <div>
      <div><br></br></div>
      <div className={styles.container}>
        <h2 className={styles.heading}>Process locally imported attendance</h2>
        <p>This summarizes local punch inputs. It does not contact biometric devices or assign paid attendance without BFCL rules.</p>
        <p><a href="/development/import/punches">Import local sample punches</a> · <a href="/development/jobs">View job history</a></p>
        {resultMessage && <div role="status" className="alert alert-info">{resultMessage}</div>}
        <form>
          {/* Submit Button */}
            <br></br>
            <br></br>
            <br></br>
            <div className={styles.container} style={{ textAlign: 'center' }}>
            Do not process multiple instances
            </div>
            <br></br>
            <br></br>
            <br></br>
          <div className={styles.buttonContainer}>
            <button type="button" className={styles.button} onClick={handleProcess}>
              Process Attendance
            </button>
          </div>
          <br></br>
          <br></br>
          {/* Loading Spinner */}
          {loading && (
            <div className={styles.loaderContainer}>
              <div className={styles.spinner}></div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ManualProcessAttendance;
