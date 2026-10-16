import axios from "../api/axios.js";
import ExcelJS from "exceljs";

// Helper function to process "ALL" logic
function processSelection(selection) {
  if (selection.includes('ALL')) {
    return selection;
  }
  return selection;
}

// Helper function to style the header
function getHeaderCellStyle() {
  return {
    font: { bold: true, size: 10 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D3D3D3' } }, // Gray color background
    alignment: { horizontal: 'center', vertical: 'middle' }, // Center alignment
    border: {
      top: { style: 'thin', color: { argb: '000000' } },
      bottom: { style: 'thin', color: { argb: '000000' } },
      left: { style: 'thin', color: { argb: '000000' } },
      right: { style: 'thin', color: { argb: '000000' } }
    }
  };
}

// Helper function to extract dynamic columns (date columns) from a data sample
function getDynamicColumns(dataSample) {
  return Object.keys(dataSample).filter((key) => key.match(/^\d{2}-\d{2}$/)); // Matches the "dd-mm" format
}

const printAtndSummaryToXLS = async ({ from_date, to_date, contractor, bu, entity, department, emp_type, emp_id, token }) => {
  try {
    // Process contractor, bu, entity, and department selections to handle "ALL"
    const selectedContractor = processSelection(contractor);
    const selectedBU = processSelection(bu);
    const selectedEntity = processSelection(entity);
    const selectedDepartment = processSelection(department);

    // Fetch data from the API
    const response = await axios.post('/api/attendance/printSummary', {
      from_date,
      to_date,
      contractor: selectedContractor.length ? selectedContractor : null,
      bu: selectedBU.length ? selectedBU : null,
      entity: selectedEntity.length ? selectedEntity : null,
      department: selectedDepartment.length ? selectedDepartment : null,
      emp_type: emp_type,
      emp_id: emp_id,
      token: token
    });

    const attendanceData = response.data;

    if (!Array.isArray(attendanceData) || attendanceData.length === 0) {
      throw new Error("No data for the selected filters");
    }

    // Sample record to extract dynamic columns (date columns)
    const dynamicColumns = getDynamicColumns(attendanceData[0]);

    // Create a new workbook and worksheet using ExcelJS
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Summary');

    // Add title row
    worksheet.addRow([`DEPARTMENT WISE MANPOWER DEPLOYMENT BY EACH CONTRACTOR FOR THE PERIOD ${from_date} TO ${to_date}`]);
    worksheet.addRow([]); // Empty row for spacing

    // Add headers
    const headers = ["Contractor", "BU", "Department", ...dynamicColumns, "Total"];
    worksheet.addRow(headers).eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D3D3D3' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Initialize contractor-level subtotal
    let currentContractor = '';
    let contractorSubtotal = {};
    let grandTotal = {};

    attendanceData.forEach((item, index) => {
      // Reset contractor subtotal on contractor change
      if (item.contractor_name !== currentContractor) {
        if (index > 0) {
          // Add subtotal row before switching to the new contractor
          createSubtotalRow(worksheet, contractorSubtotal, dynamicColumns);
        }
        currentContractor = item.contractor_name;
        contractorSubtotal = createEmptyTotalRow(dynamicColumns);
      }

      const row = worksheet.addRow([
        item.contractor_name || '',
        item.bu_name || '',
        item.dept_name || '',
        ...dynamicColumns.map(col => item[col] || 0),
        item.Total || 0
      ]);

      // Update subtotals and grand totals
      dynamicColumns.forEach((col) => {
        contractorSubtotal[col] = (contractorSubtotal[col] || 0) + (item[col] || 0);
        grandTotal[col] = (grandTotal[col] || 0) + (item[col] || 0);
      });
      contractorSubtotal.Total = (contractorSubtotal.Total || 0) + (item.Total || 0);
      grandTotal.Total = (grandTotal.Total || 0) + (item.Total || 0);
    });

    // Add final subtotal and grand total rows
    createSubtotalRow(worksheet, contractorSubtotal, dynamicColumns);
    worksheet.addRow([]); // Empty row for spacing
    createGrandTotalRow(worksheet, grandTotal, dynamicColumns);

    // Export the Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AttendanceSummary_${from_date}_to_${to_date}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error("Error generating the attendance summary XLS:", error);
    throw error;
  }
};

// Function to create a subtotal row with formatting
function createSubtotalRow(worksheet, subtotal, dynamicColumns) {
  const row = worksheet.addRow(['Subtotal', '', '', ...dynamicColumns.map(col => subtotal[col] || 0), subtotal.Total || 0]);
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'right' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } }; // Yellow for subtotal
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });
}

// Function to create a grand total row with formatting
function createGrandTotalRow(worksheet, grandTotal, dynamicColumns) {
  const row = worksheet.addRow(['Grand Total', '', '', ...dynamicColumns.map(col => grandTotal[col] || 0), grandTotal.Total || 0]);
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'right' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA500' } }; // Orange for grand total
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });
}

// Function to create an empty total row
function createEmptyTotalRow(dynamicColumns) {
  const emptyTotal = {};
  dynamicColumns.forEach((col) => {
    emptyTotal[col] = 0;
  });
  emptyTotal.Total = 0;
  return emptyTotal;
}

export default printAtndSummaryToXLS;
