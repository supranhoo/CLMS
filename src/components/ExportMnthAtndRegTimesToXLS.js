import ExcelJS from "exceljs";
import axios from "../api/axios.js";

// Helper function to process "ALL" logic
function processSelection(selection) {
  if (selection.includes("ALL")) {
    return selection;
  }
  return selection;
}

// Helper function to calculate date range between two dates
function getDateRange(fromDate, toDate) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const dates = [];

  for (let d = from; d <= to; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d));
  }
  return dates;
}

// Helper functions for punch mark total and time conversions
function calculatePunchMarkTotal(punchMark) {
  if (punchMark === "P") return 1;
  if (punchMark === "P ") return 1;
  if (punchMark === "OD") return 1;
  if (punchMark === "HDP") return 0.5;
  return 0;
}

function convertTimeToMinutes(timeString) {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

function convertMinutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
}

function getHeaderCellStyle() {
  return {
    font: { bold: true, size: 10 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "D3D3D3" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      top: { style: "thin", color: { argb: "000000" } },
      bottom: { style: "thin", color: { argb: "000000" } },
      left: { style: "thin", color: { argb: "000000" } },
      right: { style: "thin", color: { argb: "000000" } },
    },
  };
}

function getDataCellStyle() {
  return {
    font: { size: 10 },
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      top: { style: "dotted", color: { argb: "000000" } },
      bottom: { style: "dotted", color: { argb: "000000" } },
      left: { style: "dotted", color: { argb: "000000" } },
      right: { style: "dotted", color: { argb: "000000" } },
    },
  };
}

function getTotalCellStyle() {
  return {
    font: { bold: true, size: 10 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "D3D3D3" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      top: { style: "thin", color: { argb: "000000" } },
      bottom: { style: "thin", color: { argb: "000000" } },
      left: { style: "thin", color: { argb: "000000" } },
      right: { style: "thin", color: { argb: "000000" } },
    },
  };
}

const formatTime = (dateTimeString) => {
  const [datePart, timePart] = dateTimeString.split("T");
  const timeWithoutSeconds = timePart ? timePart.substring(0, 5) : "00:00";
  return `${timeWithoutSeconds}`;
};

