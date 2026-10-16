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

const convertNumberToWords = (num) => {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
    'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if ((num = num.toString()).length > 9) return 'Overflow';

  const n = ('000000000' + num)
    .substr(-9)
    .match(/^(\d{2})(\d{2})(\d{2})(\d{3})$/);
  if (!n) return;

  let str = '';
  str += n[1] !== '00' ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + ' Crore ' : '';
  str += n[2] !== '00' ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + ' Lakh ' : '';
  str += n[3] !== '00' ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + ' Thousand ' : '';
  str += n[4][0] !== '0' ? a[Number(n[4][0])] + ' Hundred ' : '';
  str += n[4].substr(1) !== '00' ? (a[Number(n[4].substr(1))] || b[n[4][1]] + ' ' + a[n[4][2]]) : '';

  return `Rupees ${str.trim()} Only`;
};


const exportWagesToXLS = async ({ billingType,pmonth, contractor, bu, entity, department, emp_type, emp_id, token }) => {
  try {
    const selectedContractor = processSelection(contractor);
    const selectedBU = processSelection(bu);
    const selectedEntity = processSelection(entity);
    const selectedDepartment = processSelection(department);

    const presponse = await axios.post('/api/wages/getProcessMonthDates', {
      billingtype:billingType,
      pmonth:pmonth
    });

    console.log("Start Date");
    console.log(presponse);

    let start_date, end_date;
    if (presponse.data.length > 0) {
      start_date = presponse.data[0].formatedStartDate;
      end_date = presponse.data[0].formatedEndDate;
    }

    // Format start_date and end_date if they exist
    const formattedStartDate = start_date ? formatDate(start_date) : "N/A";
    const formattedEndDate = end_date ? formatDate(end_date) : "N/A";

    console.log(formattedEndDate);
    console.log(formattedEndDate);
  

    const response = await axios.post('/api/wages/getCashStatement', {
      billingType,
      pmonth,
      contractor: selectedContractor.length ? selectedContractor : null,
      bu: selectedBU.length ? selectedBU : null,
      entity: selectedEntity.length ? selectedEntity : null,
      department: selectedDepartment.length ? selectedDepartment : null,
      emp_type,
      emp_id,
      token
    });

    const attendanceData = response.data;

    if (!Array.isArray(attendanceData) || attendanceData.length === 0) {
      throw new Error("No data for the selected filters");
    }

    // Group data by contractor
    const contractors = {};
    attendanceData.forEach((item) => {
      const contractorId = item.ContractorID;
      if (!contractors[contractorId]) {
        contractors[contractorId] = {
          contractorName: item.ContractorName,
          data: []
        };
      }
      contractors[contractorId].data.push(item);
    });

    console.log(attendanceData);

    // Create a new Excel workbook
    const workbook = new ExcelJS.Workbook();

    // Define common styles
    const headerStyle = { bold: true, size: 12 };
    const totalStyle = { bold: true, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCCCCC' } } };
    const borderStyle = { style: 'thin', color: { argb: '000000' } };

    // Process each contractor and create separate sheets
    for (const contractorId in contractors) {
      const contractorData = contractors[contractorId].data;
      const contractorName = contractors[contractorId].contractorName || `Contractor_${contractorId}`;
      const sheet = workbook.addWorksheet(contractorName);

      // Define columns with adjusted widths and alignment
      const columns = [
        { header: "Sno", key: "sno", width: 5 },
        { header: "Emp. Code", key: "EmployeeCode", width: 10 },
        { header: "Employee Name", key: "EmployeeName", width: 20 },
        { header: "Net Amount", key: "NetAmt", width: 10, alignment: { horizontal: 'right', indent: 1 } }
      ];

      sheet.columns = columns;
      // Column headers with right justification and indent
      // Column headers with right justification and indent (added at row 7)
      const headerRowNumber = 3;
      const headerRow = sheet.getRow(headerRowNumber);
      headerRow.values = columns.map(col => col.header);
      //const headerRow = sheet.addRow(columns.map(col => col.header));
      headerRow.eachCell((cell, colNumber) => {
        cell.font = headerStyle;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCCCCC' } };
        cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };

        // Apply right alignment with indent for specified columns
        if (colNumber >= 7 && colNumber <= 26) {
          cell.alignment = { horizontal: 'right', indent: 1 };
        }
      });

      // Define the starting row for data after header and information rows
      //const startDataRow = sheet.rowCount + 1;
      const startDataRow = 2;

      // Add data rows with right alignment and indent for specified columns
      let serialNumber = 1;
      let totalAmt = 0;
      contractorData.forEach((item) => {
        const row = sheet.addRow({
          sno: serialNumber++,
          EmployeeCode: item.EmployeeCode,
          EmployeeName: item.EmployeeName,
          BankName:item.bankName, 
          BankAccountNo: item.bankAccountNo,
          IfscCode:item.ifscCode,
          NetAmt: item.NetAmt,
        });
        totalAmt += item.NetAmt;
        row.eachCell((cell, colNumber) => {
          cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
          if (colNumber == 4) {
            cell.alignment = { horizontal: 'right', indent: 1 };
          }
        });
      });

      // Add total row
      const totalRow = sheet.addRow([
        '','Total',
        '', 
        { formula: `SUM(D${startDataRow}:$D${sheet.rowCount})` },
      ]);

      totalRow.eachCell(cell => {
        cell.font = totalStyle;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCCCCC' } };
        cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
        cell.alignment = { horizontal: 'right', indent: 1 };
      });

      sheet.mergeCells('A1:D1');
      const headerCell1 = sheet.getCell('A1');
      headerCell1.value = 'Cash Statement';
      headerCell1.alignment = { horizontal: 'center', vertical: 'middle' };
      headerCell1.font = { bold: true, size: 12 };
      
      // Add a few blank rows before adding the final row for the company name
      sheet.addRows([[], [], []]);
      
    }

    // Save the workbook
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `CashFile_${pmonth}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error exporting the wages report:", error);
    throw error;
  }
};

export default exportWagesToXLS;
