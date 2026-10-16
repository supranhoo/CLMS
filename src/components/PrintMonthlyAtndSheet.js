import axios from "../api/axios.js";
import { jsPDF } from "jspdf";

// Helper function to process "ALL" logic
function processSelection(selection) {
  if (selection.includes("ALL")) {
    return selection;
  }
  return selection; // Return the filtered selection without 'ALL'
}

const printMonthlyAtndSheet = async ({
  from_date,
  to_date,
  contractor,
  bu,
  locCode,
  entity,
  department,
  emp_type,
  emp_id,
  token,
}) => {
  try {
    // Process contractor, bu, entity, and department selections to handle "ALL"
    const selectedContractor = processSelection(contractor);
    const selectedBU = processSelection(bu);
    const selectedLocCode = processSelection(locCode);
    const selectedEntity = processSelection(entity);
    const selectedDepartment = processSelection(department);
    const selectedEmpType = processSelection(emp_type);

    // Fetch attendance data
    const response = await axios.post("/api/attendance/printAtndReg2", {
      from_date,
      to_date,
      contractor: selectedContractor.length ? selectedContractor : null,
      bu: selectedBU.length ? selectedBU : null,
      locCode: selectedLocCode.length ? selectedLocCode : null,
      entity: selectedEntity.length ? selectedEntity : null,
      department: selectedDepartment.length ? selectedDepartment : null,
      emp_type: selectedEmpType.length ? selectedEmpType : null,
      emp_id: emp_id,
      token: token,
    });

    const attendanceData = response.data;

    // Group data by employee and date
    const employeeAttendance = {};
    attendanceData.forEach((item) => {
      if (!employeeAttendance[item.employee_code]) {
        employeeAttendance[item.employee_code] = {
          name: item.display_name,
          designation: item.design_name,
          attendance: {},
          otHours: {},
        };
      }
      // Store attendance punch_mark and ot_hours for each day of the month
      const day = new Date(item.attendance_date).getDate();
      employeeAttendance[item.employee_code].attendance[day] =
        item.punch_mark || "";
      employeeAttendance[item.employee_code].otHours[day] = item.ot_hours || "";
    });

    // Create a new jsPDF document
    const doc = new jsPDF();

    const headerFontSize = 10;
    const fontSize = 10;
    doc.setFontSize(fontSize);

    // Draw monthly table headers (Days 1-31)
    function drawMonthlyTableHeaders(doc, yPos) {
      doc.line(10, yPos, 204, yPos); // Horizontal top line
      yPos += 5;
      doc.text("EmpCode", 10, yPos);
      doc.text("Employee Name", 29, yPos);
      doc.text("Designation", 63, yPos);
      let xPos = 100;
      for (let i = 1; i <= 31; i++) {
        doc.text(String(i), xPos, yPos); // Print day numbers as headers
        xPos += 5; // Adjust spacing as needed
      }
      yPos += 4;
      doc.line(10, yPos, 204, yPos); // Horizontal bottom line
    }

    // Start drawing the table
    let yPos = 35; // Starting position
    drawMonthlyTableHeaders(doc, yPos);
    yPos += 10; // Move position for first row

    // Loop through each employee
    Object.keys(employeeAttendance).forEach((empCode) => {
      const employee = employeeAttendance[empCode];
      const attendance = employee.attendance;
      const otHours = employee.otHours;

      // First row: Punch Mark
      doc.text(empCode, 10, yPos); // Employee Code
      doc.text(employee.name.substring(0, 19), 29, yPos); // Employee Name
      doc.text(employee.designation.substring(0, 17), 63, yPos); // Designation

      // Print punch marks for days 1-31
      let xPos = 100;
      for (let i = 1; i <= 31; i++) {
        const punchMark = attendance[i] || "";
        doc.text(punchMark, xPos, yPos);
        xPos += 5; // Adjust the column spacing
      }

      yPos += 5;

      // Second row: OT Hours
      xPos = 100;
      for (let i = 1; i <= 31; i++) {
        const otHour = otHours[i] ? String(otHours[i]) : "";
        doc.text(otHour, xPos, yPos);
        xPos += 5; // Adjust the column spacing
      }

      yPos += 5;

      // Add a new page if necessary
      if (yPos > 270) {
        doc.addPage();
        yPos = 35; // Reset yPos for the new page
        drawMonthlyTableHeaders(doc, yPos);
        yPos += 10;
      }
    });

    // Save the PDF and trigger the download
    doc.save(`MonthlyAttendance_${from_date}_to_${to_date}.pdf`);
  } catch (error) {
    console.error("Error generating the attendance report:", error);
  }
};

export default printMonthlyAtndSheet;
