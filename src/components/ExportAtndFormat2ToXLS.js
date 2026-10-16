import axios from "../api/axios.js";
import * as XLSX from "xlsx";

// Function to format attendance_date as dd/mm/yyyy
function formatDate(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Function to format time to HH:MM
function formatTimeToHHMM(dateString) {
  const date = new Date(dateString);
  const hours = String(date.getHours()).padStart(2, '0'); // Get hours in 24-hour format
  const minutes = String(date.getMinutes()).padStart(2, '0'); // Get minutes
  return `${hours}:${minutes}`; // Return formatted time as HH:MM
}

// Helper function to process "ALL" logic
function processSelection(selection) {
  if (selection.includes('ALL')) {
    return selection;
  }
  return selection; // Return the filtered selection without 'ALL'
}

const formatTime = (dateTimeString) => {
  // Split the string by 'T' to separate the date and time
  const [datePart, timePart] = dateTimeString.split('T');
  // Take only the HH:MM part from the time
  const timeWithoutSeconds = timePart ? timePart.substring(0, 5) : '00:00';
  return `${timeWithoutSeconds}`;
};

const exportAtndToXLS = async ({ from_date, to_date, contractor, bu, entity, department, emp_type, emp_id, token }) => {
  try {
    // Process contractor, bu, entity, and department selections to handle "ALL"
    const selectedContractor = processSelection(contractor);
    const selectedBU = processSelection(bu);
    const selectedEntity = processSelection(entity);
    const selectedDepartment = processSelection(department);

    // Pass selected contractor, BU, entity, and department as arrays (or as needed by the API)
    const response = await axios.post('/api/attendance/printAtndReg2', {
      from_date,
      to_date,
      contractor: selectedContractor.length ? selectedContractor : null,
      bu: selectedBU.length ? selectedBU : null,
      entity: selectedEntity.length ? selectedEntity : null,
      department: selectedDepartment.length ? selectedDepartment : null,
      emp_type,
      emp_id,
      token
    });

    const attendanceData = response.data;

    if (!Array.isArray(attendanceData) || attendanceData.length === 0) {
      throw new Error("No data for the selected filters");
    }

    // Prepare data for Excel
    const excelData = [];
    
    // Add headers
    excelData.push([
//      "Contractor", "Department", "BU", "EmpCode", "Employee Name", "Designation", "Section", "Date", "Shift", "IN", "OUT", "Hours", "Status", "OT Hrs"
      "Contractor", "Department", "BU", "EmpCode", "Employee Name", "Designation", "Section", "Date", "Shift", "Status"    ]);

    // Group data by contractor and department
    const contractors = {};
    attendanceData.forEach((item) => {
      if (!contractors[item.contractor_id]) {
        contractors[item.contractor_id] = {};
      }
      if (!contractors[item.contractor_id][item.dept_code]) {
        contractors[item.contractor_id][item.dept_code] = [];
      }
      contractors[item.contractor_id][item.dept_code].push(item);
    });

    // Loop through each contractor and department to create rows
    for (const contractorCode in contractors) {
      const contractorDepartments = contractors[contractorCode];
      for (const department in contractorDepartments) {
        const departmentData = contractorDepartments[department];
        departmentData.forEach((item) => {
          excelData.push([
            item.contractor_name || "",
            item.dept_name || "",
            item.bu_name || "",
            item.employee_code || "",
            item.display_name || "",
            item.design_name || "",
            item.section || "",
            formatDate(item.attendance_date) || "",
            item.shift || "",
            //item.in_punch ? formatTime(item.in_punch) : "",
            //item.out_punch ? formatTime(item.out_punch) : "",
            //item.working_hours || "",
            item.punch_mark || "",
            //item.ot_hours || ""
          ]);
        });
      }
    }

    // Create a worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet(excelData); // Convert array to worksheet
    const wb = XLSX.utils.book_new(); // Create new workbook
    XLSX.utils.book_append_sheet(wb, ws, "Attendance"); // Append the worksheet to the workbook

    // Generate and download the Excel file
    XLSX.writeFile(wb, `Attendance_${from_date}_to_${to_date}.xlsx`);

  } catch (error) {
    console.error("Error generating the attendance XLS report:", error);
    throw error;
  }
};

export default exportAtndToXLS;
