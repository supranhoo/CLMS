import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import axios from "../api/axios.js";
import { apiErrorMessage } from '../utils/apiError';
import { escapeHtml } from '../utils/escapeHtml';

function convertToSQLDate(dateString) {
  const [day, month, year] = dateString.split("-");
  return `${year}-${month}-${day}`;
}

function UploadEarnings({ setShowUpload, created_by }) {
  // Accept the prop to control visibility
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
      alert("Please select a file first!");
      return;
    }

    // File processing logic
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];

      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Prepare the earnings data from Excel data
      const skippedRows = [];
      const earningsData = jsonData.flatMap((row, index) => {
        const rowNo = (row.__rowNum__ ?? index + 1) + 1; // spreadsheet row (header is row 1)
        const employeeCode = hasValue(row["EmployeeCode"]) ? String(row["EmployeeCode"]).trim() : "";
        const billingType = row["BillingType"];
        const ProcessMonth = row["ProcessMonth"];
        const PayCode = row["PayCode"];
        const Amount = row["Amount"];
        const Remarks = row["Remarks"];

        // Skip rows with missing required cells (Amount 0 is a valid amount)
        const missing = [
          ['EmployeeCode', employeeCode],
          ['BillingType', billingType],
          ['ProcessMonth', ProcessMonth],
          ['PayCode', PayCode],
          ['Amount', Amount],
        ].filter(([, value]) => !hasValue(value)).map(([name]) => name);
        if (missing.length) {
          skippedRows.push(`Row ${rowNo}: missing ${missing.join(', ')}`);
          return [];
        }
        const formattedProcessMonth = excelDateToJSDate(ProcessMonth);
        if (!formattedProcessMonth) {
          skippedRows.push(`Row ${rowNo}: ProcessMonth is not a valid date`);
          return [];
        }
        //const formattedProcessMonth = ProcessMonth ? convertToSQLDate(ProcessMonth) : null;
        //excelDateToJSDate(inDate)
        const ernRecords = [];

        // In Punch Record
        if (formattedProcessMonth && hasValue(PayCode) && hasValue(Amount)) {
          const earningRecord = {
            employee_code: employeeCode,
            pmonth: formattedProcessMonth,
            billingType: billingType,
            ernCode: PayCode,
            ernValue: Amount,
            remarks: Remarks,
            created_by: created_by,
          };
          ernRecords.push(earningRecord);
        }

        return ernRecords; // Return only valid records
      });

      console.log("Processed Earnings Data:", earningsData);

      // Rows that were skipped or only partly used, shown to the user so nothing is dropped silently
      const skippedNote = skippedRows.length
        ? `\n\n${skippedRows.length} row(s) in the file were skipped or only partly used:\n` +
          skippedRows.slice(0, 10).join('\n') +
          (skippedRows.length > 10 ? '\n...' : '')
        : '';

      try {
        const response = await axios.post("/api/wages/uploadEarnings", {
          earnings: earningsData,
        });

        if (
          response.data.notInsertedRecords &&
          response.data.notInsertedRecords.length > 0
        ) {
          openInNewWindow(response.data.notInsertedRecords);
          if (skippedNote) alert(skippedNote.trim());
        } else {
          alert(`All records were successfully inserted.${skippedNote}`);
        }
      } catch (error) {
        console.error("Error uploading earnings:", error);
        alert(`Failed to upload earnings: ${apiErrorMessage(error)}${skippedNote}`);
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
                  <th>BillingType</th>
                  <th>ProcessMonth</th>
                  <th>Earning Code</th>
                  <th>Earning Value</th>
                  <th>Remarks</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                ${records
                  .map(
                    (record) => `
                  <tr>
                    <td>${escapeHtml(record.employee_code)}</td>
                    <td>${escapeHtml(record.billingType)}</td>
                    <td>${escapeHtml(record.pmonth)}</td>
                    <td>${escapeHtml(record.ernCode)}</td>
                    <td>${escapeHtml(record.ernValue)}</td>
                    <td>${escapeHtml(record.remarks)}</td>
                    <td>${escapeHtml(record.result)}</td>
                  </tr>
                `
                  )
                  .join("")}
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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

export default UploadEarnings;
