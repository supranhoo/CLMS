import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";
import Select, { components } from "react-select";
import axios from "../../api/axios.js";
import printMonthlyAtndSheet from "../../components/PrintMonthlyAtndSheet";
import exportMnthAtndToXLS from "../../components/ExportMnthAtndToXLS";
import styles from "./PrintDailyAttendance.module.css"; // Import CSS module

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

const MonthlyAtndSheet = () => {
  const [contractor, setContractor] = useState([]);
  const [bu, setBu] = useState([]);
  const [entity, setEntity] = useState([]);
  const [department, setDepartment] = useState([]);
  const [selectedContractor, setSelectedContractor] = useState([]);
  const [selectedBU, setSelectedBU] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState([]);
  const [separatePage, setSeparatePage] = useState(false);

  const [empType, setEmpType] = useState("PR"); // New state for Employee Type
  const [selectedEmpType, setSelectedEmpType] = useState([]);

  const [outputType, setOutputType] = useState("PDF"); // New state for Employee Type
  const navigate = useNavigate();
  const [locCode, setLocCode] = useState([]);
  const [selectedLocCode, setSelectedLocCode] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const user = useSelector(selectUser);
  const token = user?.token;
  const emp_id = user?.emp_id;

  const currentDate = new Date();
  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );
  const SelectAllOption = ({ innerRef, innerProps, selectAllFiltered }) => (
    <div
      ref={innerRef}
      {...innerProps}
      style={{ display: "flex", alignItems: "center" }}
    >
      <input type="checkbox" checked={false} onChange={selectAllFiltered} />
      <label style={{ marginLeft: 8 }}>Select All Filtered</label>
    </div>
  );
  const handleSelectAllFiltered = (filteredOptions) => {
    setSelectedBU(filteredOptions);
    setSearchTerm(""); // Clear search input after selecting all filtered options
  };

  const lastDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  );
  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Month is zero-based
    const year = date.getFullYear();
    return `${year}-${month}-${day}`; // Format as DD-MM-YYYY
  };
  const [fromDate, setFromDate] = useState(formatDate(firstDayOfMonth)); // Replace with the desired initial date
  const [toDate, setToDate] = useState(formatDate(lastDayOfMonth)); // Replace with the desired initial date
  const [errors, setErrors] = useState({}); // State for errors

  // Fetch BU data from the server
  const fetchLocCodeData = async () => {
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
      setLocCode(formattedLocCodeData);
    } catch (error) {
      console.error("Error fetching LocCode data:", error);
    }
  };

  // Fetch BU data from the server
  const fetchBUData = async () => {
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

  // Fetch Department data from the server
  const fetchDeptData = async () => {
    try {
      const response = await axios.post("/api/entity/getAllDept");
      const formattedDeptData = [
        { value: "ALL", label: "Select All Departments" },
        ...response.data.map((item) => ({
          value: item.dept_code,
          label: item.dept_name,
        })),
      ];
      setDepartment(formattedDeptData);
    } catch (error) {
      console.error("Error fetching Department data:", error);
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

  // Fetch Entity data from the server
  const fetchEmpType = async () => {
    try {
      const response = await axios.get("/api/employee/getEmpType");
      console.log(response);
      const formattedEmpTypeData = [
        { value: "ALL", label: "Select All Emp.Types" },
        ...response.data.map((item) => ({
          value: item.emp_type_code,
          label: item.emp_type_desc,
        })),
      ];
      console.log("formated options:", formattedEmpTypeData);
      setEmpType(formattedEmpTypeData);
      console.log("options:", empType);
    } catch (error) {
      console.error("Error fetching Emp Type data:", error);
    }
  };

  // Load all data on component mount
  useEffect(() => {
    fetchEmpType();
    fetchBUData();
    fetchLocCodeData();
    fetchContractorData();
    fetchDeptData();
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

  // Filter options based on search term
  const filteredLocCodeOptions = locCode.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper function to handle "Select All" logic
  const handleSelectAll = (options, selectedOptions, setSelectedOptions) => {
    const isAllSelected = selectedOptions.some(
      (option) => option.value === "ALL"
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

  const handlePrint = async () => {
    try {
      const selectedContractorValues = selectedContractor.map(
        (option) => option.value
      );
      const selectedBUValues = selectedBU.map((option) => option.value);
      const selectedEntityValues = selectedEntity.map((option) => option.value);
      const selectedLocCodeValues = selectedLocCode.map(
        (option) => option.value
      );
      const selectedDepartmentValues = selectedDepartment.map(
        (option) => option.value
      );
      const selectedEmpTypeValues = selectedEmpType.map(
        (option) => option.value
      );
      console.log("Selected Contractors:", selectedContractorValues);

      const data = {
        contractor: selectedContractorValues,
        bu: selectedBUValues,
        locCode: selectedLocCodeValues,
        entity: selectedEntityValues,
        department: selectedDepartmentValues,
        from_date: fromDate,
        to_date: toDate,
        emp_type: selectedEmpTypeValues, // Employee Type
        emp_id: emp_id,
        token: token,
      };

      if (outputType == "PDF") {
        await printMonthlyAtndSheet(data, {
          headers: { "Content-Type": "application/json" },
        });
        alert("Attendance printed successfully!");
      } else {
        await exportMnthAtndToXLS(data, {
          headers: { "Content-Type": "application/json" },
        });
        alert("Attendance printed successfully!");
      }
    } catch (error) {
      console.error("Error printing attendance:", error);
      alert("Failed to print attendance. Please try again.");
    }
  };

  return (
    <div>
      <div>
        <br></br>
      </div>
      <div className={styles.container}>
        <h2 className={styles.heading}>Monthly Attendance Sheet</h2>
        <form>
          {/* Date inputs */}
          <div className={styles.formGroup}>
            <label>From Date:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>To Date:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              required
            />
          </div>

          {/* Employee Type Dropdown */}
          <div>
            <label>Employee Type:</label>
            <Select
              isMulti
              options={empType}
              value={selectedEmpType}
              onChange={(selectedOptions) =>
                customHandleChange(empType, selectedOptions, setSelectedEmpType)
              }
              components={{ Option: CustomOption }}
              placeholder="Select Employee Type"
              styles={customStyles}
              closeMenuOnSelect={false}
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
                customHandleChange(
                  contractor,
                  selectedOptions,
                  setSelectedContractor
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
            <label>Location:</label>
            <Select
              isMulti
              options={filteredLocCodeOptions} // Filtered options based on the search input
              value={selectedLocCode}
              onInputChange={(inputValue) => setSearchTerm(inputValue)} // Update search term
              onChange={(selectedOptions) =>
                customHandleChange(locCode, selectedOptions, setSelectedLocCode)
              }
              components={{
                Option: CustomOption,
                MenuList: (props) => (
                  <>
                    {/* Conditionally render "Select All Filtered" */}
                    {props.selectProps.inputValue && (
                      <SelectAllOption
                        selectAllFiltered={() =>
                          handleSelectAllFiltered(filteredLocCodeOptions)
                        }
                      />
                    )}
                    {/* Render all other options */}
                    <components.MenuList {...props} />
                  </>
                ),
              }}
              placeholder="Select Locations"
              styles={customStyles}
              closeMenuOnSelect={false}
              className={styles.selectContainer}
            />
          </div>

          <div>
            <label>Business Unit (BU):</label>
            <Select
              isMulti
              options={bu}
              value={selectedBU}
              onChange={(selectedOptions) =>
                customHandleChange(bu, selectedOptions, setSelectedBU)
              }
              components={{ Option: CustomOption }}
              placeholder="Select Business Units"
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
                customHandleChange(entity, selectedOptions, setSelectedEntity)
              }
              components={{ Option: CustomOption }}
              placeholder="Select Entities"
              styles={customStyles}
              closeMenuOnSelect={false}
              className={styles.selectContainer}
            />
          </div>

          <div>
            <label>Department:</label>
            <Select
              isMulti
              options={department}
              value={selectedDepartment}
              onChange={(selectedOptions) =>
                customHandleChange(
                  department,
                  selectedOptions,
                  setSelectedDepartment
                )
              }
              components={{ Option: CustomOption }}
              placeholder="Select Departments"
              styles={customStyles}
              closeMenuOnSelect={false}
              className={styles.selectContainer}
            />
          </div>

          <div>
            <br></br>
          </div>
          {/* Output Type Dropdown */}
          <div className={styles.formGroup}>
            <label>Output Type:</label>
            <select
              value={outputType}
              onChange={(e) => setOutputType(e.target.value)}
              required
            >
              <option value="PDF">PDF Format</option>
              <option value="XLS">XLS Format</option>
            </select>
          </div>

          <div className={styles.buttonContainer}>
            <button
              type="button"
              className={styles.button}
              onClick={handlePrint}
            >
              Print Muster
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MonthlyAtndSheet;
