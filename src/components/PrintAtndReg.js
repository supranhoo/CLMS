import axios from "../api/axios.js";
import { jsPDF } from "jspdf";

// Function to format attendance_date as dd/mm/yyyy
function formatDate(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTimeToHHMM(dateString) {
  const date = new Date(dateString);

  const hours = String(date.getHours()).padStart(2, "0"); // Get hours in 24-hour format and pad with 0 if necessary
  const minutes = String(date.getMinutes()).padStart(2, "0"); // Get minutes and pad with 0 if necessary

  return `${hours}:${minutes}`; // Return the formatted time as HH:MM
}

const formatTime = (dateTimeString) => {
  // Split the string by 'T' to separate the date and time
  const [datePart, timePart] = dateTimeString.split("T");
  // Take only the HH:MM part from the time
  const timeWithoutSeconds = timePart ? timePart.substring(0, 5) : "00:00";
  return `${timeWithoutSeconds}`;
};

async function printAtndReg(from_date, to_date, emp_type) {
  try {
    // Fetch the data from the API
    const response = await axios.post("/api/attendance/printAtndReg", {
      from_date,
      to_date,
      emp_type,
    });

    const attendanceData = response.data;
    const loop_cnt = 0;

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

    // Create a new jsPDF document
    const doc = new jsPDF();

    const headerFontSize = 10;
    const fontSize = 10;
    doc.setFontSize(fontSize);

    // Helper function to draw table headers with a background
    function drawTableHeaders(doc, yPos) {
      // Light gray background
      doc.line(10, yPos, 204, yPos); // Horizontal top line
      yPos += 5;
      doc.text("EmpCode", 10, yPos);
      doc.text("Employee Name", 29, yPos);
      doc.text("Designation", 63, yPos);
      doc.text("Date", 100, yPos);
      doc.text("Shift", 120, yPos);
      doc.text("IN", 134, yPos);
      doc.text("Out", 144, yPos);
      doc.text("Hours", 157, yPos);
      doc.text("Status", 174, yPos);
      doc.text("OT Hrs", 189, yPos);
      yPos += 4;
      doc.line(10, yPos, 204, yPos); // Horizontal bottom line
    }

    // Loop through each contractor
    for (const contractorCode in contractors) {
      const contractorDepartments = contractors[contractorCode];

      // Add a new page for each contractor
      doc.addPage();

      // Add the multi-line heading
      doc.setFontSize(headerFontSize);
      doc.text("", 105, 10, { align: "center" });
      doc.text("VILL-TARAIMAL, PO-GERWANI, RAIGARH (C.G)", 105, 15, {
        align: "center",
      });
      if (emp_type == "SL")
        doc.text("DAILY ATTENDANCE REGISTER - SUPPLY LABOUR", 105, 20, {
          align: "center",
        });
      else
        doc.text("DAILY ATTENDANCE REGISTER - PEICE RATE LABOUR", 105, 20, {
          align: "center",
        });

      doc.setFontSize(fontSize); // Reset font size for the body text

      // Get the department codes (e.g., ELECT, MECHA)
      const departmentCodes = Object.keys(contractorDepartments);

      if (departmentCodes.length > 0) {
        const firstDepartment = contractorDepartments[departmentCodes[0]]; // Get the first department's data
        doc.text(
          `Contractor: ${firstDepartment[0].contractor_id || ""} - ${
            firstDepartment[0].contractor_name || ""
          }`,
          10,
          30
        );
      }

      // Draw table headers
      drawTableHeaders(doc, 35);
      let yPos = 50; // Start after headers

      // Loop through each department for the contractor
      for (const department in contractorDepartments) {
        const departmentData = contractorDepartments[department];
        yPos += 5;
        doc.setFont("helvetica", "bold"); // Set font to bold for Department
        doc.text(
          `Department: ${departmentData[0].dept_code || ""} - ${
            departmentData[0].dept_name || ""
          }`,
          10,
          yPos
        );
        doc.text(
          `BU: ${departmentData[0].bu_code || ""} - ${
            departmentData[0].bu_name || ""
          }`,
          100,
          yPos
        );
        doc.setFont("helvetica", "normal"); // Reset font to normal for subsequent text
        yPos += 2;
        doc.line(10, yPos, 150, yPos);
        yPos += 5;
        // Add data for each employee in the department
        departmentData.forEach((item) => {
          doc.text(item.employee_code || "", 10, yPos);
          const display_name = (item.display_name || "").substring(0, 19);
          doc.text(display_name || "", 29, yPos);
          const design_name = (item.design_name || "").substring(0, 17);
          doc.text(design_name || "", 68, yPos);
          doc.text(formatDate(item.attendance_date || ""), 100, yPos); // Format attendance_date as dd/mm/yyyy
          doc.text(item.shift || "", 122, yPos);

          doc.text(item.in_punch ? formatTime(item.in_punch) : "", 132, yPos); // Use the formatTimeToHHMM function
          doc.text(item.out_punch ? formatTime(item.out_punch) : "", 144, yPos); // Use the formatTimeToHHMM function

          doc.text(
            item.working_hours ? String(item.working_hours) : "",
            157,
            yPos
          );
          doc.text(item.punch_mark || "", 176, yPos);
          doc.text(item.ot_hours ? String(item.ot_hours) : "", 189, yPos);

          yPos += 5;
          // Add a new page if the content exceeds the page height
          if (yPos > 270) {
            doc.addPage();
            doc.setFontSize(headerFontSize);
            doc.text("", 105, 10, { align: "center" });
            doc.text("VILL-TARAIMAL, PO-GERWANI, RAIGARH (C.G)", 105, 15, {
              align: "center",
            });
            if (emp_type == "SL")
              doc.text("DAILY ATTENDANCE REGISTER - SUPPLY LABOUR", 105, 20, {
                align: "center",
              });
            else
              doc.text(
                "DAILY ATTENDANCE REGISTER - PEICE RATE LABOUR",
                105,
                20,
                { align: "center" }
              );

            doc.setFontSize(fontSize); // Reset font size for the body text

            // Add contractor name and department in subheading
            doc.text(
              `Contractor: ${contractorCode} - ${
                departmentData[0].contractor_name || ""
              }`,
              10,
              30
            );
            // Underline the BU and Department again after page break
            // Draw table headers on new page
            drawTableHeaders(doc, 35);
            yPos = 50; // Reset yPos for the new page
            doc.setFont("helvetica", "bold"); // Set font to bold for Department
            doc.text(
              `Department: ${departmentData[0].dept_code || ""} - ${
                departmentData[0].dept_name || ""
              }`,
              10,
              yPos
            );
            doc.text(
              `BU: ${departmentData[0].bu_code || ""} - ${
                departmentData[0].bu_name || ""
              }`,
              100,
              yPos
            );
            doc.setFont("helvetica", "normal"); // Reset font to normal for subsequent text
            yPos += 2;
            doc.line(10, yPos, 150, yPos);
            yPos += 5;
          }
        });
      }
    }

    // Save the PDF and trigger the download
    doc.save(`Attendance_SL_${from_date}_to_${to_date}.pdf`);
  } catch (error) {
    console.error("Error generating the SL report:", error);
  }
}

export default printAtndReg;
