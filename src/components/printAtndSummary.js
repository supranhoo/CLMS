import axios from "../api/axios.js";
import { jsPDF } from "jspdf";

// Helper function to process "ALL" logic
function processSelection(selection) {
  if (selection.includes('ALL')) {
    return selection;
  }
  return selection;
}

// Helper function to extract dynamic columns (date columns) from a data sample
function getDynamicColumns(dataSample) {
  return Object.keys(dataSample).filter((key) => key.match(/^\d{2}-\d{2}$/)); // Matches the "dd-mm" format
}

const printAtndSummary = async ({ from_date, to_date, contractor, bu, entity, department, emp_type, emp_id, token }) => {
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

    // Create a new jsPDF document with landscape orientation
    const doc = new jsPDF({
      orientation: 'landscape',  // Set orientation to landscape
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const availableWidth = pageWidth - 2 * margin;

    // Set dynamic column width based on the number of columns
    const staticColumnCount = 3; // Contractor, BU, Department
    const dynamicColumnCount = dynamicColumns.length + 1; // Include the 'Total' column
    const columnWidth = availableWidth / (staticColumnCount + dynamicColumnCount); 

    const headerFontSize = 10;
    const fontSize = 10;
    doc.setFontSize(fontSize);

    // Helper function to draw table headers with dynamic columns
    function drawTableHeaders(doc, yPos, dynamicColumns) {
      doc.line(margin, yPos, pageWidth - margin, yPos); // Horizontal top line
      yPos += 5;
      doc.text("Contractor", margin, yPos);
      doc.text("BU", margin + columnWidth * 1, yPos);
      doc.text("Department", margin + columnWidth * 2, yPos);

      // Add dynamic date columns in the header
      let xPos = margin + columnWidth * 3;
      dynamicColumns.forEach((col) => {
        doc.text(col, xPos, yPos); // Add each dynamic column (date)
        xPos += columnWidth;
      });

      // Add Total column header
      doc.text("Total", xPos, yPos);
      yPos += 4;
      doc.line(margin, yPos, pageWidth - margin, yPos); // Horizontal bottom line
    }

    // Draw table headers at the top of the page
    drawTableHeaders(doc, 20, dynamicColumns);

    // Loop through each record in the attendance data
    let yPos = 30; // Starting y position for data rows

    attendanceData.forEach((item) => {
      // Add a new page if content exceeds the page height
      if (yPos > 190) { // Adjust for landscape orientation
        doc.addPage();
        yPos = 30; // Reset y position for new page
        drawTableHeaders(doc, 20, dynamicColumns); // Redraw headers on new page
      }

      // Print Contractor Name, BU, and Department
      doc.text(item.contractor_name || '', margin, yPos);
      doc.text(item.bu_name || '', margin + columnWidth * 1, yPos);
      doc.text(item.dept_name || '', margin + columnWidth * 2, yPos);

      // Print dynamic date columns
      let xPos = margin + columnWidth * 3;
      dynamicColumns.forEach((col) => {
        const value = item[col] !== null ? item[col].toString() : "0"; // Replace null with 0
        doc.text(value, xPos, yPos);
        xPos += columnWidth;
      });

      // Print Total
      doc.text(item.Total ? item.Total.toString() : "0", xPos, yPos);

      yPos += 10; // Move to the next row
    });

    // Save the PDF and trigger the download
    doc.save(`AttendanceSummary_${from_date}_to_${to_date}.pdf`);
  } catch (error) {
    console.error("Error generating the attendance summary report:", error);
    throw error;
  }
};

export default printAtndSummary;
