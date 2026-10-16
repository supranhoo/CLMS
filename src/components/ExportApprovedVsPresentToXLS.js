import axios from "../api/axios.js";
import ExcelJS from "exceljs";

// Helper function to process "ALL" logic
function processSelection(selection) {
  return selection.includes('ALL') ? [] : selection;
}

// Function to format the date as dd/mm/yyyy
function formatDate(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Function to apply styles
function applyStyles(cell, style) {
  cell.font = style.font || {};
  cell.fill = style.fill || {};
  cell.border = style.border || {};
  cell.alignment = style.alignment || {};
}

const exportApprovedVsPresentToXLS = async ({ from_date,emp_type, emp_id, token }) => {
  try {
    const response = await axios.post('/api/attendance/getApprVsPresent', {
      from_date,
      emp_type,
      emp_id,
      token
    });

    const attendanceData = response.data;

    if (!Array.isArray(attendanceData) || attendanceData.length === 0) {
      throw new Error("No data for the selected filters");
    }

    // Group data by entity and contractor
    const groupedData = attendanceData.reduce((acc, item) => {
      if (!acc[item.entity_name]) acc[item.entity_name] = {};
      if (!acc[item.entity_name][item.contractor_name]) acc[item.entity_name][item.contractor_name] = [];
      acc[item.entity_name][item.contractor_name].push(item);
      return acc;
    }, {});

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("ApprovedVsPresent");

    // Define common styles
    const headerStyle = { font: { bold: true, size: 12 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCCCCC' } } };
    const dataRowStyle = {
      border: {
        top: { style: 'thin', color: { argb: '000000' } },
        left: { style: 'thin', color: { argb: '000000' } },
        bottom: { style: 'thin', color: { argb: '000000' } },
        right: { style: 'thin', color: { argb: '000000' } },
      },
      fill: undefined,
    };
    const totalRowStyle = {
      border: {
        top: { style: 'thin', color: { argb: '000000' } },
        left: { style: 'thin', color: { argb: '000000' } },
        bottom: { style: 'thin', color: { argb: '000000' } },
        right: { style: 'thin', color: { argb: '000000' } },
      },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEEEEE' } },
      font: { bold: true },
    };
    const borderStyle = { style: 'thin', color: { argb: '000000' } };
    // Define columns
    const columns = [
      { header: "Sno", key: "sno", width: 5 },
      { header: "Company Name", key: "CompanyName", width: 20 },
      { header: "Contractor", key: "contractorName", width: 20 },
      { header: "BU", key: "BusinessUnit", width: 20 },
      { header: "Department", key: "Department", width: 20 },
      { header: "Day-Approved", key: "DayApproved", width: 15 },
      { header: "Night-Approved", key: "NightApproved", width: 15 },
      { header: "Total-Approved", key: "TotalApproved", width: 15 },
      { header: "Day-Present", key: "DayPresent", width: 15 },
      { header: "Night-Present", key: "NightPresent", width: 15 },
      { header: "Total-Present", key: "TotalPresent", width: 15 },
    ];
    sheet.columns = columns;

    // Header rows setup
    const headerRowNumber = 4;
    const headerRow = sheet.getRow(headerRowNumber);
    headerRow.values = columns.map(col => col.header);
    headerRow.eachCell(cell => {
      cell.font = headerStyle.font;
      cell.fill = headerStyle.fill;
    });

    let currentRow = headerRowNumber + 1;
    let serialNumber = 1;

    const grandTotalRows = []; // Track data rows for this entity


    // Add data grouped by entity and contractor
    Object.entries(groupedData).forEach(([entityName, contractors]) => {
      sheet.addRow([`Entity: ${entityName}`]).font = { bold: true };
      currentRow++;

      const entityDataRows = []; // Track data rows for this entity
      Object.entries(contractors).forEach(([contractorName, records]) => {
        sheet.addRow([`  Contractor: ${contractorName}`]).font = { italic: true };
        currentRow++;

        const contractorDataRows = []; // Track data rows for this contractor

        records.forEach(item => {
          const row = sheet.addRow({
            sno: serialNumber++,
            CompanyName: item.entity_name,
            contractorName: item.contractor_name,
            BusinessUnit: item.bu_name,
            Department: item.dept_name,
            DayApproved: item.approved_day,
            NightApproved: item.approved_night,
            TotalApproved: item.approved_total,
            DayPresent: item.day_cnt,
            NightPresent: item.night_cnt,
            TotalPresent: item.total_cnt,
          });

          row.eachCell((cell, colNumber) => {
            cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
            if (colNumber >= 6 && colNumber <= 11) {
              cell.alignment = { horizontal: 'right', indent: 1 };
            }
          });
    
          contractorDataRows.push(currentRow); // Track row number
          entityDataRows.push(currentRow); // Add to entity rows
          grandTotalRows.push(currentRow); // Add to entity rows
          row.eachCell((cell, colNumber) => {
            cell.font = { bold: false };
            cell.border = dataRowStyle.border;
            if (colNumber >= 6 && colNumber <= 11) {
              cell.alignment = { horizontal: 'right', indent: 1 };
            }
          });
          currentRow++;
        });

        // Add contractor subtotal row
        const contractorSubtotalRow = sheet.addRow([
          '', 'Contractor Subtotal', '', '', '',
          { formula: contractorDataRows.map(row => `F${row}`).join('+') },
          { formula: contractorDataRows.map(row => `G${row}`).join('+') },
          { formula: contractorDataRows.map(row => `H${row}`).join('+') },
          { formula: contractorDataRows.map(row => `I${row}`).join('+') },
          { formula: contractorDataRows.map(row => `J${row}`).join('+') },
          { formula: contractorDataRows.map(row => `K${row}`).join('+') },
        ]);
        contractorSubtotalRow.eachCell((cell,colNumber) => {
          cell.font = totalRowStyle.font;
          cell.fill = totalRowStyle.fill;
          cell.border = totalRowStyle.border;
          if (colNumber >= 6 && colNumber <= 11) {
            cell.alignment = { horizontal: 'right', indent: 1 };
          }
      });
        currentRow++;
      });

      // Add entity subtotal row
      const entitySubtotalRow = sheet.addRow([
        '', 'Entity Subtotal', '', '', '',
        { formula: entityDataRows.map(row => `F${row}`).join('+') },
        { formula: entityDataRows.map(row => `G${row}`).join('+') },
        { formula: entityDataRows.map(row => `H${row}`).join('+') },
        { formula: entityDataRows.map(row => `I${row}`).join('+') },
        { formula: entityDataRows.map(row => `J${row}`).join('+') },
        { formula: entityDataRows.map(row => `K${row}`).join('+') },
      ]);
      entitySubtotalRow.eachCell( (cell,colNumber) => {
        cell.font = totalRowStyle.font;
        cell.fill = totalRowStyle.fill;
        cell.border = totalRowStyle.border;
        if (colNumber >= 6 && colNumber <= 11) {
          cell.alignment = { horizontal: 'right', indent: 1 };
        }
      });
      currentRow++;
    
    });

    //moved header row to here as deletion of merged cells will creatig issue above
    // Header rows setup
    sheet.mergeCells('A1:K1');
    const headerCell1 = sheet.getCell('A1');
    headerCell1.value = 'MANPOWER STATEMENT - APPROVED VS PRESENT ';
    headerCell1.alignment = { horizontal: 'center', vertical: 'middle' };
    headerCell1.font = { bold: true, size: 12 };

    sheet.mergeCells('A2:K2');
    const headerCell2 = sheet.getCell('A2');
    headerCell2.value = `DATE : ${from_date}` ;
    headerCell2.alignment = { horizontal: 'center', vertical: 'middle' };
    headerCell2.font = { bold: true, size: 12 };

    sheet.mergeCells('A3:K3');
    const headerCell3 = sheet.getCell('A3');
    headerCell3.value = '';
    headerCell3.alignment = { horizontal: 'center', vertical: 'middle' };

    // Add entity subtotal row
    const grandTotalRow = sheet.addRow([
      '', 'Grand Total', '', '', '',
      { formula: grandTotalRows.map(row => `F${row}`).join('+') },
      { formula: grandTotalRows.map(row => `G${row}`).join('+') },
      { formula: grandTotalRows.map(row => `H${row}`).join('+') },
      { formula: grandTotalRows.map(row => `I${row}`).join('+') },
      { formula: grandTotalRows.map(row => `J${row}`).join('+') },
      { formula: grandTotalRows.map(row => `K${row}`).join('+') },
    ]);
    grandTotalRow.eachCell( (cell, colNumber) => {
      cell.font = totalRowStyle.font;
      cell.fill = totalRowStyle.fill;
      cell.border = totalRowStyle.border;
      if (colNumber >= 6 && colNumber <= 11) {
        cell.alignment = { horizontal: 'right', indent: 1 };
      }
    });
    currentRow++;
  

    // Save the workbook
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Manpower_${from_date}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error exporting the manpower report:", error);
    throw error;
  }
};

export default exportApprovedVsPresentToXLS;
