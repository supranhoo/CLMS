import axios from "../api/axios.js";
import ExcelJS from "exceljs";

const exportWageComparissionToXLS = async ({ billingType, prv_pmonth, cur_pmonth, entity, emp_id, token }) => {
  try {
    console.log("billingType:", billingType);

    // Fetch start_date and end_date for the previous month
    const response1  = await axios.post('/api/wages/getProcessMonthDates', {
      billingtype: billingType,
      pmonth: prv_pmonth,
    });

    const prevMonthDates = response1.data[0];
    console.log("Dates:", prevMonthDates);

    // Fetch start_date and end_date for the current month
    const response2 = await axios.post('/api/wages/getProcessMonthDates', {
      billingtype: billingType,
      pmonth: cur_pmonth,
    });
    
    const curMonthDates = response2.data[0];
  
    // Fetch start_date and end_date for the current month
    const response3 = await axios.post('/api/entity/getEntityName', {
      entity_code: entity,
    });
    
    console.log("ENTITY:", response3);
    const entityData = response3.data[0];

    // Fetch wage comparison data
    const response = await axios.post('/api/wages/getWageComparision', {
      billingType,
      cur_pmonth,
      prv_pmonth,
      entity,
      emp_id,
      token,
    });

    const attendanceData = response.data;

    if (!Array.isArray(attendanceData) || attendanceData.length === 0) {
      throw new Error("No data for the selected filters");
    }

    // Group data by contractor using "Contractor" field
    const contractors = {};
    attendanceData.forEach((item) => {
      const contractorName = item.Contractor;
      if (!contractors[contractorName]) {
        contractors[contractorName] = {
          contractorName,
          data: [],
        };
      }
      contractors[contractorName].data.push(item);
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('WageComparission');

    // Define common styles
    const headerStyle = { bold: true, size: 12 };
    const subHeaderStyle = { bold: true, size: 10 };
    const totalStyle = { bold: true, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } } };
    const borderStyle = { style: 'thin', color: { argb: '000000' } };
    const rightAlignment = { horizontal: 'right', indent: 1 };

    // Define columns
    const columns = [
      { header: "Contractor", key: "Contractor", width: 20 },
      { header: "Business Unit", key: "BU", width: 20 },
      { header: "Total Days (Prev)", key: "PrevTotalDays", width: 12 },
      { header: "Net Amount (Prev)", key: "PrevNetWages", width: 12 },
      { header: "Commission (Prev)", key: "PrevCommission", width: 12 },
      { header: "Cheque Amount (Prev)", key: "PrevChequeAmount", width: 12 },
      { header: "Total Days (Cur)", key: "CurTotalDays", width: 12 },
      { header: "Net Amount (Cur)", key: "CurNetWages", width: 12 },
      { header: "Commission (Cur)", key: "CurCommission", width: 12 },
      { header: "Cheque Amount (Cur)", key: "CurChequeAmount", width: 12 },
    ];
    sheet.columns = columns;

    // Add main heading
    sheet.mergeCells('A1:J1');
    const mainHeading0 = sheet.getCell('A1');
    mainHeading0.value = entityData.entity_name;
    mainHeading0.alignment = { horizontal: 'center', vertical: 'middle' };
    mainHeading0.font = { bold: true, size: 14 };

    sheet.mergeCells('A2:J2');
    const mainHeading = sheet.getCell('A2');
    mainHeading.value = "Wages Comparission Statement";
    mainHeading.alignment = { horizontal: 'center', vertical: 'middle' };
    mainHeading.font = { bold: true, size: 14 };

    // Add second heading row with start_date and end_date for previous and current months
    sheet.mergeCells('A3:B3');
    sheet.mergeCells('C3:F3');
    sheet.mergeCells('G3:J3');
    const secondHeadingRow = sheet.getRow(3);
    secondHeadingRow.getCell('A').value = "Contractor / BU";
    secondHeadingRow.getCell('C').value = `Previous Month (${prevMonthDates.formatedStartDate} - ${prevMonthDates.formatedEndDate})`;
    secondHeadingRow.getCell('G').value = `Current Month (${curMonthDates.formatedStartDate} - ${curMonthDates.formatedEndDate})`;
    secondHeadingRow.eachCell((cell) => {
      cell.font = subHeaderStyle;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
    });

    // Add column headers
    const headerRow = sheet.getRow(4);
    headerRow.values = columns.map((col) => col.header);
    headerRow.font = headerStyle;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCCCCC' } };
      cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    let currentRow = 4;
    let grandTotals = {
      PrevTotalDays: 0,
      PrevNetWages: 0,
      PrevCommission: 0,
      PrevChequeAmount: 0,
      CurTotalDays: 0,
      CurNetWages: 0,
      CurCommission: 0,
      CurChequeAmount: 0,
    };

    // Process each contractor
    for (const contractorName in contractors) {
      const contractorData = contractors[contractorName].data;

      let contractorTotals = {
        PrevTotalDays: 0,
        PrevNetWages: 0,
        PrevCommission: 0,
        PrevChequeAmount: 0,
        CurTotalDays: 0,
        CurNetWages: 0,
        CurCommission: 0,
        CurChequeAmount: 0,
      };

      let isFirstRow = true;

      // Add rows for each BU under the contractor
      contractorData.forEach((item) => {
        sheet.addRow({
          Contractor: isFirstRow ? contractorName : '', // Print contractor name only in the first row
          BU: item.BU,
          PrevTotalDays: item.PrevTotalDays,
          PrevNetWages: item.PrevNetWages,
          PrevCommission: item.PrevCommission,
          PrevChequeAmount: item.PrevChequeAmount,
          CurTotalDays: item.CurTotalDays,
          CurNetWages: item.CurNetWages,
          CurCommission: item.CurCommission,
          CurChequeAmount: item.CurChequeAmount,
        }).eachCell((cell, colNumber) => {
          cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };

          // Apply right alignment and formatting for C to J
          if (colNumber >= 3 && colNumber <= 10) {
            cell.alignment = rightAlignment;

            // Apply number format for Total Days columns
            if (colNumber === 3 || colNumber === 7) {
              //cell.numFmt = '00000.00'; // Format as 00000.00
              cell.numFmt = '##,##0.00';
            }
          }
        });

        isFirstRow = false; // Only the first row for each contractor gets the name

        // Update contractor totals
        contractorTotals.PrevTotalDays += item.PrevTotalDays;
        contractorTotals.PrevNetWages += item.PrevNetWages;
        contractorTotals.PrevCommission += item.PrevCommission;
        contractorTotals.PrevChequeAmount += item.PrevChequeAmount;
        contractorTotals.CurTotalDays += item.CurTotalDays;
        contractorTotals.CurNetWages += item.CurNetWages;
        contractorTotals.CurCommission += item.CurCommission;
        contractorTotals.CurChequeAmount += item.CurChequeAmount;

        currentRow++;
      });

      // Add contractor totals row
      const contractorTotalRow = sheet.addRow([
        contractorName, 'Contractor Total',
        contractorTotals.PrevTotalDays,
        contractorTotals.PrevNetWages,
        contractorTotals.PrevCommission,
        contractorTotals.PrevChequeAmount,
        contractorTotals.CurTotalDays,
        contractorTotals.CurNetWages,
        contractorTotals.CurCommission,
        contractorTotals.CurChequeAmount,
      ]);
      contractorTotalRow.font = totalStyle;
      contractorTotalRow.eachCell((cell, colNumber) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCCCCC' } };
        cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };

        // Apply alignment and number formatting for C to J
        if (colNumber >= 3 && colNumber <= 10) {
          cell.alignment = rightAlignment;
          if (colNumber === 3 || colNumber === 7) {
            //cell.numFmt = '00000.00'; // Format as 00000.00
            cell.numFmt = '##,##0.00';
          }
        }
      });

      // Update grand totals
      Object.keys(grandTotals).forEach((key) => {
        grandTotals[key] += contractorTotals[key];
      });

      currentRow++;
    }

    // Add grand totals row
    const grandTotalRow = sheet.addRow([
      'Grand Total', '',
      grandTotals.PrevTotalDays,
      grandTotals.PrevNetWages,
      grandTotals.PrevCommission,
      grandTotals.PrevChequeAmount,
      grandTotals.CurTotalDays,
      grandTotals.CurNetWages,
      grandTotals.CurCommission,
      grandTotals.CurChequeAmount,
    ]);
    grandTotalRow.font = totalStyle;
    grandTotalRow.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCCCCC' } };
      cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };

      // Apply alignment and number formatting for C to J
      if (colNumber >= 3 && colNumber <= 10) {
        cell.alignment = rightAlignment;
        if (colNumber === 3 || colNumber === 7) {
          //cell.numFmt = '00000.00'; // Format as 00000.00
          cell.numFmt = '##,##0.00';
        }
      }
    });

    // Save the workbook
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `wagecomparission.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error exporting the wages report:", error);
    throw error;
  }
};

export default exportWageComparissionToXLS;
