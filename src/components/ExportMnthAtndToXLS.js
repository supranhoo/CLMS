import ExcelJS from "exceljs";
import axios from "../api/axios.js";

// Helper function to process "ALL" logic
function processSelection(selection) {
  if (selection.includes("ALL")) {
    return selection;
  }
  return selection; // Return the filtered selection without 'ALL'
}

// Helper function to calculate date range between two dates
function getDateRange(fromDate, toDate) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const dates = [];

  // Loop through each day in the range and add it to the dates array
  for (let d = from; d <= to; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d)); // Push each date as a new Date object
  }
  return dates;
}

function classifyAttendance(punchMark) {
  const pm = (punchMark || "").trim();

  return {
    PR:
      pm === "P"
        ? 1
        : pm === "HDP"
          ? 0.5
          : pm === "WOP"
            ? 1
            : pm === "WOH"
              ? 0.5
              : 0,

    AB: pm === "PX" || pm === "A" || pm === "" ? 1 : 0,

    WO: pm === "WO" ? 1 : 0,

    HLD: pm === "HLD" ? 1 : pm === "POH" ? 1 : pm === "HOH" ? 0.5 : 0,

    PAID: ["EL", "CL", "SL", "SPL"].includes(pm) ? 1 : 0,

    UNPAID: pm === "LWP" || pm === "ESI" ? 1 : 0,

    OD: pm === "OD" ? 1 : 0,
  };
}

// Helper function to calculate punch day totals
function calculatePunchMarkTotal(punchMark) {
  if (punchMark === "P") return 1;
  if (punchMark === "P ") return 1;
  if (punchMark === "OD") return 1;
  if (punchMark === "OD ") return 1;
  if (punchMark === "HDP") return 0.5;
  return 0;
}

