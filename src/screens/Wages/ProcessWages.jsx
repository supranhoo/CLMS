import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";
import Select, { components } from "react-select";
import axios from "../../api/axios.js";
import { apiErrorMessage } from "../../utils/apiError";
import styles from "./ProcessWages.module.css"; // Import CSS module
import moment from "moment"; // You can use the moment library for date formatting

// Custom Option component to include checkboxes in the dropdown
const CustomOption = (props) => {
  const { innerRef, innerProps, isSelected, data } = props;
  return (
    <div
      ref={innerRef}
      {...innerProps}
      style={{ display: "flex", alignItems: "center" }}
    >
      <input type="checkbox" checked={isSelected} onChange={() => null} />
      <label style={{ marginLeft: 8 }}>{data.label}</label>
    </div>
  );
};

const ProcessWages = () => {
  const [contractor, setContractor] = useState([]);
  const [billingCycle, setBillingCycle] = useState([]);
  const [pmonth, setPmonth] = useState([]);
  const [entity, setEntity] = useState([]);
  const [selectedContractor, setSelectedContractor] = useState([]);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState([]);
  const [selectedPmonth, setSelectedPmonth] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState([]);
  const [loading, setLoading] = useState(false); // Loading state
  const navigate = useNavigate();

  const user = useSelector(selectUser);
  const token = user?.token;
  const emp_id = user?.emp_id;

  const currentDate = new Date();
  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Month is zero-based
    const year = date.getFullYear();
    return `${year}-${month}-${day}`; // Format as DD-MM-YYYY
  };
  const [errors, setErrors] = useState({}); // State for errors

  const fetchBillingCycleData = async () => {
    try {
      const response = await axios.get("/api/employee/getBillingType");
      const formattedBillingCycle = response.data.map((item) => ({
        value: item.billingtype_code,
        label: item.billingtype_name,
      }));
      setBillingCycle(formattedBillingCycle); // Set the correct formatted array
    } catch (error) {
      console.error("Error fetching Billing Cycles:", error);
    }
  };

  const fetchPmonthData = async () => {
    try {
      const response = await axios.post("/api/wages/getProcessMonth");
      const formattedPmonth = response.data.map((item) => ({
        value: item.pmonth,
        //label: item.pmonth,
        label: moment(item.pmonth).format("DD/MM/YYYY"), // Display as DD/MM/YYYY
      }));
      setPmonth(formattedPmonth); // Set the correct formatted array
    } catch (error) {
      console.error("Error fetching Process Month:", error);
    }
  };

  const fetchPmonthByBillingCycle = async (billingType) => {
    try {
      const response = await axios.post(
        "/api/wages/getProcessMonthByBillingCycle",
        {
          billingtype: billingType,
        },
      );

      // Format the process month data
      const formattedPmonth = response.data.map((item) => ({
        value: item.pmonth,
        //label: item.pmonth,
        label: moment(item.pmonth).format("DD/MM/YYYY"), // Display as DD/MM/YYYY
      }));
      setPmonth(formattedPmonth); // Update the pmonth dropdown options
    } catch (error) {
      console.error("Error fetching Process Months by Billing Type:", error);
    }
  };

  const handleBillingCycleChange = (selectedOption) => {
    setSelectedBillingCycle(selectedOption);

    // Fetch corresponding process months based on the selected billing cycle
    if (selectedOption && selectedOption.value) {
      fetchPmonthByBillingCycle(selectedOption.value);
    } else {
      setPmonth([]); // Reset pmonth options if no billing cycle is selected
    }
  };

  // Fetch Contractor data from the server
  const fetchContractorData = async () => {
    try {
      const response = await axios.get("/api/contractor/getAllContractors");
      const formattedContractorData = [
        { value: "ALL", label: "Select All Contractors" },
        ...response.data.map((item) => ({
          value: item.Contractor_ID,
          label: item.Contractor_Name,
        })),
      ];
      setContractor(formattedContractorData);
    } catch (error) {
      console.error("Error fetching Contractor data:", error);
    }
  };

  // Fetch Entity data from the server
  const fetchEntityData = async () => {
    try {
      const response = await axios.post("/api/entity/getAssignedEntity", {
        emp_id,
      });
      const formattedEntityData = [
        { value: "ALL", label: "Select All Entities" },
        ...response.data.map((item) => ({
          value: item.entity_code,
          label: item.entity_name,
        })),
      ];
      setEntity(formattedEntityData);
    } catch (error) {
      console.error("Error fetching Entity data:", error);
    }
  };

  // Load all data on component mount
  useEffect(() => {
    fetchPmonthData();
    fetchBillingCycleData();
    fetchContractorData();
    fetchEntityData();
  }, []);

  if (!token) {
    return (
      <div>
        <p>You must be logged in to print daily attendance.</p>
        <button onClick={() => navigate("/")}>Go to Login</button>
      </div>
    );
  }

  // Helper function to handle "Select All" logic
  const handleSelectAll = (options, selectedOptions, setSelectedOptions) => {
    const isAllSelected = selectedOptions.some(
      (option) => option.value === "ALL",
    );
    if (isAllSelected) {
      // If "ALL" is selected, select all options
      setSelectedOptions(options);
    } else {
      // Otherwise, deselect all options
      setSelectedOptions([]);
    }
  };

  const customHandleChange = (options, selectedOptions, setSelectedOptions) => {
    if (selectedOptions.some((option) => option.value === "ALL")) {
      handleSelectAll(options, selectedOptions, setSelectedOptions);
    } else {
      setSelectedOptions(selectedOptions);
    }
  };

  const customHandleChangeMulti = (
    options,
    selectedOptions,
    setSelectedOptions,
  ) => {
    // Ensure selectedOptions is an array
    if (!selectedOptions || !Array.isArray(selectedOptions)) {
      setSelectedOptions([]);
      return;
    }

    // Check if 'ALL' is selected and handle accordingly
    if (selectedOptions.some((option) => option.value === "ALL")) {
      handleSelectAll(options, selectedOptions, setSelectedOptions);
    } else {
      setSelectedOptions(selectedOptions);
    }
  };

  const customHandleChangeSingle = (selectedOption, setSelectedOption) => {
    if (!selectedOption) {
      setSelectedOption(null);
      return;
    }

    setSelectedOption(selectedOption); // Set the single selected option
  };

  const customStyles = {
    control: (base) => ({
      ...base,
      minWidth: "200px",
      maxWidth: "400px",
      borderColor: "#aaa",
      boxShadow: "none",
      "&:hover": {
        borderColor: "#888",
      },
    }),
    menu: (base) => ({
      ...base,
      maxWidth: "400px",
    }),
  };

  const handleProcess = async () => {
    setLoading(true); // Start loading
    try {
      const selectedContractorValues = selectedContractor.map(
        (option) => option.value,
      );
      const selectedEntityValues = selectedEntity.map((option) => option.value);

      // Single select values: no need to use .map(), access value directly
      const selectedBillingCycleValue = selectedBillingCycle?.value; // Directly access the value for single select
      const selectedPmonthValue = selectedPmonth?.value; // Directly access the value for single select

      const data = {
        contractor: selectedContractorValues,
        billingtype: selectedBillingCycleValue,
        entity: selectedEntityValues,
        pmonth: selectedPmonthValue,
        emp_id: emp_id,
      };
      const response = await axios.post("/api/wages/processWages", data, {
        timeout: 30 * 60 * 1000,
      });
      alert("Wages Processed successfully!");
    } catch (error) {
      console.error("Error printing attendance:", error);
      alert(`Failed to Process Wages: ${apiErrorMessage(error)}`);
      setLoading(false); // Stop loading
    } finally {
      setLoading(false); // Stop loading
    }
  };

  return (
    <div>
      <div>
        <br></br>
      </div>
      <div className={styles.container}>
        <h2 className={styles.heading}>Process Wages</h2>
        <form>
          {/* Date inputs */}
          <div>
            <label>Billing Cycle:</label>
            <Select
              options={billingCycle}
              value={selectedBillingCycle}
              onChange={handleBillingCycleChange}
              components={{ Option: CustomOption }}
              placeholder="Select Billing Cycle"
              styles={customStyles}
              closeMenuOnSelect={true}
              className={styles.selectContainer}
            />
          </div>
          <div>
            <label>Process Month:</label>
            <Select
              options={pmonth}
              value={selectedPmonth}
              onChange={(selectedOption) =>
                customHandleChangeSingle(selectedOption, setSelectedPmonth)
              }
              components={{ Option: CustomOption }}
              placeholder="Select Process Month"
              styles={customStyles}
              closeMenuOnSelect={true}
              className={styles.selectContainer}
            />
          </div>
          <div>
            <label>Contractor:</label>
            <Select
              isMulti
              options={contractor}
              value={selectedContractor}
              onChange={(selectedOptions) =>
                customHandleChangeMulti(
                  contractor,
                  selectedOptions,
                  setSelectedContractor,
                )
              }
              components={{ Option: CustomOption }}
              placeholder="Select Contractors"
              styles={customStyles}
              closeMenuOnSelect={false}
              className={styles.selectContainer}
            />
          </div>
          <div>
            <label>Entity:</label>
            <Select
              isMulti
              options={entity}
              value={selectedEntity}
              onChange={(selectedOptions) =>
                customHandleChangeMulti(
                  entity,
                  selectedOptions,
                  setSelectedEntity,
                )
              }
              components={{ Option: CustomOption }}
              placeholder="Select Entities"
              styles={customStyles}
              closeMenuOnSelect={false}
              className={styles.selectContainer}
            />
          </div>
          <div>
            <br></br>
          </div>
          <div className={styles.buttonContainer}>
            <button
              type="button"
              className={styles.button}
              onClick={handleProcess}
            >
              Process Wages
            </button>
          </div>
          {loading && (
            <div className={styles.loaderContainer}>
              <div className={styles.spinner}></div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ProcessWages;
