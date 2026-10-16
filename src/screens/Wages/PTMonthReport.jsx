import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";
import Select from "react-select";
import axios from "../../api/axios.js";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import styles from "./PrintWages.module.css";

//---------------------------------------------------
// FORMAT MONTH (Mon-YYYY)
//---------------------------------------------------
const formatMonth = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
};

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

const PTMonthReport = () => {
  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;

  //---------------------------------------------------
  // STATES
  //---------------------------------------------------
  const [processMonths, setProcessMonths] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);

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
    fetchProcessMonths();
    fetchBUData();
    fetchContractorData();
    fetchDeptData();
    fetchEntityData();
    fetchEmpType();
  }, []);

  //---------------------------------------------------
  // FETCH MONTHS
  //---------------------------------------------------
  const fetchProcessMonths = async () => {
    const res = await axios.post("/api/wages/getAllProcessMonth");

    const formatted = res.data.map((i) => ({
      value: i.pmonth,
      label: formatMonth(i.pmonth),
    }));

    setProcessMonths([
      { value: "ALL", label: "Select All Months" },
      ...formatted,
    ]);
  };

  //---------------------------------------------------
  // OTHER FETCH (same as before)
  //---------------------------------------------------
  const fetchBUData = async () => {
    const res = await axios.post("/api/entity/getAssignedBU", { emp_id });
    setBu([
      { value: "ALL", label: "Select All BU" },
      ...res.data.map((i) => ({
        value: i.bu_code,
        label: i.bu_name,
      })),
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
      ...res.data.map((i) => ({
        value: i.dept_code,
        label: i.dept_name,
      })),
    ]);
  };

  const fetchEntityData = async () => {
    const res = await axios.post("/api/entity/getAssignedEntity", { emp_id });
    setEntity([
      { value: "ALL", label: "Select All Entity" },
      ...res.data.map((i) => ({
        value: i.entity_code,
        label: i.entity_name,
      })),
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
  // SELECT ALL HANDLER
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
    const ws = workbook.addWorksheet("PT Report");

    // Sort selected months
    const sortedMonths = [...selectedMonths].sort(
      (a, b) => new Date(a.value) - new Date(b.value),
    );

    const minMonth = sortedMonths[0]?.label;
    const maxMonth = sortedMonths[sortedMonths.length - 1]?.label;

    //---------------------------------------------------
    // TITLE
    //---------------------------------------------------
    ws.mergeCells(1, 1, 1, sortedMonths.length + 3);
    ws.getCell(1, 1).value =
      `PT Report for the Period: ${minMonth} to ${maxMonth}`;
    ws.getCell(1, 1).font = { bold: true, size: 14 };
    ws.getCell(1, 1).alignment = { horizontal: "center" };

    //---------------------------------------------------
    // HEADER
    //---------------------------------------------------
    let headers = ["Emp Code", "Name"];
    sortedMonths.forEach((m) => headers.push(m.label));
    headers.push("TOTAL");

    ws.addRow(headers).font = { bold: true };

    //---------------------------------------------------
    // DATA
    //---------------------------------------------------
    data.forEach((r) => {
      let row = [r.EmployeeCode, r.EmployeeName];

      sortedMonths.forEach((m) => {
        const key = "M" + (new Date(m.value).getMonth() + 1);
        row.push(r[key] || 0);
      });

      row.push(r.TOTAL_PT || 0);
      ws.addRow(row);
    });

    //---------------------------------------------------
    // TOTAL ROW
    //---------------------------------------------------
    const totalRow = ws.addRow([]);
    totalRow.getCell(1).value = "TOTAL";
    totalRow.font = { bold: true };

    for (let i = 3; i <= ws.columnCount; i++) {
      const col = ws.getColumn(i).letter;
      totalRow.getCell(i).value = {
        formula: `SUM(${col}3:${col}${ws.rowCount - 1})`,
      };
    }

    //---------------------------------------------------
    // BORDERS
    //---------------------------------------------------
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "PT_Month_Report.xlsx");
  };

  //---------------------------------------------------
  // RUN REPORT
  //---------------------------------------------------
  const handleRunReport = async () => {
    if (!selectedMonths.length) return alert("Select Process Months");

    const res = await axios.post("/api/wages/getPTMonthWiseReport", {
      pmonths: selectedMonths.map((m) => m.value),
      emp_type: selectedEmpType.map((o) => o.value),
      contractor: selectedContractor.map((o) => o.value),
      bu: selectedBU.map((o) => o.value),
      entity: selectedEntity.map((o) => o.value),
      department: selectedDepartment.map((o) => o.value),
      emp_id,
    });

    await exportToExcel(res.data);
  };

  //---------------------------------------------------
  // UI
  //---------------------------------------------------
  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>PT Month Report</h2>

      <div className={styles.filterRow}>
        <div className={styles.filterItem}>
          <label>Process Months</label>
          <Select
            isMulti
            closeMenuOnSelect={false}
            options={processMonths}
            value={selectedMonths}
            onChange={(o) =>
              customHandleChange(processMonths, o, setSelectedMonths)
            }
            components={{ Option: CustomOption }}
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
          <label>BU</label>
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
          ▶ Run PT Month Report
        </button>
      </div>
    </div>
  );
};

export default PTMonthReport;
