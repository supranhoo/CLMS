import axios from "../api/axios.js";
import { jsPDF } from "jspdf";

// Helper function to process "ALL" logic
function processSelection(selection) {
  return selection.includes("ALL") ? [] : selection; // Adjust as needed for your API
}

// Function to format attendance_date as dd/mm/yyyy
function formatDate(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

const printWagesPDF = async ({
  pmonth,
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

    const response = await axios.post("/api/wages/getWageRegister", {
      pmonth,
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

    // Group data by contractor and department
    const contractors = {};
    attendanceData.forEach((item) => {
      if (!contractors[item.ContractorName])
        contractors[item.ContractorName] = {};
      if (!contractors[item.ContractorName][item.dept_code])
        contractors[item.ContractorName][item.dept_code] = [];
      contractors[item.ContractorName][item.dept_code].push(item);
    });

    // Create a new jsPDF document with A4 landscape
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "A4",
    });
    const headerFontSize = 10;
    const fontSize = 10;

    doc.setFont("CalibriLight");
    doc.setFontSize(fontSize);

    // Helper function to draw headers and contractor name
    function drawPageHeader(doc, yPos, contractorName) {
      doc.setFontSize(headerFontSize);
      doc.text("", 148, 10, { align: "center" });
      doc.text("VILL-TARAIMAL, PO-GERWANI, RAIGARH (C.G)", 148, 15, {
        align: "center",
      });
      doc.text("REGISTER OF WAGES", 148, 20, { align: "center" });
      doc.setFontSize(fontSize);

      // Print contractor name at the top
      doc.text(`Contractor: ${contractorName}`, 10, 30);
      doc.text("Name of Establishment     :", 10, 35);
      doc.text("Nature & Work Location    :", 10, 40);
      doc.text("Name of Principal Employer:", 10, 45);
      doc.text("Wages Period              :", 10, 50);

      yPos += 20;
      doc.line(1, yPos, 295, yPos); // Header top line
      yPos += 5;

      // Column headers
      doc.text("Sno", 1, yPos);
      doc.text("EmpCode", 10, yPos);
      doc.text("Employee Name", 29, yPos);
      doc.text("Designation", 70, yPos);
      doc.text("Department", 90, yPos);
      doc.text("BU", 122, yPos);
      doc.text("Days", 150, yPos);
      doc.text("Rate", 162, yPos);
      doc.text("Basic", 175, yPos);
      doc.text("DA Alw", 185, yPos);
      doc.text("Jaggery", 195, yPos);
      doc.text("OT Amt", 205, yPos);
      doc.text("Gross", 215, yPos);
      doc.text("PF", 230, yPos);
      doc.text("ESI", 240, yPos);
      doc.text("LWF", 250, yPos);
      doc.text("Total Ded", 260, yPos);
      doc.text("Net Amount", 275, yPos);
      yPos += 5;
      doc.line(1, yPos, 295, yPos); // Header bottom line

      return yPos + 4;
    }

    // Loop through each contractor, starting a new page for each
    for (const ContractorName in contractors) {
      const contractorDepartments = contractors[ContractorName];
      const contractorName =
        contractorDepartments[Object.keys(contractorDepartments)[0]][0]
          .ContractorName;

      // Start a new page and draw headers for each contractor
      doc.addPage();
      let yPos = drawPageHeader(doc, 30, contractorName);
      let serialNumber = 1; // Reset serial number for each contractor

      // Loop through each department within the contractor
      for (const department in contractorDepartments) {
        const departmentData = contractorDepartments[department];

        // Add data for each employee in the department
        departmentData.forEach((item, index) => {
          yPos += 5;
          doc.text(String(serialNumber), 1, yPos); // Print serial number
          doc.text(item.EmployeeCode || "", 10, yPos);
          doc.text((item.EmployeeName || "").substring(0, 19), 29, yPos);
          doc.text((item.Designation || "").substring(0, 12), 70, yPos);
          doc.text((item.Department || "").substring(0, 15), 90, yPos);
          doc.text((item.BusinessUnit || "").substring(0, 15), 122, yPos);
          doc.text(item.Days ? String(item.Days) : "", 150, yPos);
          doc.text(item.BasicRate ? String(item.BasicRate) : "", 162, yPos);
          doc.text(item.Basic ? String(item.Basic) : "", 175, yPos);
          doc.text(item.DA ? String(item.DA) : "", 185, yPos);
          doc.text(item.Jaggery ? String(item.Jaggery) : "", 195, yPos);
          doc.text(item.OTAmt ? String(item.OTAmt) : "", 205, yPos);
          doc.text(item.Gross ? String(item.Gross) : "", 215, yPos);
          doc.text(item.EmpESI ? String(item.EmpESI) : "", 230, yPos);
          doc.text(item.EmpPF ? String(item.EmpPF) : "", 240, yPos);
          doc.text(item.LWF ? String(item.LWF) : "", 250, yPos);
          doc.text(item.TotalDed ? String(item.TotalDed) : "", 260, yPos);
          doc.text(item.NetAmt ? String(item.NetAmt) : "", 275, yPos);

          serialNumber++; // Increment serial number
          // Add a new page if content exceeds page height
          if (yPos > 190) {
            doc.addPage();
            yPos = drawPageHeader(doc, 30, contractorName);
          }
        });
      }
    }

    // Save the PDF
    doc.save(`Wages_Register_${pmonth}.pdf`);
  } catch (error) {
    console.error("Error generating the wages report:", error);
    throw error;
  }
};

export default printWagesPDF;
