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

    const response = await axios.post("/api/wages/getWageRegister", {
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

    if (!Array.isArray(attendanceData) || attendanceData.length === 0) {
      throw new Error("No data for the selected filters");
    }
    console.log(attendanceData);
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
      // Extract distinct Company Names from contractorData
      const distinctCompanyNames = [
        ...new Set(contractorData.map((item) => item.CompanyName)),
      ];

      // Define columns with adjusted widths and alignment
      const columns = [
        { header: "Sno", key: "sno", width: 5 },
        { header: "Emp. Code", key: "EmployeeCode", width: 10 },
        { header: "Employee Name", key: "EmployeeName", width: 20 },
        { header: "Designation", key: "Designation", width: 15 },
        { header: "Secton", key: "Section", width: 20 },
        { header: "Department", key: "Department", width: 20 },
        { header: "BU", key: "BusinessUnit", width: 20 },
        { header: "Loc Name", key: "loc_name", width: 20 },
        { header: "Category", key: "emp_category_name", width: 20 },
        { header: "Cost Center", key: "cost_name", width: 20 },
        { header: "PAN Number", key: "panno", width: 20 },
        { header: "Level", key: "level", width: 20 },
        { header: "Billing Cycle", key: "BillingCycle", width: 20 },
        { header: "Employee Type", key: "empType", width: 20 },
        { header: "Skill Category", key: "skill_category", width: 20 },

        {
          header: "Days",
          key: "Days",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Shift Group",
          key: "ShiftGroup",
          width: 8,
          alignment: { horizontal: "left" },
        },

        {
          header: "PF Applicable",
          key: "PFApplicable",
          width: 8,
          alignment: { horizontal: "center" },
        },
        {
          header: "ESI Applicable",
          key: "ESIApplicable",
          width: 8,
          alignment: { horizontal: "center" },
        },

        {
          header: "OT Hours",
          key: "OTHrs",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "OT Days",
          key: "OTDAYS",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Extra Days",
          key: "ArrearDays",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "OT AR Days",
          key: "OTARDAYS",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Rate",
          key: "BasicRate",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Basic",
          key: "Basic",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "DA Alw",
          key: "DA",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },

        {
          header: "HRA Rate",
          key: "HRART",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "HRA Alw",
          key: "HRA",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Old HRA Rate",
          key: "HRAOLDRT",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Old HRA Alw",
          key: "HRAOLD",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Med ALw Rate",
          key: "MEDIALWRT",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Medical Alw",
          key: "MEDIALW",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },

        {
          header: "Conv ALw Rate",
          key: "CONALWRT",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Conv Alw",
          key: "CONALW",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },

        {
          header: "Other Alw Rate",
          key: "OTHALWRT",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Other Alw",
          key: "OTHALW",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },

        {
          header: "Jaggery",
          key: "Jaggery",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "OT Amt",
          key: "OTAmt",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },

        {
          header: "Ele Refund",
          key: "ELECREFUND",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "ESI Refund",
          key: "ESIREFUND",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "JAGGARY Arrears",
          key: "JAGARREAR",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "PF Refund",
          key: "PFREFUND",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Extra Days Amount",
          key: "EXTRADAYS",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Wage Arrears",
          key: "WAGEARREAR",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "OT Arrear",
          key: "OTARREAR",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Incentive",
          key: "INCENTIVE",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Bonus",
          key: "BONUS",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Gratuity",
          key: "GRATUITY",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Leave Encashment",
          key: "LENCASH",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Production Incentive",
          key: "PRODINCEN",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },

        {
          header: "Gross",
          key: "Gross",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "PF",
          key: "EmpPF",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "ESI",
          key: "EmpESI",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "PTAX",
          key: "PTAX",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Ele Deduction",
          key: "ELEC",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Other Deduction",
          key: "OTHERDED",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },

        {
          header: "Adv.Ded",
          key: "ADVDED",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Canteen Ded",
          key: "CANTDED",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Mess Ded",
          key: "MESDED",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Prod Inc Ded",
          key: "PRDDED",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Safety Ded",
          key: "SAFDED",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },

        {
          header: "Total Deductions",
          key: "TotalDed",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Net Amount",
          key: "NetAmt",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Employer PF",
          key: "EmrPF",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Employer ESI",
          key: "EmrESI",
          width: 8,
          alignment: { horizontal: "right", indent: 1 },
        },

        {
          header: "Training Alw Rate",
          key: "TRALWRT",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Training Alw",
          key: "TRALW",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Uniform Alw Rate",
          key: "UNALWRT",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Uniform Alw",
          key: "UNALW",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Employer Contr",
          key: "EMRCONTR",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Employer Gross",
          key: "EMRGROSS",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Service Chgs Rate",
          key: "SERRT",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Service Chgs Amt",
          key: "SERCHGS",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Earned Bonus Base",
          key: "BONBASE",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Earned Bonus",
          key: "ERNBONUS",
          width: 10,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Earned Leave Days",
          key: "ERNLDYS",
          width: 12,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Earned Gratuity",
          key: "ERNGRAT",
          width: 12,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "Earned Leave Encash",
          key: "ERNLVENC",
          width: 14,
          alignment: { horizontal: "right", indent: 1 },
        },
        {
          header: "CTC KR",
          key: "CTCKR",
          width: 12,
          alignment: { horizontal: "right", indent: 1 },
        },
      ];

      sheet.columns = columns;
      // Column headers with right justification and indent
      // Column headers with right justification and indent (added at row 7)
      const headerRowNumber = 9;
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
        if (colNumber >= 7 && colNumber <= 26) {
          cell.alignment = { horizontal: "right", indent: 1 };
        }
      });

      // Define the starting row for data after header and information rows
      //const startDataRow = sheet.rowCount + 1;
      const startDataRow = 10;

      // Add data rows with right alignment and indent for specified columns
      let serialNumber = 1;
      contractorData.forEach((item) => {
        const row = sheet.addRow({
          sno: serialNumber++,
          EmployeeCode: item.EmployeeCode,
          EmployeeName: item.EmployeeName,
          Designation: item.Designation,
          Section: item.Section,
          Department: item.Department,
          BusinessUnit: item.BusinessUnit,

          loc_name: item.loc_name,
          emp_category_name: item.emp_category_name,
          cost_name: item.cost_name,
          panno: item.panno,
          level: item.level,

          BillingCycle: item.BillingCycle,
          empType: item.empType,
          skill_category: item.skill_category,

          Days: item.Days,
          PFApplicable: item.PFApplicable,
          ESIApplicable: item.ESIApplicable,
          ShiftGroup: item.ShiftGroup,
          OTHrs: item.OTHrs,
          ArrearDays: item.ArrearDays,
          BasicRate: item.BasicRate,
          Basic: item.Basic,
          DA: item.DA,
          HRART: item.HRART,
          HRA: item.HRA,
          HRAOLDRT: item.HRAOLDRT,
          HRAOLD: item.HRAOLD,
          MEDIALWRT: item.MEDIALWRT,
          MEDIALW: item.MEDIALW,
          CONALWRT: item.CONALWRT,
          CONALW: item.CONALW,
          OTHALWRT: item.OTHALWRT,
          OTHALW: item.OTHALW,
          Jaggery: item.Jaggery,
          OTAmt: item.OTAmt,
          ELECREFUND: item.ELECREFUND,
          ESIREFUND: item.ESIREFUND,
          JAGARREAR: item.JAGARREAR,
          PFREFUND: item.PFREFUND,
          EXTRADAYS: item.EXTRADAYS,
          WAGEARREAR: item.WAGEARREAR,
          BONUS: item.BONUS,
          GRATUITY: item.GRATUITY,
          LENCASH: item.LENCASH,
          PRODINCEN: item.PRODINCEN,
          Gross: item.Gross,
          EmpPF: item.EmpPF,
          EmpESI: item.EmpESI,
          PTAX: item.PTAX,
          ELEC: item.ELEC,
          OTHERDED: item.OTHERDED,
          ADVDED: item.ADVDED,
          CANTDED: item.CANTDED,
          MESDED: item.MESDED,
          PRDDED: item.PRDDED,
          SAFDED: item.SAFDED,
          TotalDed: item.TotalDed,
          NetAmt: item.NetAmt,
          EmrPF: item.EmrPF,
          EmrESI: item.EmrESI,

          TRALWRT: item.TRALWRT,
          TRALW: item.TRALW,
          UNALWRT: item.UNALWRT,
          UNALW: item.UNALW,
          EMRCONTR: item.EMRCONTR,
          EMRGROSS: item.EMRGROSS,
          SERRT: item.SERRT,
          SERCHGS: item.SERCHGS,
          OTARREAR: item.OTARREAR,
          OTDAYS: item.OTDAYS,
          OTARDAYS: item.OTARDAYS,
          INCENTIVE: item.INCENTIVE,
          BONBASE: item.BONBASE,
          ERNBONUS: item.ERNBONUS,
          ERNLDYS: item.ERNLDYS,
          ERNGRAT: item.ERNGRAT,
          ERNLVENC: item.ERNLVENC,
          CTCKR: item.CTCKR,
        });
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: borderStyle,
            left: borderStyle,
            bottom: borderStyle,
            right: borderStyle,
          };
          if (colNumber >= 7 && colNumber <= 31) {
            cell.alignment = { horizontal: "right", indent: 1 };
          }
        });
      });

      // Add total row
      const totalRow = sheet.addRow([
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
        "",
        { formula: `SUM(M${startDataRow}:$M${sheet.rowCount})` },
        "",
        "",
        "",
        { formula: `SUM(T${startDataRow}:T${sheet.rowCount})` },
        { formula: `SUM(U${startDataRow}:U${sheet.rowCount})` },
        { formula: `SUM(V${startDataRow}:V${sheet.rowCount})` },
        { formula: `SUM(W${startDataRow}:W${sheet.rowCount})` },
        { formula: `SUM(X${startDataRow}:X${sheet.rowCount})` },
        { formula: `SUM(Y${startDataRow}:Y${sheet.rowCount})` },
        { formula: `SUM(Z${startDataRow}:Z${sheet.rowCount})` },
        { formula: `SUM(AA${startDataRow}:AA${sheet.rowCount})` },
        { formula: `SUM(AB${startDataRow}:AB${sheet.rowCount})` },
        { formula: `SUM(AC${startDataRow}:AC${sheet.rowCount})` },
        { formula: `SUM(AD${startDataRow}:AD${sheet.rowCount})` },
        { formula: `SUM(AE${startDataRow}:AE${sheet.rowCount})` },
        { formula: `SUM(AF${startDataRow}:AF${sheet.rowCount})` },

        { formula: `SUM(AG${startDataRow}:AG${sheet.rowCount})` },
        { formula: `SUM(AH${startDataRow}:AH${sheet.rowCount})` },
        { formula: `SUM(AI${startDataRow}:AI${sheet.rowCount})` },
        { formula: `SUM(AJ${startDataRow}:AJ${sheet.rowCount})` },
        { formula: `SUM(AK${startDataRow}:AK${sheet.rowCount})` },
        { formula: `SUM(AL${startDataRow}:AL${sheet.rowCount})` },
        { formula: `SUM(AM${startDataRow}:AM${sheet.rowCount})` },
        { formula: `SUM(AN${startDataRow}:AN${sheet.rowCount})` },
        { formula: `SUM(AO${startDataRow}:AO${sheet.rowCount})` },
        { formula: `SUM(AP${startDataRow}:AP${sheet.rowCount})` },
        { formula: `SUM(AQ${startDataRow}:AQ${sheet.rowCount})` },
        { formula: `SUM(AR${startDataRow}:AR${sheet.rowCount})` },

        { formula: `SUM(AS${startDataRow}:AS${sheet.rowCount})` },
        { formula: `SUM(AT${startDataRow}:AT${sheet.rowCount})` },
        { formula: `SUM(AU${startDataRow}:AU${sheet.rowCount})` },
        { formula: `SUM(AV${startDataRow}:AV${sheet.rowCount})` },
        { formula: `SUM(AW${startDataRow}:AW${sheet.rowCount})` },

        { formula: `SUM(AX${startDataRow}:AX${sheet.rowCount})` },
        { formula: `SUM(AY${startDataRow}:AY${sheet.rowCount})` },
        { formula: `SUM(AZ${startDataRow}:AZ${sheet.rowCount})` },
        { formula: `SUM(BA${startDataRow}:BA${sheet.rowCount})` },
        { formula: `SUM(BB${startDataRow}:BB${sheet.rowCount})` },
        { formula: `SUM(BC${startDataRow}:BC${sheet.rowCount})` },
        { formula: `SUM(BD${startDataRow}:BD${sheet.rowCount})` },
        { formula: `SUM(BE${startDataRow}:BE${sheet.rowCount})` },
        { formula: `SUM(BF${startDataRow}:BF${sheet.rowCount})` },
        { formula: `SUM(BG${startDataRow}:BG${sheet.rowCount})` },
        { formula: `SUM(BH${startDataRow}:BH${sheet.rowCount})` },
        { formula: `SUM(BI${startDataRow}:BI${sheet.rowCount})` },
        { formula: `SUM(BJ${startDataRow}:BJ${sheet.rowCount})` },
        { formula: `SUM(BK${startDataRow}:BK${sheet.rowCount})` },
        { formula: `SUM(BL${startDataRow}:BL${sheet.rowCount})` },
        { formula: `SUM(BM${startDataRow}:BM${sheet.rowCount})` },
        { formula: `SUM(BN${startDataRow}:BN${sheet.rowCount})` },
        { formula: `SUM(BO${startDataRow}:BO${sheet.rowCount})` },
        { formula: `SUM(BP${startDataRow}:BP${sheet.rowCount})` },
        { formula: `SUM(BQ${startDataRow}:BQ${sheet.rowCount})` },
        { formula: `SUM(BR${startDataRow}:BR${sheet.rowCount})` },
        { formula: `SUM(BS${startDataRow}:BS${sheet.rowCount})` },
        { formula: `SUM(BT${startDataRow}:BT${sheet.rowCount})` },
        { formula: `SUM(BU${startDataRow}:BU${sheet.rowCount})` },

        { formula: `SUM(BV${startDataRow}:BV${sheet.rowCount})` },
        { formula: `SUM(BW${startDataRow}:BW${sheet.rowCount})` },
        { formula: `SUM(BX${startDataRow}:BX${sheet.rowCount})` },
        { formula: `SUM(BY${startDataRow}:BY${sheet.rowCount})` },
        { formula: `SUM(BZ${startDataRow}:BZ${sheet.rowCount})` },
        { formula: `SUM(CA${startDataRow}:CA${sheet.rowCount})` },
        { formula: `SUM(CB${startDataRow}:CB${sheet.rowCount})` },
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

      /*
      // Manually calculate totals for each column and delete columns with zero totals
      const totalValues = Array(sheet.columnCount).fill(0);
      for (let i = 7; i <= sheet.columnCount; i++) { // Start from 7 to skip non-numeric columns
        let total = 0;
        for (let j = startDataRow; j < sheet.rowCount; j++) {
          const cellValue = sheet.getCell(j, i).value;
          if (typeof cellValue === 'number') {
            total += cellValue;
          }
        }
        totalValues[i - 1] = total;
      }

      // Delete columns where the total is zero
      for (let i = totalValues.length - 1; i >= 7; i--) { // Traverse in reverse to avoid index shifting
        if (totalValues[i] === 0) {
          sheet.spliceColumns(i + 1, 1);
        }
      }
*/
      //moved header row to here as deletion of merged cells will creatig issue above
      // Header rows setup
      sheet.mergeCells("A1:CB1");
      const headerCell1 = sheet.getCell("A1");
      headerCell1.value = "FORM XVII";
      headerCell1.alignment = { horizontal: "center", vertical: "middle" };
      headerCell1.font = { bold: true, size: 12 };

      sheet.mergeCells("A2:CB2");
      const headerCell2 = sheet.getCell("A2");
      headerCell2.value = "1[See rule 78 (1) (a) (i)]";
      headerCell2.alignment = { horizontal: "center", vertical: "middle" };

      sheet.mergeCells("A3:CB3");
      const headerCell3 = sheet.getCell("A3");
      headerCell3.value = "Register of Wages";
      headerCell3.alignment = { horizontal: "center", vertical: "middle" };
      headerCell3.font = { bold: true };

      // Join distinct company names into a single string
      let companyNamesString = distinctCompanyNames.join(", ");

      // Contractor information rows
      const contractorInfo = [
        `Name and address of contractor:  - ${contractorName}`, // Display Contractor ID and Name
        "Name and address of establishment in/under which contract is carried on",
        "Nature and location of work",
        `Name and address of principal employer: ${companyNamesString}`,
        `Wage period: From ${formattedStartDate}  To ${formattedEndDate}`, // Print start and end dates
      ];

      contractorInfo.forEach((text, index) => {
        sheet.mergeCells(`A${index + 4}:R${index + 4}`);
        const cell = sheet.getCell(`A${index + 4}`);
        cell.value = text;
        cell.alignment = { horizontal: "left", vertical: "middle" };
      });

      // Add distinct company names in a column
      //headerRowNumber = 8;
      //distinctCompanyNames.forEach((companyName, index) => {
      //sheet.getCell(`A${8 + 1 + index}`).value = companyName; });
    }

    // Save the workbook
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Wages_Register_${pmonth}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error exporting the wages report:", error);
    throw error;
  }
};

export default exportWagesToXLS;
