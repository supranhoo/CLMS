import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import axios from '../api/axios.js';

function UploadManualPunches({ setShowUpload }) { // Accept the prop to control visibility
  const [file, setFile] = useState(null);
  const [completed, setCompleted] = useState(false); // State to track completion

  useEffect(() => {
    setCompleted(false); // Reset state when the component is re-rendered
  }, []);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    setFile(selectedFile);
  };

  const handleFileUpload = async () => {
    if (!file) {
      alert('Please select a file first!');
      return;
    }

    // File processing logic
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];

      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Prepare the punches data from Excel data
      const punchesData = jsonData.flatMap(row => {
        const employeeCode = row['EmployeeCode'];
        const inDate = row['Indate'];
        const inTime = row['Intime'];
        const outDate = row['Outdate'];
        const outTime = row['Outtime'];

        // Skip rows with missing employee_code
        if (!employeeCode) return [];

        const formattedInDate = inDate ? excelDateToJSDate(inDate) : null;
        const formattedInTime = inTime ? excelTimeToHHMM(inTime) : null;
        const formattedOutDate = outDate ? excelDateToJSDate(outDate) : null;
        const formattedOutTime = outTime ? excelTimeToHHMM(outTime) : null;

        const punchRecords = [];

        // In Punch Record
        if (formattedInDate && formattedInTime) {
          console.log(inTime);
          const inPunchRecord = {
            employee_code: employeeCode,
            attendance_date_with_time: `${formattedInDate} ${formattedInTime}`,
            created_date: new Date().toISOString(),
            status: 0,
            biometricmachine_id: "101",  // Add static column for in punch
          };
          punchRecords.push(inPunchRecord);
        }

        // Out Punch Record
        if (formattedOutDate && formattedOutTime) {
          const outPunchRecord = {
            employee_code: employeeCode,
            attendance_date_with_time: `${formattedOutDate} ${formattedOutTime}`,
            created_date: new Date().toISOString(),
            status: 0,
            biometricmachine_id: "102",  // Add static column for out punch
          };
          punchRecords.push(outPunchRecord);
        }

        return punchRecords; // Return only valid records
      });

      console.log('Processed Punches Data:', punchesData);

      try {
        const response = await axios.post('/api/attendance/uploadManualPunches', { punches: punchesData });

        if (response.data.notInsertedRecords && response.data.notInsertedRecords.length > 0) {
          openInNewWindow(response.data.notInsertedRecords);
        } else {
          alert('All records were successfully inserted.');
        }
      } catch (error) {
        console.error('Error uploading punches:', error);
        alert('Failed to upload punches. Check the console for more details.');
      }
      setCompleted(true); // Mark the process as completed
      setShowUpload(false); // Hide the component after completion
    };

    reader.readAsArrayBuffer(file);
  };

  const handleCancel = () => {
    setFile(null); // Reset the selected file
    setCompleted(true); // Mark the process as completed to hide the buttons
    setShowUpload(false); // Hide the component when "Cancel" is clicked
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
                  <th>Employee Code</th>
                  <th>Attendance Date with Time</th>
                  <th>Status</th>
                  <th>Biometric Machine ID</th>
                </tr>
              </thead>
              <tbody>
                ${records.map(record => `
                  <tr>
                    <td>${record.employee_code}</td>
                    <td>${record.attendance_date_with_time}</td>
                    <td>${record.status}</td>
                    <td>${record.biometricmachine_id}</td>
                    <td>${record.remark}</td>
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
      {!completed && ( // Only show the input and buttons if not completed
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="file" accept=".xls,.xlsx" onChange={handleFileChange} />
          <button onClick={handleFileUpload}>Upload</button>
          <button onClick={handleCancel}>Cancel</button>
        </div>
      )}
    </div>
  );
}

// Convert Excel serial date to a JavaScript Date in DD-MM-YYYY format
function excelDateToJSDate(excelDate) {
  const date = new Date((excelDate - 25569) * 86400 * 1000);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

// Convert Excel serial time to HH:MM format
function excelTimeToHHMM(excelTime) {
  const totalMinutes = Math.round(excelTime * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export default UploadManualPunches;
