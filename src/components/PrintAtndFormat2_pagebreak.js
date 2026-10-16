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

const printAtndReg2_pagebreak = async ({
  from_date,
  to_date,
  contractor,
  bu,
  entity,
  department,
  emp_type,
  emp_id,
  token,
}) => {
  try {
    const selectedContractor = processSelection(contractor);
    const selectedBU = processSelection(bu);
    const selectedEntity = processSelection(entity);
    const selectedDepartment = processSelection(department);

    const response = await axios.post("/api/attendance/printAtndReg2", {
      from_date,
      to_date,
      contractor: selectedContractor.length ? selectedContractor : null,
      bu: selectedBU.length ? selectedBU : null,
      entity: selectedEntity.length ? selectedEntity : null,
      department: selectedDepartment.length ? selectedDepartment : null,
      emp_type,
      emp_id,
      token,
    });

    const attendanceData = response.data;

    if (!Array.isArray(attendanceData) || attendanceData.length === 0) {
      throw new Error("No data for the selected filters");
    }

    // Group data by contractor, BU, and department
    const contractors = {};
    attendanceData.forEach((item) => {
      if (!contractors[item.contractor_id]) {
        contractors[item.contractor_id] = {};
      }
      if (!contractors[item.contractor_id][item.bu_code]) {
        contractors[item.contractor_id][item.bu_code] = {};
      }
      if (!contractors[item.contractor_id][item.bu_code][item.dept_code]) {
        contractors[item.contractor_id][item.bu_code][item.dept_code] = [];
      }
      contractors[item.contractor_id][item.bu_code][item.dept_code].push(item);
    });

    const doc = new jsPDF();
    const headerFontSize = 9;
    const fontSize = 9;
    doc.setFontSize(fontSize);

    function drawTableHeaders(
      doc,
      emp_type,
      contractor_id,
      contractor_name,
      entity_name
    ) {
      doc.addPage();
      doc.setFontSize(headerFontSize);
      //doc.text("", 105, 10, { align: "center" });
      doc.text(entity_name, 105, 10, { align: "center" });
      //doc.text("VILL-TARAIMAL, PO-GERWANI, RAIGARH (C.G)", 105, 15, { align: "center" });
      let title = ""; // Declare the variable properly
      if (emp_type.length > 1) {
        title = "DAILY ATTENDANCE REGISTER - ALL";
      } else {
        title =
          emp_type[0] === "SL"
            ? "DAILY ATTENDANCE REGISTER - SUPPLY LABOUR"
            : "DAILY ATTENDANCE REGISTER - PIECE RATE LABOUR";
      }
      doc.text(title, 105, 15, { align: "center" });
      doc.setFontSize(fontSize);
      doc.text(`Contractor: ${contractor_id} - ${contractor_name}`, 10, 20);
      doc.line(10, 25, 204, 25);
      doc.text("EmpCode", 10, 30);
      doc.text("Employee Name", 29, 30);
      doc.text("Designation", 63, 30);
      doc.text("Section", 83, 30);
      doc.text("Date", 110, 30);
      doc.text("Shift", 130, 30);
      //doc.text("IN", 144, 30);
      //doc.text("Out", 154, 30);
      //doc.text("Hours", 167, 30);
      doc.text("Status", 184, 30);
      //doc.text("OT Hrs", 199, 30);
      doc.line(10, 35, 224, 35);
      return 40; // Return initial yPos for rows
    }

    function drawBUHeaders(doc, yPos, bu_code, bu_name) {
      doc.setFont("helvetica", "bold");
      doc.text(`BU: ${bu_code} - ${bu_name}`, 10, yPos);
      doc.setFont("helvetica", "normal");
      return yPos + 5;
    }

    function drawDeptHeaders(doc, yPos, dept_code, dept_name) {
      doc.setFont("helvetica", "bold");
      doc.text(`Department: ${dept_code} - ${dept_name}`, 10, yPos);
      doc.setFont("helvetica", "normal");
      return yPos + 5;
    }

    for (const contractorId in contractors) {
      const contractorData = contractors[contractorId];
      for (const buCode in contractorData) {
        const buData = contractorData[buCode];
        for (const deptCode in buData) {
          const deptData = buData[deptCode];
          // New page for each Contractor -> BU -> Department combination
          let yPos = drawTableHeaders(
            doc,
            emp_type,
            deptData[0].contractor_id,
            deptData[0].contractor_name,
            deptData[0].entity_name
          );
          yPos = drawBUHeaders(
            doc,
            yPos,
            deptData[0].bu_code,
            deptData[0].bu_name
          );
          yPos = drawDeptHeaders(
            doc,
            yPos,
            deptData[0].dept_code,
            deptData[0].dept_name
          );

          deptData.forEach((item) => {
            doc.text(item.employee_code || "", 10, yPos);
            doc.text((item.display_name || "").substring(0, 19), 29, yPos);
            doc.text((item.design_name || "").substring(0, 15), 63, yPos);
            doc.text((item.section || "").substring(0, 15), 83, yPos);
            doc.text(formatDate(item.attendance_date || ""), 110, yPos);
            doc.text(item.shift || "", 130, yPos);
            //doc.text(item.in_punch ? formatTime(item.in_punch) : "", 144, yPos);
            //doc.text(item.out_punch ? formatTime(item.out_punch) : "", 154, yPos);
            //doc.text(item.working_hours ? String(item.working_hours) : "", 167, yPos);
            doc.text(item.punch_mark || "", 184, yPos);
            //doc.text(item.ot_hours ? String(item.ot_hours) : "", 199, yPos);
            yPos += 5;

            if (yPos > 270) {
              yPos = drawTableHeaders(
                doc,
                emp_type,
                item.contractor_id,
                item.contractor_name,
                item.entity_name
              );
              yPos = drawBUHeaders(doc, yPos, item.bu_code, item.bu_name);
              yPos = drawDeptHeaders(doc, yPos, item.dept_code, item.dept_name);
            }
          });

          // Signatures at the bottom of each department
          doc.line(10, yPos, 204, yPos);
          yPos += 10;
          doc.text("Sign. Contractor", 10, yPos);
          doc.text("Sign. Dept Head/Unit Head", 157, yPos);
        }
      }
    }

    doc.save(`Attendance_${from_date}_to_${to_date}.pdf`);
  } catch (error) {
    console.error("Error generating the attendance report:", error);
    throw error;
  }
};

export default printAtndReg2_pagebreak;
