import axios from "../api/axios.js";
import ExcelJS from "exceljs";

// Helper function to process "ALL" logic
function processSelection(selection) {
  return selection.includes("ALL") ? [] : selection;
}

// Function to format the date as dd/mm/yyyy
function formatDate(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

const exportWagesToXLS = async ({
  billingType,
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

    const presponse = await axios.post("/api/wages/getProcessMonthDates", {
      billingtype: billingType,
      pmonth: pmonth,
    });

    console.log("Start Date");
    console.log(presponse);

    let start_date, end_date;
    if (presponse.data.length > 0) {
      start_date = presponse.data[0].start_date;
      end_date = presponse.data[0].end_date;
    }

    // Format start_date and end_date if they exist
    const formattedStartDate = start_date ? formatDate(start_date) : "N/A";
    const formattedEndDate = end_date ? formatDate(end_date) : "N/A";

    console.log(formattedEndDate);
    console.log(formattedEndDate);

    const response = await axios.post("/api/wages/getPFStatement", {
      billingType,
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
    console.log("response log:", response);
    // Group data by contractor
    const contractors = {};
    attendanceData.forEach((item) => {
      const contractorId = item.ContractorID;
      if (!contractors[contractorId]) {
        contractors[contractorId] = {
          contractorName: item.ContractorName,
          data: [],
        };
      }
      contractors[contractorId].data.push(item);
    });

    console.log(attendanceData);

    // Create a new Excel workbook
    const workbook = new ExcelJS.Workbook();

    // Define common styles
    const headerStyle = { bold: true, size: 12 };
    const totalStyle = {
      bold: true,
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "CCCCCC" } },
    };
    const borderStyle = { style: "thin", color: { argb: "000000" } };

    // Process each contractor and create separate sheets
    for (const contractorId in contractors) {
      const contractorData = contractors[contractorId].data;
      const contractorName =
        contractors[contractorId].contractorName ||
        `Contractor_${contractorId}`;
      const sheet = workbook.addWorksheet(contractorName);

      // Define columns with adjusted widths and alignment
      const columns = [
        { header: "Company Code", key: "CompanyCode", width: 5 },
        { header: "Company Name", key: "CompanyName", width: 5 },
        { header: "Emp. Code", key: "EmployeeCode", width: 10 },
        { header: "Employee Name", key: "EmployeeName", width: 20 },

        { header: "Adhar Number", key: "AdharNo", width: 20 },
        { header: "Father/Husband Name", key: "FatherHusbandName", width: 20 },
        { header: "Gender", key: "Gender", width: 20 },
        { header: "Date of Joining", key: "Doj", width: 20 },
        { header: "UAN Number", key: "UANNo", width: 20 },
        { header: "Date of Birth", key: "DoB", width: 20 },
        { header: "Age", key: "Age", width: 20 },
        { header: "Date of Resignation", key: "InactiveDate", width: 20 },
        { header: "Last Working Date", key: "InactiveDate", width: 20 },
        { header: "PF Number", key: "PFNo", width: 20 },
        { header: "Days Worked", key: "PaidDays", width: 20 },
        { header: "LOP", key: "LoPDays", width: 20 },
        { header: "Days In Month", key: "WageDays", width: 20 },
        { header: "Gross salary", key: "Gross", width: 20 },
        { header: "PFBASE", key: "PFBase", width: 20 },
        { header: "Pension Base", key: "PensionBase", width: 20 },
        { header: "EDLI Base", key: "EDLIBase", width: 20 }, // give unique key
        { header: "PF Employee", key: "EmpPF", width: 20 },
        { header: "Pension", key: "Pension", width: 20 },
        { header: "PfEmployer", key: "EmployerPF", width: 20 },
        { header: "PF Admin Charges", key: "PFAdminChgs", width: 20 },
        { header: "EDLI Charges", key: "EDLIChgs", width: 20 }, // ✅ correct key
        { header: "VPF", key: "VPF", width: 20 },
        { header: "Total EPF Contribution", key: "TotalEPFContr", width: 20 },
      ];

      sheet.columns = columns;
      // Column headers with right justification and indent
      // Column headers with right justification and indent (added at row 7)
      const headerRowNumber = 1;
      const headerRow = sheet.getRow(headerRowNumber);
      headerRow.values = columns.map((col) => col.header);
      //const headerRow = sheet.addRow(columns.map(col => col.header));
      headerRow.eachCell((cell, colNumber) => {
        cell.font = headerStyle;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "CCCCCC" },
        };
        cell.border = {
          top: borderStyle,
          left: borderStyle,
          bottom: borderStyle,
          right: borderStyle,
        };

        // Apply right alignment with indent for specified columns
        if (colNumber >= 7 && colNumber <= 23) {
          cell.alignment = { horizontal: "right", indent: 1 };
        }
      });

      // Define the starting row for data after header and information rows
      //const startDataRow = sheet.rowCount + 1;
      const startDataRow = 2;

      // Add data rows with right alignment and indent for specified columns
      let serialNumber = 1;
      contractorData.forEach((item) => {
        const row = sheet.addRow({
          CompanyCode: item.ContractorID,
          CompanyName: item.ContractorName,
          EmployeeCode: item.EmployeeCode,
          EmployeeName: item.EmployeeName,
          AdharNo: item.AdharNo,
          FatherHusbandName: item.FatherHusbandName,
          Gender: item.Gender,
          Doj: item.Doj,
          UANNo: item.UANNo,
          DoB: item.DoB,
          Age: item.Age,
          InactiveDate: item.InactiveDate,
          InactiveDate: item.InactiveDate,
          PFNo: item.PFNo,
          PaidDays: item.PaidDays,
          WageDays: item.WageDays,
          LoPDays: item.LoPDays,
          Gross: item.Gross,
          PFBase: item.PFBase,
          PensionBase: item.PensionBase,
          EDLIBase: item.PensionBase,
          EmpPF: item.EmpPF,
          Pension: item.Pension,
          EmployerPF: item.EmployerPF,
          PFAdminChgs: item.PFAdminChgs,
          EDLIChgs: item.EDLIChgs,
          VPF: item.VPF,
          TotalEPFContr: item.TotalEPFContr,
        });
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: borderStyle,
            left: borderStyle,
            bottom: borderStyle,
            right: borderStyle,
          };
          if (colNumber == 6) {
            cell.alignment = { horizontal: "right", indent: 1 };
          }
        });
      });

      // Add total row
      const totalRow = sheet.addRow([
        "",
        "Total",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        { formula: `SUM(P${startDataRow}:$P${sheet.rowCount})` },
        { formula: `SUM(Q${startDataRow}:$Q${sheet.rowCount})` },
        { formula: `SUM(R${startDataRow}:$R${sheet.rowCount})` },
        { formula: `SUM(S${startDataRow}:$S${sheet.rowCount})` },
        { formula: `SUM(T${startDataRow}:$T${sheet.rowCount})` },
        { formula: `SUM(U${startDataRow}:$U${sheet.rowCount})` },
        { formula: `SUM(V${startDataRow}:$V${sheet.rowCount})` },
        { formula: `SUM(W${startDataRow}:$W${sheet.rowCount})` },
        { formula: `SUM(X${startDataRow}:$X${sheet.rowCount})` },
        { formula: `SUM(Y${startDataRow}:$Y${sheet.rowCount})` },
        { formula: `SUM(Z${startDataRow}:$Z${sheet.rowCount})` },
        { formula: `SUM(AA${startDataRow}:$AA${sheet.rowCount})` },
        { formula: `SUM(AB${startDataRow}:$AB${sheet.rowCount})` },
      ]);

      totalRow.eachCell((cell) => {
        cell.font = totalStyle;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "CCCCCC" },
        };
        cell.border = {
          top: borderStyle,
          left: borderStyle,
          bottom: borderStyle,
          right: borderStyle,
        };
        cell.alignment = { horizontal: "right", indent: 1 };
      });
    }

    // Save the workbook
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    //link.download = PFStatement_${pmonth}.xlsx`;
    link.download = `PFStatement_${pmonth}.xlsx`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error exporting the wages report:", error);
  }
};

export default exportWagesToXLS;