// Excel sheet names: no []:*?/\\, at most 31 characters, unique (case-insensitive) within the workbook
const uniqueSheetName = (name, usedNames) => {
  const base =
    String(name ?? "").replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet";
  let candidate = base;
  let n = 1;
  while (usedNames.has(candidate.toLowerCase())) {
    n += 1;
    const suffix = ` (${n})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
};

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

    console.log(response);
    const attendanceData = response.data;
    if (!Array.isArray(attendanceData) || attendanceData.length === 0) {
      throw new Error("No data for the selected filters");
    }
    console.log("Stage----AA1");
    const dateRange = getDateRange(from_date, to_date);
    console.log("Stage----AA1");

    const groupedData = {};
    console.log("Stage----AA1");
    attendanceData.forEach((item) => {
      if (!groupedData[item.contractor_id]) {
        groupedData[item.contractor_id] = {
          contractorName: item.contractor_name,
          employees: {},
        };
      }
      console.log("Stage----a1a");

      if (!groupedData[item.contractor_id].employees[item.employee_code]) {
        groupedData[item.contractor_id].employees[item.employee_code] = {
          name: item.display_name,
          designation: item.design_name,
          bu_name: item.bu_name,
          dept_name: item.dept_name,
          empType: item.empType,
          shift: {},
          inPunch: {},
          outPunch: {},
          working_hours: {},
          ot_hours: {},
          attendance: {},
          workingMinutes: {},
          otMinutes: {},
          totalPunchDays: 0,
          totalWorkingMinutes: 0,
          totalOTMinutes: 0,
        };
      }
      console.log("Stage----1a");

      const attendanceDate = new Date(item.attendance_date);
      const day = String(attendanceDate.getDate()).padStart(2, "0");

      const employee =
        groupedData[item.contractor_id].employees[item.employee_code];

      if (!employee.shift) employee.shift = {};
      if (!employee.inPunch) employee.inPunch = {};
      if (!employee.outPunch) employee.outPunch = {};
      if (!employee.working_hours) employee.working_hours = {};

      if (!employee.ot_hours) employee.ot_hours = {};
      if (!employee.attendance) employee.attendance = {};
      if (!employee.workingMinutes) employee.workingMinutes = {};
      if (!employee.otMinutes) employee.otMinutes = {};

      employee.shift[day] = item.shift;
      employee.inPunch[day] = item.in_punch ? formatTime(item.in_punch) : null;
      employee.outPunch[day] = item.out_punch
        ? formatTime(item.out_punch)
        : null;
      employee.working_hours[day] = item.working_hours
        ? item.working_hours
        : null;
      employee.ot_hours[day] = item.ot_hours
        ? /^\d{1,2}:\d{2}/.test(String(item.ot_hours))
          ? String(item.ot_hours).slice(0, 5)
          : formatTime(item.ot_hours)
        : null;

      employee.attendance[day] = item.punch_mark || "";

      employee.workingMinutes[day] = convertTimeToMinutes(
        item.working_hours || "00:00"
      );

      employee.otMinutes[day] = convertTimeToMinutes(item.ot_hours || "00:00");

      employee.totalPunchDays += calculatePunchMarkTotal(item.punch_mark);
      employee.totalWorkingMinutes += convertTimeToMinutes(
        item.working_hours || "00:00"
      );

      employee.totalOTMinutes += convertTimeToMinutes(item.ot_hours || "00:00");
    });

    console.log("Stage----2a");

    const workbook = new ExcelJS.Workbook();
    const usedSheetNames = new Set();

    for (const contractorId in groupedData) {
      const { contractorName, employees } = groupedData[contractorId];
      const worksheet = workbook.addWorksheet(
        uniqueSheetName(contractorName, usedSheetNames)
      );

      worksheet.pageSetup.paperSize = 9;
      worksheet.pageSetup.orientation = "landscape";
      worksheet.pageSetup.fitToPage = true;
      worksheet.pageSetup.fitToWidth = 1;

      worksheet.headerFooter.oddFooter = `Page &P of &N`;

      const titleRow = worksheet.addRow([
        `Attendance for Contractor: ${contractorName}`,
      ]);
      worksheet.mergeCells(
        `A1:${worksheet.getColumn(3 + dateRange.length * 6).letter}1`
      );
      titleRow.font = { bold: true, size: 16 };
      titleRow.alignment = { horizontal: "center" };

      worksheet.addRow([]);
      console.log("Stage----3a");

      // Add header row with date headers bu_name,dept_name,empType
      const headerRow = [
        "EmpCode",
        "Employee Name",
        "Designation",
        "Department",
        "BU",
        "Type",
      ];
      console.log("Stage----1");
      dateRange.forEach((date) => {
        const day = String(date.getDate()).padStart(2, "0");
        headerRow.push(day, "", "", "", "", "");
      });
      console.log("Stage----2");
      headerRow.push(
        "Total Punch Days",
        "Total Working Hours",
        "Total OT Hours"
      );

      worksheet.addRow(headerRow).eachCell((cell) => {
        cell.style = getHeaderCellStyle();
      });
      console.log("Stage----3");

      // Add sub-header row for Shift, In Time, Out Time, and Mark
      const subHeaderRow = ["", "", "", "", "", ""];
      dateRange.forEach(() => {
        subHeaderRow.push(
          "Shift",
          "In Time",
          "Out Time",
          "Working Hours",
          "OT Hours",
          "Status"
        );
      });
      subHeaderRow.push("", "");
      worksheet.addRow(subHeaderRow).eachCell((cell) => {
        cell.style = getHeaderCellStyle();
      });

      let currentColumn = 7; // Start from the fourth column (after EmpCode, Name, Designation)
      console.log("Stage----4");
      dateRange.forEach(() => {
        worksheet.mergeCells(3, currentColumn, 3, currentColumn + 5); // Merge cells in row 3 only
        currentColumn += 6; // Move to the next set of columns for the next date
      });
      console.log("Stage----5");

      // Add employee attendance data
      for (const empCode in employees) {
        const employee = employees[empCode];
        const dataRow = [
          empCode,
          employee.name,
          employee.designation,
          employee.dept_name,
          employee.bu_name,
          employee.empType,
        ];
        console.log("Stage----6");

        dateRange.forEach((date) => {
          const day = String(date.getDate()).padStart(2, "0");
          dataRow.push(
            employee.shift[day] || "",
            employee.inPunch[day] || "",
            employee.outPunch[day] || "",
            employee.working_hours[day] || "",

            employee.ot_hours[day] || "",
            employee.attendance[day] || ""
          );
        });
        dataRow.push(
          employee.totalPunchDays,
          convertMinutesToTime(employee.totalWorkingMinutes),
          convertMinutesToTime(employee.totalOTMinutes)
        );
        worksheet.addRow(dataRow).eachCell((cell, colNumber) => {
          cell.style =
            colNumber > 3
              ? getDataCellStyle()
              : { alignment: { horizontal: "left" } };
        });
        console.log("Stage----7");
      }
    }

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
    throw error;
  }
};

export default ExportMnthAtndToXLS;
