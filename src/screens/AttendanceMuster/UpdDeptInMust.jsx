import React, { useState, useEffect } from 'react';
import axios from '../../api/axios.js';
import { apiErrorMessage } from '../../utils/apiError';
import { escapeHtml } from '../../utils/escapeHtml';
import './GridStyles.css'; // For styling the grid

const UpdDeptInMust = () => {
  const [contractors, setContractors] = useState([]);
  const [contractorId, setContractorId] = useState('');
  const [musterDate, setMusterDate] = useState('');
  const [attendanceMuster, setAttendanceMuster] = useState([]);
  const [isEditable, setIsEditable] = useState(false);
  
  const [entityList, setEntityList] = useState([]);
  const [divGroupList, setDivGroupList] = useState([]); // Division group based on entity
  
  const [buList, setBuList] = useState([]);
  const [deptList, setDeptList] = useState([]);
  const [divList, setDivList] = useState([]); // For divisions

  // New state variables to track the selected entity and division group
  const [selectedEntity, setSelectedEntity] = useState('');
  const [selectedDivGroup, setSelectedDivGroup] = useState('');

  // Fetch contractor, BU, Division, Department, and Entity data
  useEffect(() => {
    fetchContractorData();
    fetchEntityData();
    fetchBUData();
    fetchDeptData();
  }, []);

  // Fetch division data whenever selectedDivGroup changes
  useEffect(() => {
    if (selectedDivGroup) {
      fetchDivision();
    }
  }, [selectedDivGroup]);

  const fetchContractorData = async () => {
    try {
      const response = await axios.get('/api/contractor/getAllContractors');
      setContractors(response.data); 
    } catch (error) {
      console.error('Error fetching contractors:', error);
    }
  };

  const fetchEntityData = async () => {
    try {
      const response = await axios.get('/api/entity');
      setEntityList(response.data); 
    } catch (error) {
      console.error('Error fetching entities:', error);
    }
  };

  const fetchBUData = async () => {
    try {
      const response = await axios.post('/api/entity/getAllBU');
      setBuList(response.data);
    } catch (error) {
      console.error('Error fetching BU data:', error);
    }
  };

  const fetchDeptData = async () => {
    try {
      const response = await axios.post('/api/entity/getAllDept');
      setDeptList(response.data);
    } catch (error) {
      console.error('Error fetching department data:', error);
    }
  };

  // Fetch division group based on selected entity
  const fetchDivGroup = async (entity_code) => {
    try {
      const response = await axios.post('/api/entity/divgroup', { entity_code: entity_code });
      setDivGroupList(response.data);
    } catch (error) {
      console.error('Error fetching division group:', error);
    }
  };

  // Fetch division list based on the selected division group
  const fetchDivision = async () => {
    try {
      const response = await axios.post('/api/entity/divcode', { div_group: selectedDivGroup });
      setDivList(response.data);
    } catch (error) {
      console.error('Error fetching division list:', error);
    }
  };

  const fetchMusterData = async () => {
    if (!musterDate) {
      alert('Select a muster date before showing data.');
      return;
    }
    try {
      setAttendanceMuster([]);
      setIsEditable(false);

      const response = await axios.post('/api/attendance/getMusterDeptByContractor', {
        contractor_id: contractorId,
        must_date: musterDate,
        entity: selectedEntity,
        div_group: selectedDivGroup,
      });

      setAttendanceMuster(response.data);
      setIsEditable(true); 
    } catch (error) {
      console.error('Error fetching muster data:', error);
      alert(apiErrorMessage(error));
    }
  };

  const handleInputChange = (index, field, value) => {
    const updatedMuster = [...attendanceMuster];
    updatedMuster[index][field] = value;
    setAttendanceMuster(updatedMuster);
  };

  const submitUpdatedMuster = async () => {
    try {
        console.log("attendanceMuster:",attendanceMuster);
      const response = await axios.post('/api/attendance/updateMusterDept', attendanceMuster); 
      if (response.data.notInsertedRecords && response.data.notInsertedRecords.length > 0) {
        openInNewWindow(response.data.notInsertedRecords);
      } else {
        alert('All records were successfully updated.');
      }

    } catch (error) {
      console.error('Error updating muster data:', error);
      alert(apiErrorMessage(error));
    }
  };

// Function to open a new window with the not-inserted records displayed
const openInNewWindow = (records) => {
    const newWindow = window.open("", "_blank");

    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>Not Inserted Records</title>
            <style>
              table {
                width: 100%;
                border-collapse: collapse;
              }
              th, td {
                border: 1px solid black;
                padding: 8px;
                text-align: left;
              }
              th {
                background-color: #f2f2f2;
              }
            </style>
          </head>
          <body>
            <h3>Not Inserted Records</h3>
            <table>
              <thead>
                <tr>
                  <th>Attendance Date</th>
                  <th>Employee Code</th>
                  <th>Entity</th>
                  <th>Business Unit</th>
                  <th>Division</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
                ${records.map(record => `
                  <tr>
                    <td>${escapeHtml(record.attendance_date)}</td>
                    <td>${escapeHtml(record.EMPLOYEE_CODE)}</td>
                    <td>${escapeHtml(record.entity_code)}</td>
                    <td>${escapeHtml(record.bu_code)}</td>
                    <td>${escapeHtml(record.div_code)}</td>
                    <td>${escapeHtml(record.dept_code)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `);
      newWindow.document.close(); // Close the document after writing to it
    }
  };

  return (
    <div>
      <h2>Update Department in Muster</h2>
      
      <div>
        <label>Contractor: </label>
        <select value={contractorId} onChange={e => setContractorId(e.target.value)}>
          <option value="">Select Contractor</option>
          {contractors.map(contractor => (
            <option key={contractor.Contractor_ID} value={contractor.Contractor_ID}>
              {contractor.Contractor_Name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>Entity: </label>
        <select value={selectedEntity} onChange={e => {
          setSelectedEntity(e.target.value);
          fetchDivGroup(e.target.value); // Fetch division group when entity changes
        }}>
          <option value="">Select Entity</option>
          {entityList.map(entity => (
            <option key={entity.entity_code} value={entity.entity_code}>
              {entity.entity_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>Division Group: </label>
        <select value={selectedDivGroup} onChange={e => setSelectedDivGroup(e.target.value)}>
          <option value="">Select Division Group</option>
          {divGroupList.map(divgroup => (
            <option key={divgroup.div_group} value={divgroup.div_group}>
              {divgroup.div_group_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>Date: </label>
        <input type="date" value={musterDate} onChange={e => setMusterDate(e.target.value)} />
      </div>

      <button onClick={fetchMusterData}>Show Data</button>

      {isEditable && (
        <div>
          <table className="styled-table">
            <thead>
              <tr>
                <th>Employee Code</th>
                <th>Employee Name</th>
                <th>Entity</th>
                <th>BU Name</th>
                <th>Division Name</th>
                <th>Department Name</th>
              </tr>
            </thead>
            <tbody>
              {attendanceMuster.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? 'even' : 'odd'}>
                  <td>{item.EMPLOYEE_CODE}</td>
                  <td>{item.display_name}</td>
                  <td>{item.entity_name}</td>
                  <td>
                    <select
                      value={item.bu_code}
                      onChange={e => handleInputChange(index, 'bu_code', e.target.value)}
                    >
                      {buList.map(bu => (
                        <option key={bu.bu_code} value={bu.bu_code}>
                          {bu.bu_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={item.div_code}
                      onChange={e => handleInputChange(index, 'div_code', e.target.value)}
                    >
                      {divList.map(div => (
                        <option key={div.div_code} value={div.div_code}>
                          {div.div_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={item.dept_code}
                      onChange={e => handleInputChange(index, 'dept_code', e.target.value)}
                    >
                      {deptList.map(dept => (
                        <option key={dept.dept_code} value={dept.dept_code}>
                          {dept.dept_name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={submitUpdatedMuster}>Submit</button>
        </div>
      )}
    </div>
  );
};

export default UpdDeptInMust;
