import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import axios from '../api/axios.js';
import { apiErrorMessage } from '../utils/apiError';
import { escapeHtml } from '../utils/escapeHtml';

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
      const skippedRows = [];
      const punchesData = jsonData.flatMap((row, index) => {
        const rowNo = (row.__rowNum__ ?? index + 1) + 1; // spreadsheet row (header is row 1)
        const employeeCode = hasValue(row['EmployeeCode']) ? String(row['EmployeeCode']).trim() : '';
        const inDate = row['Indate'];
        const inTime = row['Intime'];
        const outDate = row['Outdate'];
        const outTime = row['Outtime'];

        // Skip rows with missing employee_code
        if (!employeeCode) {
          skippedRows.push(`Row ${rowNo}: EmployeeCode is missing`);
          return [];
        }

        const formattedInDate = hasValue(inDate) ? excelDateToJSDate(inDate) : null;
        const formattedInTime = hasValue(inTime) ? excelTimeToHHMM(inTime) : null;
        const formattedOutDate = hasValue(outDate) ? excelDateToJSDate(outDate) : null;
        const formattedOutTime = hasValue(outTime) ? excelTimeToHHMM(outTime) : null;

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

        // Report what was left out: a date without a usable time (or the reverse), or no punch at all
        const inUsed = formattedInDate && formattedInTime;
        const outUsed = formattedOutDate && formattedOutTime;
        if (!inUsed && (hasValue(inDate) || hasValue(inTime))) skippedRows.push(`Row ${rowNo}: Indate/Intime missing or not valid`);
        if (!outUsed && (hasValue(outDate) || hasValue(outTime))) skippedRows.push(`Row ${rowNo}: Outdate/Outtime missing or not valid`);
        if (!inUsed && !outUsed && !hasValue(inDate) && !hasValue(inTime) && !hasValue(outDate) && !hasValue(outTime)) skippedRows.push(`Row ${rowNo}: no in or out punch`);

        return punchRecords; // Return only valid records
      });

      console.log('Processed Punches Data:', punchesData);

      // Rows that were skipped or only partly used, shown to the user so nothing is dropped silently
      const skippedNote = skippedRows.length
        ? `\n\n${skippedRows.length} row(s) in the file were skipped or only partly used:\n` +
          skippedRows.slice(0, 10).join('\n') +
          (skippedRows.length > 10 ? '\n...' : '')
        : '';

      try {
        const response = await axios.post('/api/attendance/uploadManualPunches', { punches: punchesData });
        const { insertedCount, duplicateCount, notInsertedRecords } = response.data;
        const summary = `${insertedCount ?? 0} punch record(s) inserted, ${duplicateCount ?? 0} duplicate(s) ignored.`;

        if (notInsertedRecords && notInsertedRecords.length > 0) {
          openInNewWindow(notInsertedRecords);
          alert(`${summary}\n${notInsertedRecords.length} record(s) were not inserted (see the new window).${skippedNote}`);
        } else {
          alert(`${summary}${skippedNote}`);
        }
      } catch (error) {
        console.error('Error uploading punches:', error);
        alert(`Failed to upload punches: ${apiErrorMessage(error)}${skippedNote}`);
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
                    <td>${escapeHtml(record.employee_code)}</td>
                    <td>${escapeHtml(record.attendance_date_with_time)}</td>
                    <td>${escapeHtml(record.status)}</td>
                    <td>${escapeHtml(record.biometricmachine_id)}</td>
                    <td>${escapeHtml(record.remark)}</td>
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
  const serial = Number(excelDate);
  if (!hasValue(excelDate) || !Number.isFinite(serial)) return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${year}-${month}-${day}`;
}

// A cell value of 0 (Excel serial 0, 00:00) is a real value; only undefined, null and '' are missing
function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

// Convert Excel serial time to HH:MM format
function excelTimeToHHMM(excelTime) {
  const value = Number(excelTime);
  if (!hasValue(excelTime) || !Number.isFinite(value)) return null;
  const totalMinutes = Math.round(value * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export default UploadManualPunches;
