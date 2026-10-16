import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";
import Select from "react-select";
import axios from "../../api/axios.js";
import styles from "./SandwichRuleMaster.module.css";
import moment from "moment";

/* ============================
   Checkbox Option
============================ */
const CustomOption = (props) => {
  const { innerRef, innerProps, isSelected, data } = props;
  return (
    <div ref={innerRef} {...innerProps} style={{ display: "flex" }}>
      <input type="checkbox" checked={isSelected} readOnly />
      <label style={{ marginLeft: 8 }}>{data.label}</label>
    </div>
  );
};

const ProcessSandwich = () => {
  const navigate = useNavigate();
  const user = useSelector(selectUser);

  const emp_id = user?.emp_id;
  const token = user?.token;

  const [billingCycle, setBillingCycle] = useState([]);
  const [pmonth, setPmonth] = useState([]);
  const [contractor, setContractor] = useState([]);
  const [entity, setEntity] = useState([]);

  const [selectedBillingCycle, setSelectedBillingCycle] = useState(null);
  const [selectedPmonth, setSelectedPmonth] = useState(null);
  const [selectedContractor, setSelectedContractor] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState([]);

  const [loading, setLoading] = useState(false);

  /* ============================
     Load Masters
  ============================ */
  useEffect(() => {
    fetchBillingCycle();
    fetchContractor();
    fetchEntity();
    fetchPmonth();
  }, []);

  const fetchBillingCycle = async () => {
    const res = await axios.get("/api/employee/getBillingType");
    setBillingCycle(
      res.data.map((x) => ({
        value: x.billingtype_code,
        label: x.billingtype_name,
      })),
    );
  };

  const fetchPmonth = async () => {
    const res = await axios.post("/api/wages/getProcessMonth");
    setPmonth(
      res.data.map((x) => ({
        value: x.pmonth,
        label: moment(x.pmonth).format("DD/MM/YYYY"),
      })),
    );
  };

  const fetchPmonthByBilling = async (billingType) => {
    const res = await axios.post("/api/wages/getProcessMonthByBillingCycle", {
      billingtype: billingType,
    });
    setPmonth(
      res.data.map((x) => ({
        value: x.pmonth,
        label: moment(x.pmonth).format("DD/MM/YYYY"),
      })),
    );
  };

  const fetchContractor = async () => {
    const res = await axios.get("/api/contractor/getAllContractors");
    setContractor([
      { value: "ALL", label: "Select All Contractors" },
      ...res.data.map((x) => ({
        value: x.Contractor_ID,
        label: x.Contractor_Name,
      })),
    ]);
  };

  const fetchEntity = async () => {
    const res = await axios.post("/api/entity/getAssignedEntity", { emp_id });
    setEntity([
      { value: "ALL", label: "Select All Entities" },
      ...res.data.map((x) => ({
        value: x.entity_code,
        label: x.entity_name,
      })),
    ]);
  };

  /* ============================
     Select Logic
  ============================ */
  const handleMulti = (options, selected, setter) => {
    if (selected?.some((x) => x.value === "ALL")) {
      setter(options);
    } else {
      setter(selected || []);
    }
  };

  /* ============================
     Run Sandwich
  ============================ */
  const handleRun = async () => {
    try {
      setLoading(true);

      const data = {
        lv_emp_id: emp_id,
        billing_type: selectedBillingCycle?.value,
        pmonth: selectedPmonth?.value,
        contractor: selectedContractor.map((x) => x.value),
        entity: selectedEntity.map((x) => x.value),
      };

      await axios.post("/api/attendance/runSandwich", data, {
        timeout: 30 * 60 * 1000,
      });

      alert("Sandwich Rules Applied Successfully!");
    } catch (err) {
      console.error(err);
      alert("Error applying sandwich rules");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div>
        <p>Please login</p>
        <button onClick={() => navigate("/")}>Login</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Apply Sandwich Rules</h2>

      <div>
        <label>Billing Cycle</label>
        <Select
          options={billingCycle}
          value={selectedBillingCycle}
          onChange={(opt) => {
            setSelectedBillingCycle(opt);
            fetchPmonthByBilling(opt?.value);
          }}
        />
      </div>

      <div>
        <label>Process Month</label>
        <Select
          options={pmonth}
          value={selectedPmonth}
          onChange={setSelectedPmonth}
        />
      </div>

      <div>
        <label>Contractor</label>
        <Select
          isMulti
          options={contractor}
          value={selectedContractor}
          onChange={(sel) =>
            handleMulti(contractor, sel, setSelectedContractor)
          }
          components={{ Option: CustomOption }}
        />
      </div>

      <div>
        <label>Entity</label>
        <Select
          isMulti
          options={entity}
          value={selectedEntity}
          onChange={(sel) => handleMulti(entity, sel, setSelectedEntity)}
          components={{ Option: CustomOption }}
        />
      </div>

      <br />

      <button className={styles.button} onClick={handleRun}>
        Apply Sandwich
      </button>

      {loading && (
        <div className={styles.loaderContainer}>
          <div className={styles.spinner}></div>
        </div>
      )}
    </div>
  );
};

export default ProcessSandwich;
