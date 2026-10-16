import axios from "../api/axios.js";
import { jsPDF } from "jspdf";

// Function to format attendance_date as dd/mm/yyyy
function formatDate(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

const formatTime = (dateTimeString) => {
  const [datePart, timePart] = dateTimeString.split("T");
  const timeWithoutSeconds = timePart ? timePart.substring(0, 5) : "00:00";
  return `${timeWithoutSeconds}`;
};

const processSelection = (selection) => {
  if (selection.includes("ALL")) {
    return selection;
  }
  return selection;
};

const printAtndReg = async ({
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
    const selectedContractor = processSelection(contractor);
    const selectedBU = processSelection(bu);
    const selectedLocCode = processSelection(locCode);
    const selectedEntity = processSelection(entity);
    const selectedDepartment = processSelection(department);

    const response = await axios.post("/api/attendance/printAtndReg2", {
      from_date,
      to_date,
      contractor: selectedContractor.length ? selectedContractor : null,
      bu: selectedBU.length ? selectedBU : null,
      locCode: selectedLocCode.length ? selectedLocCode : null,
      entity: selectedEntity.length ? selectedEntity : null,
      department: selectedDepartment.length ? selectedDepartment : null,
      emp_type,
      emp_id,
      token,
    });

    const attendanceData = response.data;

    // Group data by contractor, BU, and department
    const contractors = {};
    attendanceData.forEach((item) => {
      if (!contractors[item.contractor_name]) {
        contractors[item.contractor_name] = {};
      }
      if (!contractors[item.contractor_name][item.bu_name]) {
        contractors[item.contractor_name][item.bu_name] = {};
      }
      if (!contractors[item.contractor_name][item.bu_name][item.dept_name]) {
        contractors[item.contractor_name][item.bu_name][item.dept_name] = [];
      }
      contractors[item.contractor_name][item.bu_name][item.dept_name].push(
        item
      );
    });

    const doc = new jsPDF();
    const headerFontSize = 9;
    const fontSize = 9;
    doc.setFontSize(fontSize);

    // Draw report title and contractor heading on all pages
    function drawPageHeader(doc, emp_type, contractorName, entity_name, yPos) {
      doc.setFontSize(headerFontSize);
      //doc.text("", 105, 10, { align: "center" });
      doc.text(entity_name, 105, 10, { align: "center" });

      //doc.text("VILL-TARAIMAL, PO-GERWANI, RAIGARH (C.G)", 105, 15, { align: "center" });

      const title =
        emp_type.length > 1
          ? "DAILY ATTENDANCE REGISTER - ALL"
          : emp_type[0] === "SL"
          ? "DAILY ATTENDANCE REGISTER - SUPPLY LABOUR"
          : "DAILY ATTENDANCE REGISTER - PIECE RATE LABOUR";

      doc.text(title, 105, 15, { align: "center" });

      // Contractor name
      doc.setFont("helvetica", "bold");
      doc.text(`Contractor: ${contractorName}`, 10, yPos);
      doc.setFont("helvetica", "normal");

      return yPos + 5;
    }

    // Draw table headers
    function drawTableHeaders(doc, yPos) {
      doc.line(10, yPos, 204, yPos);
      yPos += 5;
      doc.text("EmpCode", 10, yPos);
      doc.text("Employee Name", 29, yPos);
      doc.text("Designation", 63, yPos);
      doc.text("Section", 83, yPos);
      doc.text("Date", 110, yPos);
      doc.text("Shift", 130, yPos);
      doc.text("IN", 144, yPos);
      doc.text("Out", 154, yPos);
      doc.text("Hours", 167, yPos);
      doc.text("Status", 184, yPos);
      doc.text("OT Hrs", 199, yPos);
      yPos += 4;
      doc.line(10, yPos, 204, yPos);
      return yPos + 5;
    }

    let yPos;
    // Loop through contractors
    for (const contractorName in contractors) {
      const contractorData = contractors[contractorName];
      let cnt = 0;
      for (const buName in contractorData) {
        const buData = contractorData[buName];

        for (const deptName in buData) {
          const deptData = buData[deptName];

          if (cnt == 0) {
            doc.addPage();
            yPos = drawPageHeader(
              doc,
              emp_type,
              contractorName,
              deptData[0].entity_name,
              20
            );
            cnt = 1;
          }

          // BU & Department subheading in a single line
          doc.setFont("helvetica", "bold");
          doc.text(`BU: ${buName} | Department: ${deptName}`, 10, yPos);
          doc.setFont("helvetica", "normal");
          yPos += 5;

          // Draw table headers
          yPos = drawTableHeaders(doc, yPos);

          // Attendance data
          deptData.forEach((item) => {
            doc.text(item.employee_code || "", 10, yPos);
            doc.text((item.display_name || "").substring(0, 19), 29, yPos);
            doc.text((item.design_name || "").substring(0, 15), 63, yPos);
            doc.text((item.section || "").substring(0, 15), 83, yPos);
            doc.text(formatDate(item.attendance_date || ""), 110, yPos);
            doc.text(item.shift || "", 130, yPos);
            doc.text(item.in_punch ? formatTime(item.in_punch) : "", 144, yPos);
            doc.text(
              item.out_punch ? formatTime(item.out_punch) : "",
              154,
              yPos
            );
            doc.text(
              item.working_hours ? String(item.working_hours) : "",
              167,
              yPos
            );
            doc.text(item.punch_mark || "", 184, yPos);
            doc.text(item.ot_hours ? String(item.ot_hours) : "", 199, yPos);
            yPos += 5;

            // Check if content exceeds page height
            if (yPos > 270) {
              doc.addPage();
              yPos = drawPageHeader(
                doc,
                emp_type,
                contractorName,
                item.entity_name,
                20
              );
              yPos = drawTableHeaders(doc, yPos);
            }
          });

          // Add spacing after department
          yPos += 10;
        }
      }
    }

    doc.save(`Attendance_${from_date}_to_${to_date}.pdf`);
  } catch (error) {
    console.error("Error generating the attendance report:", error);
  }
};

export default printAtndReg;
