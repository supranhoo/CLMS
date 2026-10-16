import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";
import Select from "react-select";
import axios from "../../api/axios.js";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import styles from "./PrintWages.module.css";

//---------------------------------------------------
// CUSTOM OPTION (Checkbox)
//---------------------------------------------------
const CustomOption = (props) => {
  const { innerRef, innerProps, isSelected, data } = props;
  return (
    <div
      ref={innerRef}
      {...innerProps}
      style={{ display: "flex", alignItems: "center" }}
    >
      <input type="checkbox" checked={isSelected} readOnly />
      <label style={{ marginLeft: 8 }}>{data.label}</label>
    </div>
  );
};

const PTReport = () => {
  const user = useSelector(selectUser);
  const token = user?.token;
  const emp_id = user?.emp_id;

  //---------------------------------------------------
  // STATES
  //---------------------------------------------------
  const [financialYear, setFinancialYear] = useState([]);
  const [selectedFY, setSelectedFY] = useState(null);

  const [contractor, setContractor] = useState([]);
  const [bu, setBu] = useState([]);
  const [entity, setEntity] = useState([]);
  const [department, setDepartment] = useState([]);
  const [empType, setEmpType] = useState([]);

  const [selectedContractor, setSelectedContractor] = useState([]);
  const [selectedBU, setSelectedBU] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState([]);
  const [selectedEmpType, setSelectedEmpType] = useState([]);

  //---------------------------------------------------
  // LOAD DATA
  //---------------------------------------------------
  useEffect(() => {
    fetchFinYear();
    fetchBUData();
    fetchContractorData();
    fetchDeptData();
    fetchEntityData();
    fetchEmpType();
  }, []);

  //---------------------------------------------------
  // FETCH FUNCTIONS
  //---------------------------------------------------
  const fetchFinYear = async () => {
    const res = await axios.get("/api/wages/getAllFinYear");
    setFinancialYear(
      res.data.map((i) => ({
        value: i.finyear,
        label: i.finyear,
        start_date: i.start_date,
        end_date: i.end_date,
      })),
    );
  };

  const fetchBUData = async () => {
    const res = await axios.post("/api/entity/getAssignedBU", { emp_id });
    setBu([
      { value: "ALL", label: "Select All BU" },
      ...res.data.map((i) => ({ value: i.bu_code, label: i.bu_name })),
    ]);
  };

  const fetchContractorData = async () => {
    const res = await axios.get("/api/contractor/getAllContractors");
    setContractor([
      { value: "ALL", label: "Select All Contractors" },
      ...res.data.map((i) => ({
        value: i.Contractor_ID,
        label: i.Contractor_Name,
      })),
    ]);
  };

  const fetchDeptData = async () => {
    const res = await axios.post("/api/entity/getAllDept");
    setDepartment([
      { value: "ALL", label: "Select All Dept" },
      ...res.data.map((i) => ({ value: i.dept_code, label: i.dept_name })),
    ]);
  };

  const fetchEntityData = async () => {
    const res = await axios.post("/api/entity/getAssignedEntity", { emp_id });
    setEntity([
      { value: "ALL", label: "Select All Entity" },
      ...res.data.map((i) => ({ value: i.entity_code, label: i.entity_name })),
    ]);
  };

  const fetchEmpType = async () => {
    const res = await axios.get("/api/employee/getEmpType");
    setEmpType([
      { value: "ALL", label: "Select All Emp Types" },
      ...res.data.map((i) => ({
        value: i.emp_type_code,
        label: i.emp_type_desc,
      })),
    ]);
  };

  //---------------------------------------------------
  // SELECT ALL HANDLING
  //---------------------------------------------------
  const customHandleChange = (options, selectedOptions, setSelectedOptions) => {
    if (!selectedOptions) return setSelectedOptions([]);

    const last = selectedOptions[selectedOptions.length - 1];

    if (last?.value === "ALL") {
      setSelectedOptions(options.filter((o) => o.value !== "ALL"));
    } else {
      setSelectedOptions(selectedOptions);
    }
  };

  //---------------------------------------------------
  // EXCEL EXPORT
  //---------------------------------------------------
  const exportToExcel = async (data) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("PT Report");

    const months = [
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
    ];

    // Title
    worksheet.mergeCells("A1:AA1");
    worksheet.getCell("A1").value = "PT REPORT";
    worksheet.getCell("A1").font = { bold: true, size: 16 };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    // Header Row 1
    worksheet.getRow(2).values = ["Emp Code", "Name", "Dept"];
    let col = 4;

    months.forEach((m) => {
      worksheet.mergeCells(2, col, 2, col + 1);
      worksheet.getCell(2, col).value = m;
      worksheet.getCell(2, col).alignment = { horizontal: "center" };
      worksheet.getCell(2, col).font = { bold: true };
      col += 2;
    });

    worksheet.mergeCells(2, col, 3, col);
    worksheet.getCell(2, col).value = "TOTAL PT";

    // Header Row 2
    let headers = ["Emp Code", "Name", "Dept"];
    months.forEach(() => {
      headers.push("BASE");
      headers.push("PT");
    });
    headers.push("TOTAL PT");

    worksheet.getRow(3).values = headers;
    worksheet.getRow(3).font = { bold: true };

    worksheet.columns = headers.map((h, i) => ({ width: i < 3 ? 20 : 12 }));

    // Data
    data.forEach((row) => {
      let r = [row.EmployeeCode, row.EmployeeName, row.Department];
      months.forEach((m) => {
        r.push(row[`${m}_BASE`] || 0);
        r.push(row[`${m}_PT`] || 0);
      });
      r.push(row.TOTAL_PT || 0);
      worksheet.addRow(r);
    });

    // Total Row
    const totalRow = worksheet.addRow([]);
    totalRow.getCell(1).value = "TOTAL";
    totalRow.font = { bold: true };

    for (let i = 4; i <= worksheet.columnCount; i++) {
      const colLetter = worksheet.getColumn(i).letter;
      totalRow.getCell(i).value = {
        formula: `SUM(${colLetter}4:${colLetter}${totalRow.number - 1})`,
      };
    }

    // Borders
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    worksheet.views = [{ state: "frozen", ySplit: 3 }];

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "PT_Report.xlsx");
  };

  //---------------------------------------------------
  // RUN REPORT
  //---------------------------------------------------
  const handleRunReport = async () => {
    if (!selectedFY) return alert("Select Financial Year");

    const res = await axios.post("/api/wages/getPTReport", {
      fy_start: selectedFY.start_date,
      fy_end: selectedFY.end_date,
      contractor: selectedContractor.map((o) => o.value),
      bu: selectedBU.map((o) => o.value),
      entity: selectedEntity.map((o) => o.value),
      department: selectedDepartment.map((o) => o.value),
      emp_type: selectedEmpType.map((o) => o.value),
      emp_id,
      token,
    });

    if (!res.data.length) return alert("No data found");

    await exportToExcel(res.data);
  };

  //---------------------------------------------------
  // UI
  //---------------------------------------------------
  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>PT Report</h2>

      <div className={styles.filterRow}>
        <div className={styles.filterItem}>
          <label>Financial Year</label>
          <Select
            options={financialYear}
            value={selectedFY}
            onChange={setSelectedFY}
          />
        </div>

        <div className={styles.filterItem}>
          <label>Employee Type</label>
          <Select
            isMulti
            options={empType}
            value={selectedEmpType}
            onChange={(o) => customHandleChange(empType, o, setSelectedEmpType)}
            components={{ Option: CustomOption }}
          />
        </div>

        <div className={styles.filterItem}>
          <label>Contractor</label>
          <Select
            isMulti
            options={contractor}
            value={selectedContractor}
            onChange={(o) =>
              customHandleChange(contractor, o, setSelectedContractor)
            }
            components={{ Option: CustomOption }}
          />
        </div>

        <div className={styles.filterItem}>
          <label>Business Unit</label>
          <Select
            isMulti
            options={bu}
            value={selectedBU}
            onChange={(o) => customHandleChange(bu, o, setSelectedBU)}
            components={{ Option: CustomOption }}
          />
        </div>

        <div className={styles.filterItem}>
          <label>Entity</label>
          <Select
            isMulti
            options={entity}
            value={selectedEntity}
            onChange={(o) => customHandleChange(entity, o, setSelectedEntity)}
            components={{ Option: CustomOption }}
          />
        </div>

        <div className={styles.filterItem}>
          <label>Department</label>
          <Select
            isMulti
            options={department}
            value={selectedDepartment}
            onChange={(o) =>
              customHandleChange(department, o, setSelectedDepartment)
            }
            components={{ Option: CustomOption }}
          />
        </div>
      </div>

      <div className={styles.buttonRow}>
        <button className={styles.primaryButton} onClick={handleRunReport}>
          ▶ Run PT Report
        </button>
      </div>
    </div>
  );
};

export default PTReport;
