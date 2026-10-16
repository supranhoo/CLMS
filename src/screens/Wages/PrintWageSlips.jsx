import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";
import Select from "react-select";
import axios from "../../api/axios.js";
import styles from "./ProcessWages.module.css";
import moment from "moment";

/* =======================
   Custom Option (Checkbox)
   ======================= */
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

const PrintWageSlips = () => {
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const token = user?.token;
  const emp_id = user?.emp_id;

  /* =======================
     Master Data
     ======================= */
  const [billingCycle, setBillingCycle] = useState([]);
  const [pmonth, setPmonth] = useState([]);
  const [contractor, setContractor] = useState([]);
  const [entity, setEntity] = useState([]);
  const [bu, setBu] = useState([]);
  const [dept, setDept] = useState([]);
  const [location, setLocation] = useState([]);
  const [employee, setEmployee] = useState([]);

  /* =======================
     Selections
     ======================= */
  const [selectedBillingCycle, setSelectedBillingCycle] = useState(null);
  const [selectedPmonth, setSelectedPmonth] = useState(null);
  const [selectedContractor, setSelectedContractor] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState([]);
  const [selectedBu, setSelectedBu] = useState([]);
  const [selectedDept, setSelectedDept] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState([]);

  /* =======================
     Print Options
     ======================= */
  const [outputFormat, setOutputFormat] = useState({
    value: "PDF",
    label: "PDF",
  });
  const [fileMode, setFileMode] = useState({
    value: "SINGLE",
    label: "Single File",
  });
  const [groupBy, setGroupBy] = useState({
    value: "EMPLOYEE",
    label: "Employee",
  });
  const [showZero, setShowZero] = useState(false);
  const [statutoryText, setStatutoryText] = useState(
    "This is a system generated payslip and does not require signature.",
  );

  /* =======================
     Progress & Loading
     ======================= */
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState(null);

  /* =======================
     Fetch Masters
     ======================= */
  useEffect(() => {
    fetchBillingCycle();
    fetchPmonth();
    fetchContractor();
    fetchEntity();
    fetchBu();
    fetchDept();
    fetchLocation();
    fetchEmployee();
  }, []);

  const fetchBillingCycle = async () => {
    const res = await axios.get("/api/employee/getBillingType");
    setBillingCycle(
      res.data.map((i) => ({
        value: i.billingtype_code,
        label: i.billingtype_name,
      })),
    );
  };

  const fetchPmonth = async () => {
    const res = await axios.post("/api/wages/getAllProcessMonth");
    setPmonth(
      res.data.map((i) => ({
        value: i.pmonth,
        label: moment(i.pmonth).format("DD/MM/YYYY"),
      })),
    );
  };

  const fetchPmonthByBillingCycle = async (billingtype) => {
    const res = await axios.post(
      "/api/wages/getAllProcessMonthByBillingCycle",
      {
        billingtype,
      },
    );
    setPmonth(
      res.data.map((i) => ({
        value: i.pmonth,
        label: moment(i.pmonth).format("DD/MM/YYYY"),
      })),
    );
  };

  const fetchContractor = async () => {
    const res = await axios.get("/api/contractor/getAllContractors");
    setContractor([
      { value: "ALL", label: "Select All Contractors" },
      ...res.data.map((c) => ({
        value: c.Contractor_ID,
        label: c.Contractor_Name,
      })),
    ]);
  };

  const fetchEntity = async () => {
    const res = await axios.post("/api/entity/getAssignedEntity", { emp_id });
    setEntity([
      { value: "ALL", label: "Select All Entities" },
      ...res.data.map((e) => ({
        value: e.entity_code,
        label: e.entity_name,
      })),
    ]);
  };

  const fetchBu = async () => {
    try {
      const response = await axios.post("/api/entity/getAssignedBU", {
        emp_id,
      });
      const formattedBUData = [
        { value: "ALL", label: "Select All Business Units" },
        ...response.data.map((item) => ({
          value: item.bu_code,
          label: item.bu_name,
        })),
      ];
      setBu(formattedBUData);
    } catch (error) {
      console.error("Error fetching BU data:", error);
    }
  };

  const fetchDept = async () => {
    try {
      const response = await axios.post("/api/entity/getAllDept");
      const formattedDeptData = [
        { value: "ALL", label: "Select All Departments" },
        ...response.data.map((item) => ({
          value: item.dept_code,
          label: item.dept_name,
        })),
      ];
      setDept(formattedDeptData);
    } catch (error) {
      console.error("Error fetching Department data:", error);
    }
  };

  const fetchLocation = async () => {
    try {
      const response = await axios.post("/api/entity/getAssignedLocCode", {
        emp_id,
      });
      const formattedLocCodeData = [
        { value: "ALL", label: "Select All Locations" },
        ...response.data.map((item) => ({
          value: item.loc_code,
          label: item.loc_name,
        })),
      ];
      setLocation(formattedLocCodeData);
    } catch (error) {
      console.error("Error fetching LocCode data:", error);
    }
  };

  const fetchEmployee = async () => {
    try {
      const response = await axios.get("/api/employee/getAllEmployees", {
        emp_id,
      });
      const formattedEmployeeData = [
        { value: "ALL", label: "Select All Employees" },
        ...response.data.map((item) => ({
          value: item.Employee_Code,
          label: `${item.Employee_Code} - ${item.display_name}`, // ✅ fixed
        })),
      ];
      setEmployee(formattedEmployeeData);
    } catch (error) {
      console.error("Error fetching Employee data:", error);
    }
  };

  /* =======================
     Multi Select Helper
     ======================= */
  const handleMultiChange = (options, selected, setter) => {
    if (!selected) return setter([]);
    if (selected.some((o) => o.value === "ALL")) {
      setter(options);
    } else {
      setter(selected);
    }
  };

  /* =======================
     Print Handler
     ======================= */
  /*
  const handlePrint = async () => {
    setLoading(true);
    setProgress(null);
    setJobId(null);

    try {
      const payload = {
        pmonth: selectedPmonth?.value,
        billingtype: selectedBillingCycle?.value,
        emp_id: emp_id,
        filters: {
          contractor: selectedContractor.map((o) => o.value),
          entity: selectedEntity.map((o) => o.value),
          bu: selectedBu.map((o) => o.value),
          dept: selectedDept.map((o) => o.value),
          location: selectedLocation.map((o) => o.value),
          employee: selectedEmployee.map((o) => o.value),
        },
        output: {
          format: outputFormat.value,
          mode: fileMode.value,
          groupBy: groupBy.value,
          showZero,
          fileNamePrefix: "WAGE_SLIP",
        },
        statutoryText,
      };

      const res = await axios.post("/api/wages/generateWageSlips", payload, {
        responseType: "blob",
        timeout: 30 * 60 * 1000,
      });

      const job = res.headers["x-job-id"];
      if (job) setJobId(job);

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "WageSlips";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to generate wage slips");
    } finally {
      setLoading(false);
    }
  };
  */

  /* =======================
   Print Handler
   ======================= */
  const handlePrint = async () => {
    setLoading(true);
    setProgress(null);
    setJobId(null);

    try {
      const payload = {
        pmonth: selectedPmonth?.value,
        billingtype: selectedBillingCycle?.value,
        emp_id: emp_id,
        filters: {
          contractor: (selectedContractor || []).map((o) => o.value),
          entity: (selectedEntity || []).map((o) => o.value),
          bu: (selectedBu || []).map((o) => o.value),
          dept: (selectedDept || []).map((o) => o.value),
          location: (selectedLocation || []).map((o) => o.value),
          employees: (selectedEmployee || []).map((o) => o.value),
        },
        output: {
          format: outputFormat?.value, // "PDF" | "ZIP"
          mode: fileMode?.value, // "SINGLE" | "SEPARATE"
          groupBy: groupBy?.value,
          showZero,
          fileNamePrefix: "WAGE_SLIP",
        },
        statutoryText,
      };

      const res = await axios.post("/api/wages/generateWageSlips", payload, {
        responseType: "blob",
        timeout: 30 * 60 * 1000,
      });

      // JobId
      const job = res.headers["x-job-id"];
      if (job) setJobId(job);

      // ✅ Correct mime
      const contentType =
        res.headers["content-type"] || "application/octet-stream";

      // ✅ Try to read filename from Content-Disposition
      let fileName = "";
      const disposition = res.headers["content-disposition"];
      if (disposition) {
        const match = disposition.match(
          /filename\*?=(?:UTF-8''|")?([^";\n]+)(?:")?/i,
        );
        if (match && match[1]) fileName = decodeURIComponent(match[1]);
      }

      // ✅ Fallback filename with correct extension
      if (!fileName) {
        const ext =
          (payload.output.format || "PDF").toUpperCase() === "ZIP"
            ? "zip"
            : "pdf";
        fileName = `WageSlips.${ext}`;
      }

      // ✅ Create blob with correct type
      const blob = new Blob([res.data], { type: contentType });

      // ✅ Download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate wage slips", err);
      alert("Failed to generate wage slips");
    } finally {
      setLoading(false);
    }
  };

  /* =======================
     Progress Polling
     ======================= */
  useEffect(() => {
    if (!jobId) return;

    const timer = setInterval(async () => {
      try {
        const res = await axios.get(`/api/payslip/progress/${jobId}`);
        setProgress(res.data);

        if (res.data.status !== "RUNNING") {
          clearInterval(timer);
        }
      } catch (e) {
        clearInterval(timer);
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [jobId]);

  if (!token) {
    return <p>Please login again.</p>;
  }

  /* =======================
     Render
     ======================= */
  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Print Wage Slips</h2>

      <label>Billing Cycle</label>
      <Select
        options={billingCycle}
        value={selectedBillingCycle}
        onChange={(o) => {
          setSelectedBillingCycle(o);
          fetchPmonthByBillingCycle(o?.value);
        }}
      />

      <label>Process Month</label>
      <Select
        options={pmonth}
        value={selectedPmonth}
        onChange={setSelectedPmonth}
      />

      <label>Contractor</label>
      <Select
        isMulti
        options={contractor}
        value={selectedContractor}
        onChange={(o) =>
          handleMultiChange(contractor, o, setSelectedContractor)
        }
        components={{ Option: CustomOption }}
      />

      <label>Entity</label>
      <Select
        isMulti
        options={entity}
        value={selectedEntity}
        onChange={(o) => handleMultiChange(entity, o, setSelectedEntity)}
        components={{ Option: CustomOption }}
      />

      <label>Business Unit</label>
      <Select
        isMulti
        options={bu}
        value={selectedBu}
        onChange={(o) => handleMultiChange(bu, o, setSelectedBu)}
        components={{ Option: CustomOption }}
      />

      <label>Department</label>
      <Select
        isMulti
        options={dept}
        value={selectedDept}
        onChange={(o) => handleMultiChange(dept, o, setSelectedDept)}
        components={{ Option: CustomOption }}
      />

      <label>Location</label>
      <Select
        isMulti
        options={location}
        value={selectedLocation}
        onChange={(o) => handleMultiChange(location, o, setSelectedLocation)}
        components={{ Option: CustomOption }}
      />

      <label>Employee Code</label>
      <Select
        isMulti
        options={employee}
        value={selectedEmployee}
        onChange={(o) => handleMultiChange(employee, o, setSelectedEmployee)}
        components={{ Option: CustomOption }}
      />

      <hr />

      <label>Output Format</label>
      <label>File Mode</label>
      <Select
        value={fileMode}
        onChange={setFileMode}
        options={[
          { value: "SINGLE", label: "Single File" },
          { value: "SEPARATE", label: "Separate Files (ZIP)" },
        ]}
      />

      <label>Group By</label>
      <Select
        value={groupBy}
        onChange={setGroupBy}
        options={[
          { value: "EMPLOYEE", label: "Employee" },
          { value: "CONTRACTOR", label: "Contractor" },
          { value: "DEPT", label: "Department" },
          { value: "BU", label: "Business Unit" },
          { value: "LOCATION", label: "Location" },
        ]}
      />

      <hr />

      <label>
        <input
          type="checkbox"
          checked={showZero}
          onChange={() => setShowZero(!showZero)}
        />{" "}
        Show Zero Amount Components
      </label>
      <hr />
      <label>Statutory Footer Text</label>
      <textarea
        rows={3}
        value={statutoryText}
        onChange={(e) => setStatutoryText(e.target.value)}
        style={{ width: "100%" }}
      />

      <div className={styles.buttonContainer}>
        <button className={styles.button} onClick={handlePrint}>
          Generate Wage Slips
        </button>
      </div>

      {loading && <div className={styles.spinner}></div>}

      {progress && (
        <div style={{ marginTop: 10 }}>
          <div>
            Generating payslips: {progress.processed} / {progress.total}
          </div>
          <progress
            value={progress.processed}
            max={progress.total}
            style={{ width: "100%" }}
          />
        </div>
      )}
    </div>
  );
};

export default PrintWageSlips;
