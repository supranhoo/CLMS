import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from "../../features/userSlice";
import Select, { components } from 'react-select';
import axios from '../../api/axios.js';
import styles from './RegenerateMuster.module.css'; // Import CSS module
import moment from 'moment'; // You can use the moment library for date formatting

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

const RegenerateMuster = () => {
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
  const navigate = useNavigate();

  const user = useSelector(selectUser);
  const token = user?.token;

  useEffect(() => {
    fetchPmonthData();
    fetchBillingCycleData();
    fetchContractorData();
    fetchEntityData();
  }, []);

  const fetchBillingCycleData = async () => {
    try {
      const response = await axios.get('/api/employee/getBillingType');
      const formattedBillingCycle = response.data.map(item => ({
        value: item.billingtype_code,
        label: item.billingtype_name,
      }));
      setBillingCycle(formattedBillingCycle);
    } catch (error) {
      console.error('Error fetching Billing Cycles:', error);
    }
  };

  const fetchPmonthData = async () => {
    try {
      const response = await axios.post('/api/wages/getProcessMonth');
      const formattedPmonth = response.data.map(item => ({
        value: item.pmonth,
        //label: item.pmonth,
        label: moment(item.pmonth).format('DD/MM/YYYY'), // Display as DD/MM/YYYY
      }));
      setPmonth(formattedPmonth);
    } catch (error) {
      console.error('Error fetching Process Month:', error);
    }
  };

  const fetchPmonthByBillingCycle = async (billingType) => {
    try {
      const response = await axios.post('/api/wages/getProcessMonthByBillingCycle', {
        billingtype: billingType,
      });
      const formattedPmonth = response.data.map(item => ({
        value: item.pmonth,
        //label: item.pmonth,
        label: moment(item.pmonth).format('DD/MM/YYYY'), // Display as DD/MM/YYYY
      }));
      setPmonth(formattedPmonth);
    } catch (error) {
      console.error('Error fetching Process Months by Billing Type:', error);
    }
  };

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

  const fetchEntityData = async () => {
    try {
      const response = await axios.get('/api/entity/');
      const formattedEntityData = [{ value: 'ALL', label: 'Select All Entities' }, ...response.data.map(item => ({
        value: item.entity_code,
        label: item.entity_name,
      }))];
      setEntity(formattedEntityData);
    } catch (error) {
      console.error('Error fetching Entity data:', error);
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

  const handleProcess = async () => {
    // Basic validation to check if all required inputs are provided
    const validationErrors = {};
    if (!employeeCode.trim()) {
      validationErrors.employeeCode = "Employee Code is required.";
    }
    if (!selectedPmonth) {
      validationErrors.processMonth = "Process Month is required.";
    }
    if (!selectedBillingCycle) {
      validationErrors.billingCycle = "Billing Cycle is required.";
    }
    if (!selectedContractor) {
      validationErrors.contractor = "At least one contractor must be selected.";
    }
    if (!selectedEntity) {
      validationErrors.entity = "At least one entity must be selected.";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return; // Exit the function if there are validation errors
    }

    setLoading(true); // Start loading
    try {

      const data = {
        contractorFilter: selectedContractor?.value,
        billingtype: selectedBillingCycle?.value,
        entityFilter: selectedEntity?.value,
        pmonth: selectedPmonth?.value,
        employeeCode: employeeCode.trim(),
      };

      const response = await axios.post('/api/attendance/regenerateMuster', data);
      alert('Muster Re-Generated successfully!');
    } catch (error) {
      console.error('Error regenerating Muster:', error);
      alert('Failed to regenerate muster. Please try again.');
    } finally {
      setLoading(false); // Stop loading
    }
  };

  return (
    <div>
      <div><br></br></div>
      <div className={styles.container}>
        <h2 className={styles.heading}>Re-Process Attendance</h2>
        <form>
          {/* Billing Cycle Input */}
          <div>
            <label>Billing Cycle:</label>
            <Select
              options={billingCycle}
              value={selectedBillingCycle}
              onChange={handleBillingCycleChange}
              components={{ Option: CustomOption }}
              placeholder="Select Billing Cycle"
              className={styles.selectContainer}
            />
            {errors.billingCycle && (
              <div className="error-message text-danger">{errors.billingCycle}</div>
            )}
          </div>

          {/* Process Month Input */}
          <div>
            <label>Process Month:</label>
            <Select
              options={pmonth}
              value={selectedPmonth}
              onChange={(selectedOption) => setSelectedPmonth(selectedOption)}
              components={{ Option: CustomOption }}
              placeholder="Select Process Month"
              className={styles.selectContainer}
            />
            {errors.processMonth && (
              <div className="error-message text-danger">{errors.processMonth}</div>
            )}
          </div>

          {/* Contractor Input */}
          <div>
            <label>Contractor:</label>
            <Select
              options={contractor}
              value={selectedContractor}
              onChange={(selectedOptions) => setSelectedContractor(selectedOptions)}
              components={{ Option: CustomOption }}
              placeholder="Select Contractors"
              className={styles.selectContainer}
            />
            {errors.contractor && (
              <div className="error-message text-danger">{errors.contractor}</div>
            )}
          </div>

          {/* Entity Input */}
          <div>
            <label>Entity:</label>
            <Select
              options={entity}
              value={selectedEntity}
              onChange={(selectedOptions) => setSelectedEntity(selectedOptions)}
              components={{ Option: CustomOption }}
              placeholder="Select Entities"
              className={styles.selectContainer}
            />
            {errors.entity && (
              <div className="error-message text-danger">{errors.entity}</div>
            )}
          </div>

          {/* Employee Code Input */}
          <div>
            <label>Employee Code (Blank for All) <span className="text-danger">*</span></label>
            <div className="formGroup">
              <input
                type="text"
                name="employeeCode"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                className={styles.selectContainer}
                placeholder="Enter Employee Code"
              />
              {errors.employeeCode && (
                <div className="error-message text-danger">{errors.employeeCode}</div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className={styles.buttonContainer}>
            <button type="button" className={styles.button} onClick={handleProcess}>
              Process Wages
            </button>
          </div>

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

export default RegenerateMuster;
