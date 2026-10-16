import axios from "../api/axios.js";
import * as XLSX from "xlsx";

// Helper function to process "ALL" logic
function processSelection(selection) {
  if (selection.includes('ALL')) {
    return selection;
  }
  return selection; // Return the filtered selection without 'ALL'
}

const exportEmpMastDumpToXLS = async ({ contractor, bu, entity, department, emp_type, activeEmp, emp_id, token }) => {
  try {
    // Process contractor, bu, entity, and department selections to handle "ALL"
    const selectedContractor = processSelection(contractor);
    const selectedBU = processSelection(bu);
    const selectedEntity = processSelection(entity);
    const selectedDepartment = processSelection(department);
    const selectedEmpType = processSelection(emp_type);


    // Pass selected contractor, BU, entity, and department as arrays (or as needed by the API)
    const response = await axios.post('/api/employee/getEmpMastDump', {
      contractor: selectedContractor.length ? selectedContractor : null,
      bu: selectedBU.length ? selectedBU : null,
      entity: selectedEntity.length ? selectedEntity : null,
      department: selectedDepartment.length ? selectedDepartment : null,
      emp_type:selectedEmpType.length ? selectedEmpType : null,
      activeEmp:activeEmp,
      emp_id,
      token
    });

    const attendanceData = response.data;

    if (!attendanceData || attendanceData.length === 0) {
      console.error("No data available for the selected filters.");
      return;
    }

    // Extract headers dynamically from the first record in the dataset
    const headers = Object.keys(attendanceData[0]);

    // Prepare the Excel data starting with the headers
    const excelData = [headers];

    // Map the data dynamically
    attendanceData.forEach(item => {
      const row = headers.map(header => item[header] !== null ? item[header] : ""); // Replace null with empty string
      excelData.push(row);
    });

    // Create a worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet(excelData); // Convert array to worksheet
    const wb = XLSX.utils.book_new(); // Create a new workbook
    XLSX.utils.book_append_sheet(wb, ws, "EmpMaster"); // Append the worksheet to the workbook

    // Generate and download the Excel file
    XLSX.writeFile(wb, `EmpMasterDump.xlsx`);

  } catch (error) {
    console.error("Error generating the attendance XLS report:", error);
  }
};

export default exportEmpMastDumpToXLS;