// Helper function to convert HH:MM format to total minutes
function convertTimeToMinutes(timeString) {
  if (!timeString) return 0; // If timeString is empty, return 0 minutes
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

// Helper function to convert total minutes back to HH:MM format
function convertMinutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}`;
}

// Helper function to style the header
function getHeaderCellStyle() {
  return {
    font: { bold: true, size: 10 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "D3D3D3" } }, // Gray color background
    alignment: { horizontal: "center", vertical: "middle" }, // Center alignment
    border: {
      top: { style: "thin", color: { argb: "000000" } },
      bottom: { style: "thin", color: { argb: "000000" } },
      left: { style: "thin", color: { argb: "000000" } },
      right: { style: "thin", color: { argb: "000000" } },
    },
  };
}

// Helper function to style the data cells with dotted borders
function getDataCellStyle() {
  return {
    font: { size: 10 },
    alignment: { horizontal: "center", vertical: "middle" }, // Center alignment for day data
    border: {
      top: { style: "dotted", color: { argb: "000000" } },
      bottom: { style: "dotted", color: { argb: "000000" } },
      left: { style: "dotted", color: { argb: "000000" } },
      right: { style: "dotted", color: { argb: "000000" } },
    },
  };
}

// Helper function for bold text and gray background for totals column
function getTotalCellStyle() {
  return {
    font: { bold: true, size: 10 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "D3D3D3" } }, // Gray color background
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      top: { style: "thin", color: { argb: "000000" } },
      bottom: { style: "thin", color: { argb: "000000" } },
      left: { style: "thin", color: { argb: "000000" } },
      right: { style: "thin", color: { argb: "000000" } },
    },
  };
}

const ExportMnthAtndToXLS = async ({
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

    // Fetch attendance data
    const response = await axios.post("/api/attendance/printAtndReg2", {
      from_date,
      to_date,
      contractor: selectedContractor.length ? selectedContractor : null,
      bu: selectedBU.length ? selectedBU : null,
      locCode: selectedLocCode.length ? selectedLocCode : null,
      entity: selectedEntity.length ? selectedEntity : null,
      department: selectedDepartment.length ? selectedDepartment : null,
      emp_type: emp_type,
      emp_id: emp_id,
      token: token,
    });

    console.log(response);
    const attendanceData = response.data;

    // Calculate dynamic date range
    const dateRange = getDateRange(from_date, to_date); // Array of date objects

    // Group data by employee and date
    const employeeAttendance = {};
    const verticalTotals = {
      punches: Array(dateRange.length).fill(0),
      otMinutes: Array(dateRange.length).fill(0), // Track OT in minutes for day-wise totals
    };

    attendanceData.forEach((item) => {
      if (!employeeAttendance[item.employee_code]) {
        employeeAttendance[item.employee_code] = {
          name: item.display_name,
          designation: item.design_name,
          dept_name: item.dept_name,
          bu_name: item.bu_name,
          contractorName: item.contractor_name, // Store contractor data
          contractorId: item.contractor_id, // Store contractor data
          emp_category: item.emp_category || "", // ✅ REQUIRED
          attendance: {},
          otMinutes: {},
          totalPunchDays: 0,
          totalOTMinutes: 0, // Track OT in minutes for each employee
          // counters MUST be initialized (see next issue)
          PR: 0,
          AB: 0,
          WO: 0,
          HLD: 0,
          PAID: 0,
          UNPAID: 0,
          OD: 0,
        };
      }

      // Store attendance punch_mark and ot_hours for each day within the date range
      const attendanceDate = new Date(item.attendance_date);
      const day = attendanceDate.getDate(); // Extract day
      const dateKey = String(day).padStart(2, "0"); // Use day as the key

      if (
        attendanceDate >= new Date(from_date) &&
        attendanceDate <= new Date(to_date)
      ) {
        // Punch Mark and OT Hours
        const punchMark = item.punch_mark || "";
        const otHour = item.ot_hours || "00:00"; // Default to '00:00' if OT hours are missing

        employeeAttendance[item.employee_code].attendance[dateKey] = punchMark;
        employeeAttendance[item.employee_code].otMinutes[dateKey] =
          convertTimeToMinutes(otHour); // Convert to minutes

        // ✅ ADD THIS LINE HERE (EXACT LOCATION)
        const s = classifyAttendance(punchMark);

        // ✅ ADD THESE LINES IMMEDIATELY AFTER
        employeeAttendance[item.employee_code].PR += s.PR;
        employeeAttendance[item.employee_code].AB += s.AB;
        employeeAttendance[item.employee_code].WO += s.WO;
        employeeAttendance[item.employee_code].HLD += s.HLD;
        employeeAttendance[item.employee_code].PAID += s.PAID;
        employeeAttendance[item.employee_code].UNPAID += s.UNPAID;
        employeeAttendance[item.employee_code].OD += s.OD;

        // Calculate total punch days and OT hours for each employee
        employeeAttendance[item.employee_code].totalPunchDays +=
          calculatePunchMarkTotal(punchMark);
        employeeAttendance[item.employee_code].totalOTMinutes +=
          convertTimeToMinutes(otHour); // Add OT minutes

        // Calculate vertical totals for each day (punch mark totals and OT hours)
        const dateIndex = dateRange.findIndex((date) => date.getDate() === day);
        verticalTotals.punches[dateIndex] += calculatePunchMarkTotal(punchMark);
        verticalTotals.otMinutes[dateIndex] += convertTimeToMinutes(otHour); // Add OT minutes for each day
      }
    });

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Monthly Attendance");

    // Set page layout to A4 landscape and fit to single page width
    worksheet.pageSetup.paperSize = 9; // A4 size
    worksheet.pageSetup.orientation = "landscape";
    worksheet.pageSetup.fitToPage = true;
    worksheet.pageSetup.fitToWidth = 1;
    worksheet.pageSetup.fitToHeight = 0;

    // Add footer with Page No / Total Pages
    worksheet.headerFooter.oddFooter = `Page &P of &N`;

    // Add title row (Row 1)

    //const title = entity === 'SS' ? "SRI SHYAM ISPAT (India) PVT LTD" : "";
    worksheet.mergeCells(
      `A1:${worksheet.getColumn(3 + dateRange.length + 12).letter}1`,
    );
    //worksheet.getCell('A1').value = title;
    worksheet.getCell("A1").value = attendanceData[0].entity_name;
    worksheet.getCell("A1").font = { bold: true, size: 16 };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    // Add date period row (Row 2)
    worksheet.mergeCells(
      `A2:${worksheet.getColumn(3 + dateRange.length + 12).letter}2`,
    );
    worksheet.getCell("A2").value =
      `CONTRACT LABOUR ATTENDANCE SHEET FOR THE PERIOD: ${from_date} to ${to_date}`;
    worksheet.getCell("A2").font = { bold: true, size: 12 };
    worksheet.getCell("A2").alignment = { horizontal: "center" };

    // Add contractor code and contractor name in Row 3
    worksheet.mergeCells(
      `A3:${worksheet.getColumn(3 + dateRange.length + 12).letter}3`,
    );
    worksheet.getCell("A3").value =
      `Contractor: ${attendanceData[0].contractor_id} - ${attendanceData[0].contractor_name}`;
    worksheet.getCell("A3").font = { bold: true, size: 12 };
    worksheet.getCell("A3").alignment = { horizontal: "center" };

    // Add the header row (Row 4)
    const headerRow = [
      "EmpCode",
      "Employee Name",
      "Designation",
      "Department",
      "BusinessUnit",
    ];
    dateRange.forEach((date) => {
      const day = String(date.getDate()).padStart(2, "0"); // Only the day (DD)
      headerRow.push(day); // Just print the day number, e.g., "01", "02"
    });
    /* headerRow.push("Total Punch Days", "Total OT Hours"); */
    headerRow.push(
      "PR",
      "AB",
      "WO",
      "HLD",
      "Paid Leave",
      "Unpaid Leave",
      "OD",
      "Total Payable Days",
      "Total Punch Days",
      "Total OT Hours",
    );

    const header = worksheet.addRow(headerRow);

    // Style the header row (bold and gray background for all columns)
    header.eachCell((cell, colNumber) => {
      cell.style = getHeaderCellStyle();
      if (colNumber === 2) worksheet.getColumn(2).width = 20; // Set reasonable width for Employee Name
      if (colNumber === 3) worksheet.getColumn(3).width = 15; // Set reasonable width for Designation
      if (colNumber === 4) worksheet.getColumn(4).width = 15; // Set reasonable width for Designation
      if (colNumber === 5) worksheet.getColumn(5).width = 15; // Set reasonable width for Designation
    });

    // Add employee attendance data
    Object.keys(employeeAttendance).forEach((empCode) => {
      const employee = employeeAttendance[empCode];
      const attendance = employee.attendance;
      const otMinutes = employee.otMinutes;

      // First row: Punch Mark
      const punchMarkRow = [
        empCode,
        employee.name,
        employee.designation,
        employee.dept_name,
        employee.bu_name,
      ];
      dateRange.forEach((date) => {
        const day = String(date.getDate()).padStart(2, "0");
        punchMarkRow.push(attendance[day] || ""); // Add punch mark for each date
      });

      // ✅ ADD THESE LINES EXACTLY HERE
      const empCategory = Number(employee.emp_category);
      const isCasual = empCategory === 1004;

      const totalPayableDays =
        employee.PR +
        employee.HLD +
        employee.OD +
        employee.PAID +
        (isCasual ? 0 : employee.WO);

      // ✅ REPLACE OLD push() WITH THIS
      punchMarkRow.push(
        employee.PR,
        employee.AB,
        employee.WO,
        employee.HLD,
        employee.PAID,
        employee.UNPAID,
        employee.OD,
        totalPayableDays,
        employee.totalPunchDays,
        convertMinutesToTime(employee.totalOTMinutes),
      );

      /*
      punchMarkRow.push(
        employee.totalPunchDays,
        convertMinutesToTime(employee.totalOTMinutes),
      ); // Add total punch days and OT hours
      */

      worksheet.addRow(punchMarkRow).eachCell((cell, colNumber) => {
        if (colNumber > 3) {
          cell.style = getDataCellStyle(); // Apply center alignment for day columns and totals
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" }; // Left align for EmpCode, Name, Designation
        }
      });

      // Second row: OT Hours
      const otHoursRow = ["", "", "", "", ""]; // Empty cells for EmpCode, Name, Designation
      dateRange.forEach((date) => {
        const day = String(date.getDate()).padStart(2, "0");
        //const otTime = convertMinutesToTime(otMinutes[day] || 0);
        //const otTime = otMinutes[day] / 60 || 0;
        const otTime = otMinutes[day]
          ? Number((otMinutes[day] / 60).toFixed(2))
          : "";
        //otHoursRow.push(otTime !== "00:00" ? otTime : ""); // Only print non-zero OT hours
        otHoursRow.push(otTime); // Only print non-zero OT hours
      });
      //otHoursRow.push("test", "test2"); // No total needed for this row
      //otHoursRow.push("", employee.totalOTMinutes / 60); // Add total punch days and OT hours
      otHoursRow.push("", Number((employee.totalOTMinutes / 60).toFixed(2)));
      worksheet.addRow(otHoursRow).eachCell((cell, colNumber) => {
        if (colNumber > 3) {
          cell.style = getDataCellStyle(); // Apply center alignment for day columns and totals
        }
      });
    });

    // Add vertical totals row for day-wise total punches and OT hours
    const verticalTotalsRow = ["Day-wise Totals", "", "", "", ""];
    verticalTotals.punches.forEach((totalPunch) => {
      verticalTotalsRow.push(totalPunch);
    });
    // verticalTotalsRow.push("", "");
    verticalTotalsRow.push("", "", "", "", "", "", "", "", "", "");
    worksheet.addRow(verticalTotalsRow).eachCell((cell, colNumber) => {
      if (colNumber > 3) {
        cell.style = getTotalCellStyle(); // Apply bold and gray background for totals columns
      }
    });

    const verticalOTHoursRow = ["", "", "", "", ""];
    verticalTotals.otMinutes.forEach((totalOT) => {
      const otTime = convertMinutesToTime(totalOT);
      verticalOTHoursRow.push(otTime !== "00:00" ? otTime : "");
    });
    verticalOTHoursRow.push("", "");
    worksheet.addRow(verticalOTHoursRow).eachCell((cell, colNumber) => {
      if (colNumber > 3) {
        cell.style = getTotalCellStyle(); // Apply bold and gray background for totals columns
      }
    });

    // Repeat rows 1-4 on every printed page
    worksheet.pageSetup.printTitlesRow = "1:4";

    // Save the Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Attendance_${from_date}_to_${to_date}.xlsx`;
    a.click();
  } catch (error) {
    console.error("Error generating the attendance report:", error);
  }
};

export default ExportMnthAtndToXLS;
