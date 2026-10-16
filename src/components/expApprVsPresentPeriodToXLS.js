import axios from "../api/axios.js";
import ExcelJS from "exceljs";

// ✅ Helper function to format dates as DD/MM/YYYY
function formatDate(dateString) {
  if (!dateString) return "";
  if (typeof dateString === "string") return dateString; // Already formatted
  return new Date(dateString).toLocaleDateString("en-GB"); // Convert to DD/MM/YYYY
}

// ✅ Get Date Range (DD/MM/YYYY format)
function getDateRange(from_date, to_date) {
  const startDate = new Date(from_date);
  const endDate = new Date(to_date);
  const dateList = [];

  while (startDate <= endDate) {
    dateList.push(formatDate(startDate)); // Ensure date matches API response
    startDate.setDate(startDate.getDate() + 1);
  }
  return dateList;
}

const expApprVsPresentPeriodToXLS = async ({ from_date, to_date, emp_type, emp_id, token }) => {
  try {
    console.log("Starting Excel generation...");

    const formattedFromDate = formatDate(from_date);
    const formattedToDate = formatDate(to_date);
    const dateRange = getDateRange(from_date, to_date);

    console.log("Fetching data from API...");
    const response = await axios.post('/api/attendance/getApprVsPresentPeriod', {
      from_date,
      to_date,
      emp_type,
      emp_id,
      token
    });

    const attendanceData = response.data;

    if (!Array.isArray(attendanceData) || attendanceData.length === 0) {
      throw new Error("No data for the selected filters");
    }
    console.log("API Data Received:", attendanceData.length, "records", attendanceData);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("ApprovedVsPresent");

    // ✅ Define styles
    const headerStyle = { bold: true, size: 12, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCCCCC' } } };
    const subtotalStyle = { bold: true, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDDDDD' } } };
    const grandTotalStyle = { bold: true, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'A3C2F3' } } };
    const borderStyle = { style: 'thin', color: { argb: '000000' } };

    // ✅ Define Column Structure
    let dateColumns = dateRange.map(date => ({
      header: date.split('/')[0], // Show only DD
      key: date, // ✅ Ensure column key matches API allocation_date format
      width: 6,
    }));

    const columns = [
      { header: "S. No.", key: "sno", width: 5 },
      { header: "Contractor", key: "contractor_name", width: 20 },
      { header: "BU", key: "bu_name", width: 20 },
      { header: "Department", key: "dept_name", width: 20 },
      { header: "Approval Per Day", key: "approvalDay", width: 12 },
      { header: "Total-Approved", key: "approved_total", width: 12 },
      { header: "Total-Present", key: "total_cnt", width: 12 },
      ...dateColumns, // ✅ Add dynamic date columns
    ];

    sheet.columns = columns;

    // ✅ Merge Title
    const titleCell = sheet.getCell("A1");
    titleCell.value = `MANPOWER STATEMENT - APPROVED VS PRESENT (${formattedFromDate} to ${formattedToDate})`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.mergeCells(`A1:${String.fromCharCode(65 + columns.length - 1)}1`);

    // ✅ Print Headers
    const headerRow = sheet.getRow(3);
    headerRow.values = columns.map(col => col.header);
    headerRow.eachCell(cell => {
      cell.font = headerStyle;
      cell.fill = headerStyle.fill;
      cell.border = borderStyle;
      cell.alignment = { horizontal: 'center', wrapText: true  };
    });

    let serialNumber = 1;
    let processedData = {};

    // ✅ Step 1: Accumulate Data into a Structured Format
    attendanceData.forEach((item) => {
      const key = `${item.contractor_name}|${item.bu_name}|${item.dept_name}`;

      // Initialize Data Row
      if (!processedData[key]) {
        processedData[key] = {
          sno: serialNumber++,
          contractor_name: item.contractor_name,
          bu_name: item.bu_name,
          dept_name: item.dept_name,
          approvalDay:0,
          approved_total: 0,
          total_cnt: 0,
        };
        dateRange.forEach(date => { processedData[key][date] = 0; });
      }

      // Accumulate Totals
      processedData[key].approvalDay = (item.approved_day || 0) + (item.approved_night || 0);
      processedData[key].approved_total += (item.approved_day || 0) + (item.approved_night || 0);
      processedData[key].total_cnt += (item.day_cnt || 0) + (item.night_cnt || 0);

      // Accumulate Date-wise Values
      const allocationDate = formatDate(item.allocation_date);
      if (processedData[key][allocationDate] !== undefined) {
        processedData[key][allocationDate] += (item.day_cnt || 0) + (item.night_cnt || 0);
      }
    });

    // ✅ Step 2 & 3: Print Data, Compute Subtotals, and Grand Totals
    let lastContractor = null;
    let contractorSubtotal = null;
    let grandTotal = {
      contractor_name: "Grand Total",
      bu_name: "",
      dept_name: "",
      approvalDay:0,
      approved_total: 0,
      total_cnt: 0,
    };
    dateRange.forEach(date => { grandTotal[date] = 0; });

    Object.values(processedData).forEach(rowData => {
      if (lastContractor !== rowData.contractor_name) {
        // ✅ Print Previous Contractor Subtotal Before Moving to New One
        if (contractorSubtotal) {
          const subRow = sheet.addRow(contractorSubtotal);
          subRow.eachCell((cell, colNumber) => {
            cell.font = subtotalStyle;
            cell.fill = subtotalStyle.fill;
            cell.border = borderStyle;
            if (colNumber >= 5) {
              cell.alignment = { horizontal: 'right', indent: 1 }; // ✅ Right-align with indent 0.5
            }
          });
        }

        // ✅ Initialize New Contractor Subtotal
        contractorSubtotal = {
          contractor_name: `Subtotal - ${rowData.contractor_name}`,
          bu_name: "",
          dept_name: "",
          approvalDay:0,
          approved_total: 0,
          total_cnt: 0,
        };
        dateRange.forEach(date => { contractorSubtotal[date] = 0; });

        lastContractor = rowData.contractor_name;
      }

      // ✅ Print Data Row
      let row = sheet.addRow(rowData);
      row.eachCell((cell, colNumber) => {
        cell.border = borderStyle;
        if (colNumber >= 5) {
          cell.alignment = { horizontal: 'right', indent: 1 }; // ✅ Right-align with indent 0.5
        }
      });

      // ✅ Accumulate Subtotals & Grand Totals
      contractorSubtotal.approvalDay += rowData.approvalDay;
      contractorSubtotal.approved_total += rowData.approved_total;
      contractorSubtotal.total_cnt += rowData.total_cnt;
      grandTotal.approvalDay += rowData.approvalDay;
      grandTotal.approved_total += rowData.approved_total;
      grandTotal.total_cnt += rowData.total_cnt;

      dateRange.forEach(date => {
        contractorSubtotal[date] += rowData[date];
        grandTotal[date] += rowData[date];
      });
    });

    // ✅ Print Last Contractor Subtotal
    if (contractorSubtotal) {
      const subRow = sheet.addRow(contractorSubtotal);
      subRow.eachCell((cell,colNumber)  => {
        cell.font = subtotalStyle;
        cell.fill = subtotalStyle.fill;
        cell.border = borderStyle;
        if (colNumber >= 5) {
          cell.alignment = { horizontal: 'right', indent: 1 }; // ✅ Right-align with indent 0.5
        }
      });
    }

    // ✅ Print Grand Total Row
    const grandTotalRow = sheet.addRow(grandTotal);
    grandTotalRow.eachCell((cell,colNumber) => {
      cell.font = grandTotalStyle;
      cell.fill = grandTotalStyle.fill;
      cell.border = borderStyle;
      if (colNumber >= 5) {
        cell.alignment = { horizontal: 'right', indent: 1 }; // ✅ Right-align with indent 0.5
      }
  });

    // ✅ Save & Download File
    console.log("Saving Excel file...");
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    // Trigger Download
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Manpower_${formattedFromDate}_to_${formattedToDate}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log("Excel File Downloaded Successfully!");

  } catch (error) {
    console.error("Error exporting the manpower report:", error);
    throw error;
  }
};

export default expApprVsPresentPeriodToXLS;
