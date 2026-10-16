import React, { useState, useEffect, useRef } from "react";
import MainScreen from "../../components/MainScreen";
import { Table, Button, Row, Col, Form, Alert, Modal } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { registerEmployee, selectUser } from "../../features/userSlice";
import Loading from "../../components/Loading";
import ErrorMessage from "../../components/ErrorMessage";
import "./Employee.css";
import axios from "../../api/axios.js";
import "./Paginated1.css";
import "./Paginated2.css";
import { downloadWorkbook } from "../../utils/exportWorkbook.js";

const ManageEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [errors, setErrors] = useState({}); // State for errors
  const [formData, setFormData] = useState([]);
  const [error1, setError] = useState("");
  const [showAdharPopup, setShowAdharPopup] = useState(false);
  const [showPannoPopup, setShowPannoPopup] = useState(false);
  const [adharDetails, setAdharDetails] = useState(null);
  const [pannoDetails, setpannoDetails] = useState(null);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneOffset = new Date().getTimezoneOffset();
  const timezoneOffsetInHours = timezoneOffset / 60;

  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const gridRef = useRef(null); // Add this at the top
  const display_nameRef = useRef(null);
  const Adhar_NoRef = useRef(null);
  const pannoRef = useRef(null);
  const design_codeRef = useRef(null);
  const payment_modeRef = useRef(null);
  const BillingTypeRef = useRef(null);
  const local_addressRef = useRef(null);
  const local_cityRef = useRef(null);
  const local_stateRef = useRef(null);
  const local_pinRef = useRef(null);
  const pmt_addressRef = useRef(null);
  const pmt_cityRef = useRef(null);
  const pmt_stateRef = useRef(null);
  const pmt_pinRef = useRef(null);
  const deptRef = useRef(null);
  const buRef = useRef(null);
  const contractor_idRef = useRef(null);
  const CasteRef = useRef(null);
  const DivisionRef = useRef(null);
  const ReligionRef = useRef(null);
  const Blood_GroupRef = useRef(null);
  const contact_noRef = useRef(null);
  const NationalityRef = useRef(null);
  const Marital_StatusRef = useRef(null);
  const HandicapRef = useRef(null);
  const handicap_detailsRef = useRef(null);
  const medical_statusRef = useRef(null);
  const wage_typeRef = useRef(null);
  const ot_factorRef = useRef(null);
  const entity_codeRef = useRef(null);
  const Father_Husband_NameRef = useRef(null);
  const GenderRef = useRef(null);
  const Is_ActiveRef = useRef(null);
  const blacklistedRef = useRef(null);
  const blacklisted_reasonRef = useRef(null);
  const EmpTypeRef = useRef(null);
  const emp_category_codeRef = useRef(null);
  const loc_codeRef = useRef(null);
  const cost_codeRef = useRef(null);
  const levelRef = useRef(null);

  const dojRef = useRef(null);
  const Dateof_BirthRef = useRef(null);
  const bank_codeRef = useRef(null);
  const bank_account_noRef = useRef(null);
  const ifsc_codeRef = useRef(null);

  // Dropdown data states
  const [salutationList, setSalutationList] = useState([]);
  const [genderList, setGenderList] = useState([]);
  const [nationalityList, setNationalityList] = useState([]);
  const [religionList, setReligionList] = useState([]);
  const [castList, setCastList] = useState([]);
  const [bloodGroupList, setBloodGroupList] = useState([]);
  const [skillCategoryList, setSkillCategoryList] = useState([]);
  const [maritalStatusList, setMaritalStatusList] = useState([]);
  const [billingTypeList, setBillingTypeList] = useState([]);
  const [designationList, setdesignationList] = useState([]);
  const [sectionList, setsectionList] = useState([]);
  const [divisionList, setdivisionList] = useState([]);
  const [entityList, setentityList] = useState([]);
  const [contractorList, setcontractorList] = useState([]);
  const [deptList, setdeptList] = useState([]);
  const [buList, setbuList] = useState([]);
  const [empTypeList, setEmpTypeList] = useState([]);

  const [emp_category_codeList, setemp_category_codeList] = useState([]);
  const [loc_codeList, setloc_codeList] = useState([]);
  const [cost_codeList, setcost_codeList] = useState([]);
  const [levelList, setLevelList] = useState([]);

  const [bankMastList, setBankMastList] = useState([]);
  const [stateMastList, setStateMastList] = useState([]);
  const [cityMastList, setCityMastList] = useState([]);
  const [successMessage, setSuccessMessage] = useState(""); // Tracks success message
  const today = new Date(); // Current date
  const birthDate = new Date(formData.Dateof_Birth); // Date of birth from form
  const employeeIdRef = useRef(null); // Ref for Employee_Code input field

  const autoGrow = (e) => {
    const el = e.target;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  useEffect(() => {
    fetchDropdownData();
    fetchEmployees();
  }, []);

  useEffect(() => {
    const filtered = employees.filter((employee) => {
      const { Employee_Code, display_name, contact_no, Adhar_No, panno } =
        employee;

      return (
        (display_name &&
          display_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (Employee_Code &&
          Employee_Code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (Adhar_No &&
          Adhar_No.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (panno && panno.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (contact_no &&
          contact_no.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    });

    setFilteredEmployees(filtered);
  }, [searchTerm, employees]);
  useEffect(() => {
    console.log("Updated error1 state:", error1);
  }, [error1]);

  useEffect(() => {
    const fetchAdharDetails = async () => {
      const adharNo = formData.Adhar_No;

      if (adharNo && adharNo.length === 12) {
        try {
          const response = await axios.post("/api/employee/getByAdhar", {
            Adhar_No: adharNo,
          });
          if (response.data) {
            setAdharDetails(response.data[0]); // Set fetched details
            console.log(response.data[0]);
            console.log("Adhar Ddetails", adharDetails);
            setShowAdharPopup(true); // Show the modal
          } else {
            setAdharDetails(null); // Clear any existing details
            setShowAdharPopup(false);
          }
        } catch (error) {
          console.error("Error fetching Adhar details:", error);
          alert("Failed to fetch details. Please try again.");
        }
      } else {
        setShowAdharPopup(false);
        setAdharDetails(null); // Clear modal if the field is empty
      }
    };
    const fetchpannoDetails = async () => {
      const panNo = formData.panno;

      if (panNo && panNo.length === 12) {
        try {
          const response = await axios.post("/api/employee/getByPanno", {
            panno: panNo,
          });
          if (response.data) {
            setAdharDetails(response.data[0]); // Set fetched details
            console.log(response.data[0]);
            console.log("PAN Ddetails", adharDetails);
            setShowPannoPopup(true); // Show the modal
          } else {
            setpannoDetails(null); // Clear any existing details
            setShowPannoPopup(false);
          }
        } catch (error) {
          console.error("Error fetching PAN details:", error);
          alert("Failed to fetch details. Please try again.");
        }
      } else {
        setShowPannoPopup(false);
        setpannoDetails(null); // Clear modal if the field is empty
      }
    };

    fetchAdharDetails();
    fetchpannoDetails();
  }, [formData.Adhar_No]); // Dependency on Adhar_No

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/employee/getAllEmployees"); // Adjust URL as per your backend API
      console.log("API response:", response.data); // Log the response data
      const employeesData = Array.isArray(response.data)
        ? response.data
        : [response.data];
      setEmployees(employeesData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching employees:", error);
      setLoading(false);
      // Handle error state as needed
    }
  };

  // Fetching dropdown data from APIs
  const fetchDropdownData = async () => {
    try {
      const [
        salutationRes,
        genderRes,
        nationalityRes,
        religionRes,
        castRes,
        bloodGroupRes,
        skillCategoryRes,
        maritalStatusRes,
        billingTypeRes,
        designationRes,
        sectionRes,
        divisioRes,
        entityRes,
        buRes,
        deptRes,
        contractorRes,
        empTypeRes,
        emp_category_codeRes,
        loc_codeRes,
        cost_codeRes,
        levelRes,
        bankMastRes,
        stateMastRes,
        cityMastRes,
      ] = await Promise.all([
        axios.get("/api/employee/getSalutation"),
        axios.get("/api/employee/getGender"),
        axios.get("/api/employee/getNationality"),
        axios.get("/api/employee/getReligion"),
        axios.get("/api/employee/getCast"),
        axios.get("/api/employee/getBloodGroup"),
        axios.get("/api/employee/getSkillCategory"),
        axios.get("/api/employee/getMaritalStatus"),
        axios.get("/api/employee/getBillingType"),
        axios.get("/api/employee/getAllDesignation"),
        axios.get("/api/employee/getSection"),
        axios.post("/api/entity/getAllDivision"),
        axios.get("/api/entity/"),
        axios.post("/api/entity/getAllBU"),
        axios.post("/api/entity/getAllDept"),
        axios.get("/api/contractor/getAllContractors"),
        axios.get("/api/employee/getEmpType"),
        axios.post("/api/employee/getEmpCategory"),
        axios.post("/api/employee/getLocCode"),
        axios.post("/api/entity/getCostCode"),
        axios.post("/api/employee/getLevel"),

        axios.get("/api/employee/getBankMast"),
        axios.get("/api/employee/getStateMast"),
        axios.get("/api/employee/getCityMast"),
      ]);
      setSalutationList(salutationRes.data);
      setGenderList(genderRes.data);
      setNationalityList(nationalityRes.data);
      setReligionList(religionRes.data);
      setCastList(castRes.data);
      setBloodGroupList(bloodGroupRes.data);
      setSkillCategoryList(skillCategoryRes.data);
      setMaritalStatusList(maritalStatusRes.data);
      setBillingTypeList(billingTypeRes.data);
      setdesignationList(designationRes.data);
      setsectionList(sectionRes.data);
      setdivisionList(divisioRes.data);
      setentityList(entityRes.data);
      setcontractorList(contractorRes.data);
      setdeptList(deptRes.data);
      setbuList(buRes.data);
      setEmpTypeList(empTypeRes.data);
      setemp_category_codeList(emp_category_codeRes.data);
      setloc_codeList(loc_codeRes.data);
      setcost_codeList(cost_codeRes.data);
      setLevelList(levelRes.data);

      setBankMastList(bankMastRes.data);
      setStateMastList(stateMastRes.data);
      setCityMastList(cityMastRes.data);
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
    }
  };

  const handleAddNewRecord = () => {
    setSelectedEmployee(null); // Reset form
    clearForm();
    employeeIdRef.current.focus(); // Set focus on Employee_Code input field
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1); // Reset to first page when items per page change
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    const formattedDate = now.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
    return formattedDate + "Z";
  };
  const formatDateTimeForInput = (dateTime) => {
    const date = new Date(dateTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  const convertLocalTimeToUTC = (localDateTime) => {
    const localDate = new Date(localDateTime);
    return localDate.toISOString();
  };
  // Function to convert UTC datetime to local time
  const convertUTCToLocalTime = (utcDateTime) => {
    const localDate = new Date(utcDateTime);
    return localDate.toLocaleString();
  };
  const clearForm = () => {
    setFormData({
      Employee_Code: "",
      First_Name: "",
      Middle_Name: "",
      Last_Name: "",
      Nick_Name: "",
      Father_Husband_Name: "",
      Salutation: "",
      Gender: "",
      Dateof_Birth: "",
      Dateof_Birth_Actual: "",
      Placeof_Birth: "",
      Nationality: "",
      Religion: "",
      Caste: "",
      Language: "",
      Blood_Group: "",
      Marital_Status: "",
      Wedding_Anniversary: "",
      Handicap: "",
      handicap_details: "",
      Smoker: "",
      Is_Active: "",
      blacklisted: "",
      blacklisted_reason: "",
      Adhar_No: "",
      Adhar_Name: "",
      panno: "",
      Hobbies: "",
      Modified_By: "",
      Modified_Date: "",
      EmpTag: "",
      BillingType: "",
      dept: "",
      bu: "",
      division: "",
      contractor_id: "",
      pfno: "",
      uanno: "",
      esino: "",
      skill_category: "",
      contact_no: "",
      doj: "",
      doj_group: "",
      display_name: "",
      payment_mode: "",
      bank_code: "",
      bank_account_no: "",
      ifsc_code: "",
      design_code: "",
      section: "",
      entity_code: "",
      local_address: "",
      local_city: "",
      local_state: "",
      local_pin: "",
      pmt_address: "",
      pmt_city: "",
      pmt_state: "",
      pmt_pin: "",
      medical_status: "",
      wage_type: "",
      ot_factor: "0.00",
      emp_type: "",
      inactive_date: "",
      loc_code: "",
      cost_code: "",
      level: "",
      emp_category_code: "",
    });
  };

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  /*--
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue;

    if (type === "checkbox") {
      finalValue = checked;
    } else {
      finalValue = value === "" ? null : value;
      // Make Employee_Code uppercase
      if (name === "Employee_Code" && finalValue) {
        finalValue = finalValue.toUpperCase();
      }
    }

    setFormData((prevFormData) => ({
      ...prevFormData,
      [name]: finalValue,
    }));
  };
  ---*/

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue;

    // 🔹 Handle checkbox
    if (type === "checkbox") {
      finalValue = checked;
    } else {
      finalValue = value === "" ? null : value;

      // 🔹 Uppercase logic
      if (name === "Employee_Code" && finalValue) {
        finalValue = finalValue.toUpperCase();
      }
    }

    setFormData((prevFormData) => {
      let updated = {
        ...prevFormData,
        [name]: finalValue,
      };

      // 🔥 Handicap logic (core requirement)
      if (name === "Handicap") {
        if (finalValue === "N") {
          // Clear details when NO
          updated.handicap_details = null;
        }
      }

      return updated;
    });
  };

  // Validation function
  const validateForm = () => {
    const newErrors = {};

    if (!formData.Employee_Code) {
      newErrors.Employee_Code = "Employee Code is required.";
      employeeIdRef.current.focus();
    }
    if (!formData.display_name) {
      newErrors.display_name = "Display Name is required.";
      display_nameRef.current.focus();
    }
    if (!formData.Adhar_No) {
      newErrors.Adhar_No = "Adhar Number is required.";
      Adhar_NoRef.current.focus();
    } else if (
      formData.Adhar_No.length !== 12 ||
      !/^\d{12}$/.test(formData.Adhar_No)
    ) {
      newErrors.Adhar_No = "Adhar Number must be exactly 12 digits.";
      Adhar_NoRef.current.focus();
    }
    if (!formData.panno) {
      newErrors.panno = "PAN Number is required.";
      pannoRef.current.focus();
    } else if (formData.panno.length !== 10) {
      newErrors.panno = "PAN Number must be exactly 10 digits.";
      pannoRef.current.focus();
    }

    if (!formData.design_code) {
      newErrors.design_code = "Designation is required.";
      design_codeRef.current.focus();
    }
    if (!formData.dept) {
      newErrors.dept = "Department is required.";
      deptRef.current.focus();
    }
    if (!formData.bu) {
      newErrors.bu = "Business Unit is required.";
      buRef.current.focus();
    }
    if (!formData.division) {
      newErrors.division = "Division is required.";
      DivisionRef.current.focus();
    }
    if (!formData.contractor_id) {
      newErrors.contractor_id = "contractor is required.";
      contractor_idRef.current.focus();
    }

    // Check if Date of Birth is empty
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age--;
    }
    if (!formData.Dateof_Birth) {
      newErrors.Dateof_Birth = "Date of Birth is required.";
      Dateof_BirthRef.current.focus();
    } else if (age < 18) {
      // Check if age is less than 18 years
      newErrors.Dateof_Birth = "Employee must be at least 18 years old.";
      Dateof_BirthRef.current.focus();
    } else if (age > 60) {
      // Check if age is more than 58 years
      newErrors.Dateof_Birth = "Employee must be less than 58 years old.";
      Dateof_BirthRef.current.focus();
    }

    if (!formData.payment_mode) {
      newErrors.payment_mode = "Payment Mode is required.";
      payment_modeRef.current.focus();
    }
    if (!formData.BillingType) {
      newErrors.BillingType = "Billing Type is required.";
      BillingTypeRef.current.focus();
    }
    if (!formData.local_address) {
      newErrors.local_address = "Local Address is required.";
      local_addressRef.current.focus();
    }
    if (!formData.local_city) {
      newErrors.local_city = "Local City is required.";
      local_cityRef.current.focus();
    }
    if (!formData.local_state) {
      newErrors.local_state = "Local State is required.";
      local_stateRef.current.focus();
    }
    if (!formData.local_pin) {
      newErrors.local_pin = "Local PIN is required.";
      local_pinRef.current.focus();
    }
    if (!formData.pmt_address) {
      newErrors.pmt_address = "Permanent Address is required.";
      pmt_addressRef.current.focus();
    }
    if (!formData.pmt_city) {
      newErrors.pmt_city = "Permanent City is required.";
      pmt_cityRef.current.focus();
    }
    if (!formData.pmt_state) {
      newErrors.pmt_state = "Permanent State is required.";
      pmt_stateRef.current.focus();
    }
    if (!formData.pmt_pin) {
      newErrors.pmt_pin = "Local PIN is required.";
      pmt_pinRef.current.focus();
    }

    if (!formData.Religion) {
      newErrors.Religion = "Religion is required.";
      ReligionRef.current.focus();
    }
    if (!formData.Caste) {
      newErrors.Caste = "Caste is required.";
      CasteRef.current.focus();
    }
    if (!formData.Nationality) {
      newErrors.Nationality = "Nationality is required.";
      NationalityRef.current.focus();
    }
    if (!formData.Marital_Status) {
      newErrors.Marital_Status = "Marital Status is required.";
      Marital_StatusRef.current.focus();
    }
    if (!formData.Handicap) {
      newErrors.Handicap = "Handicap Status is required.";
      HandicapRef.current.focus();
    }

    if (formData.Handicap === "Y" && !formData.handicap_details?.trim()) {
      newErrors.handicap_details = "Handicap details required.";
      handicap_detailsRef.current.focus();
    }

    if (!formData.medical_status) {
      newErrors.medical_status = "Medical Status is required.";
      medical_statusRef.current.focus();
    }
    if (!formData.wage_type) {
      newErrors.wage_type = "wage_type is required.";
      wage_typeRef.current.focus();
    }
    if (
      formData.ot_factor !== null &&
      formData.ot_factor !== "" &&
      (Number.isNaN(Number(formData.ot_factor)) ||
        Number(formData.ot_factor) < 0 ||
        Number(formData.ot_factor) > 99999999.99)
    ) {
      newErrors.ot_factor =
        "OT Factor must be a number between 0 and 99999999.99.";
      ot_factorRef.current?.focus();
    }
    if (!formData.entity_code) {
      newErrors.entity_code = "Entity Code is required.";
      entity_codeRef.current.focus();
    }
    if (!formData.Father_Husband_Name) {
      newErrors.Father_Husband_Name = "Father/Husband Name is required.";
      Father_Husband_NameRef.current.focus();
    }
    if (!formData.Gender) {
      newErrors.Gender = "Gender is required.";
      GenderRef.current.focus();
    }
    /*
    if (!formData.Blood_Group) {
      newErrors.Blood_Group = "Blood Group is required.";
      Blood_GroupRef.current.focus();
    }
    */
    // Adjust age calculation if current month and day are before the birth month/day
    if (!formData.doj) {
      newErrors.doj = "Date of Joining is required.";
      dojRef.current.focus();
    }
    if (!formData.contact_no) {
      newErrors.contact_no = "Contact Number is required.";
      contact_noRef.current.focus();
    }

    if (!formData.Is_Active) {
      newErrors.Is_Active = "Active or Not Active Status is required.";
      Is_ActiveRef.current.focus();
    }
    if (!formData.emp_type) {
      newErrors.emp_type = "Employee Type is required.";
      EmpTypeRef.current.focus();
    }
    if (!formData.emp_category_code) {
      newErrors.emp_category_code = "Employee Category is required.";
      emp_category_codeRef.current.focus();
    }
    if (!formData.loc_code) {
      newErrors.loc_code = "Employee Location is required.";
      loc_codeRef.current.focus();
    }
    if (!formData.cost_code) {
      newErrors.cost_code = "Employee Cost Code is required.";
      cost_codeRef.current.focus();
    }
    if (!formData.level) {
      newErrors.level = "Employee Level is required.";
      levelRef.current.focus();
    }

    // Additional validation if the payment mode is 'Bank'
    if (formData.payment_mode === "Bank") {
      if (!formData.bank_code) {
        newErrors.bank_code = "Bank Name is required.";
        bank_codeRef.current.focus();
      }
      if (!formData.bank_account_no) {
        newErrors.bank_account_no = "Bank Account Number is required.";
        bank_account_noRef.current.focus();
      } else if (!/^\d{9,18}$/.test(formData.bank_account_no)) {
        newErrors.bank_account_no =
          "Bank Account Number must be between 9 to 18 digits.";
        bank_account_noRef.current.focus();
      }
      if (!formData.ifsc_code) {
        newErrors.ifsc_code = "IFSC Code is required.";
        ifsc_codeRef.current.focus();
      } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifsc_code)) {
        newErrors.ifsc_code = "Enter a valid IFSC Code (e.g., ABCD0123456).";
        ifsc_codeRef.current.focus();
      }
    }
    // Add more validation rules as needed
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submitHandler = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      setMessage("Please fix the validation errors before submitting.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const updatedFormData = {
        ...formData,
      };

      let result;
      if (selectedEmployee) {
        const localDate = new Date(); // Assuming this is the local date you want to store
        const utcDate = convertLocalTimeToUTC(localDate);
        const tmp_date = formatDateTimeForInput(new Date());
        const utcDateFromBackend = "2024-06-18T12:31:34.945Z";
        const localDateForDisplay = convertUTCToLocalTime(utcDateFromBackend);
        const updatedFormData1 = {
          ...updatedFormData,
          Dateof_Birth: updatedFormData.Dateof_Birth
            ? formatDateForInput(updatedFormData.Dateof_Birth)
            : null,
          Dateof_Birth_Actual: updatedFormData.Dateof_Birth_Actual
            ? formatDateForInput(updatedFormData.Dateof_Birth_Actual)
            : null,
          Modified_By: emp_id,
          bank_code: updatedFormData.bank_code
            ? updatedFormData.bank_code
            : null,
          Modified_Date: formatDateTimeForInput(new Date()),
          Wedding_Anniversary: updatedFormData.Wedding_Anniversary
            ? formatDateForInput(updatedFormData.Wedding_Anniversary)
            : null,
          doj: updatedFormData.doj
            ? formatDateForInput(updatedFormData.doj)
            : null,
          doj_group: updatedFormData.doj_group
            ? formatDateForInput(updatedFormData.doj_group)
            : null,
        };
        // Edit existing employee
        try {
          const response = await axios.post(
            `/api/employee/addEmployeePreapprove`,
            updatedFormData1,
          );
          if (response.status == 200) {
            setShowSuccessModal(true);
            setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
            fetchEmployees(); // Refresh the employee data
            setSelectedEmployee(null); // Reset form
            clearForm();
            // Focus on the top of the grid after form submission
            if (gridRef.current) {
              gridRef.current.focus();
            }
          } else {
            if (response.data.error.originalError.info.message) {
              setError(
                "Error adding EMPLOYEE.1" +
                  response.data.error.originalError.info.message,
              );
            } else {
              setError("Error adding EMPLOYEE at 2" + response);
            }
            setLoading(false); // Reset loading after success
          }
          setLoading(false);
          employeeIdRef.current.focus();
        } catch (err) {
          console.log("Stage--6");
          console.log(err);
          if (err.response.data.error.originalError.info.message) {
            setError(
              "Error adding Employee.3" +
                err.response.data.error.originalError.info.message,
            );
          } else {
            setError("Error adding Employee.4" + err);
          }
          setLoading(false); // Reset loading after success
          employeeIdRef.current.focus();
        }
      } else {
        // Add new employee
        const updatedFormData1 = {
          ...updatedFormData,
          Modified_By: null,
          Modified_Date: null,
          Dateof_Birth: updatedFormData.Dateof_Birth
            ? formatDateForInput(updatedFormData.Dateof_Birth)
            : null,
          Dateof_Birth_Actual: updatedFormData.Dateof_Birth_Actual
            ? formatDateForInput(updatedFormData.Dateof_Birth_Actual)
            : null,
          Created_By: emp_id,
          bank_code:
            updatedFormData.bank_code && updatedFormData.bank_code.trim() !== ""
              ? updatedFormData.bank_code
              : null,
          section:
            updatedFormData.section && updatedFormData.section.trim() !== ""
              ? updatedFormData.section
              : null,
          skill_category:
            updatedFormData.skill_category &&
            updatedFormData.skill_category.trim() !== ""
              ? updatedFormData.skill_category
              : null,
          Blood_Group:
            updatedFormData.Blood_Group &&
            updatedFormData.Blood_Group.trim() !== ""
              ? updatedFormData.Blood_Group
              : null,
          Created_Date: formatDateTimeForInput(new Date()),
          Wedding_Anniversary: updatedFormData.Wedding_Anniversary
            ? formatDateForInput(updatedFormData.Wedding_Anniversary)
            : null,
          doj: updatedFormData.doj
            ? formatDateForInput(updatedFormData.doj)
            : null,
          doj_group: updatedFormData.doj_group
            ? formatDateForInput(updatedFormData.doj_group)
            : null,
        };
        try {
          //const response = await dispatch(registerEmployee(updatedFormData1));
          const response = await axios.post(
            "/api/employee/addEmployee",
            updatedFormData1,
          );
          if (response.status == 200) {
            setShowSuccessModal(true);
            setTimeout(() => setSuccessMessage(""), 3000); // Clear message after 3 seconds
            fetchEmployees(); // Refresh the employee data
            setSelectedEmployee(null); // Reset form
            clearForm();
            // Focus on the top of the grid after form submission
            if (gridRef.current) {
              gridRef.current.focus();
            }
          } else {
            if (response.data.error.originalError.info.message) {
              setError(
                "Error adding EMPLOYEE.1" +
                  response.data.error.originalError.info.message,
              );
            } else {
              setError("Error adding EMPLOYEE at 2" + response);
            }
            setLoading(false); // Reset loading after success
          }
          setLoading(false);
          employeeIdRef.current.focus();
        } catch (err) {
          if (err.response.data.error.originalError.info.message) {
            setError(
              "Error adding Employee.3" +
                err.response.data.error.originalError.info.message,
            );
          } else {
            setError("Error adding Employee.4" + err);
          }
          setLoading(false); // Reset loading after success
          employeeIdRef.current.focus();
        }
      }
    } catch (error) {
      setShowErrorModal(true);
      console.error("Submit Error:", error);
      setError("Error adding EMPLOYEE at 5" + error);
      setLoading(false);
      employeeIdRef.current.focus();
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setErrors({}); // Clear validation errors
    setMessage(""); // Clear error message
    navigate("/manageEmployees"); // Navigate to the home route after closing the modal
  };

  const handleEmployeeClick = (employee) => {
    setErrors({}); // Clear validation errors
    setMessage(""); // Clear error message
    setFormData({
      Employee_Code: employee.Employee_Code,
      First_Name: employee.First_Name,
      Middle_Name: employee.Middle_Name,
      Last_Name: employee.Last_Name,
      Nick_Name: employee.Nick_Name,
      Father_Husband_Name: employee.Father_Husband_Name,
      Salutation: employee.Salutation,
      Gender: employee.Gender,
      Dateof_Birth: employee.Dateof_Birth ? employee.Dateof_Birth : null,
      Dateof_Birth_Actual: employee.Dateof_Birth_Actual
        ? employee.Dateof_Birth_Actual
        : null,
      Placeof_Birth: employee.Placeof_Birth,
      Nationality: employee.Nationality,
      Religion: employee.Religion,
      Caste: employee.Caste,
      Language: employee.Language,
      Blood_Group: employee.Blood_Group,
      Marital_Status: employee.Marital_Status,
      Wedding_Anniversary: employee.Wedding_Anniversary,
      Handicap: employee.Handicap,
      handicap_details: employee.handicap_details,
      Smoker: employee.Smoker,
      medical_status: employee.medical_status,
      wage_type: employee.wage_type,
      ot_factor: employee.ot_factor ?? 0,
      Is_Active: employee.Is_Active,
      blacklisted: employee.blacklisted,
      blacklisted_reason: employee.blacklisted_reason,
      Adhar_No: employee.Adhar_No,
      Adhar_Name: employee.Adhar_Name,
      panno: employee.panno,
      Hobbies: employee.Hobbies,
      Created_By: employee.Created_By,
      Created_Date: employee.Created_Date
        ? formatDateTimeForInput(employee.Created_Date)
        : "",
      Modified_By: employee.Modified_By,
      Modified_Date: employee.Modified_Date
        ? formatDateTimeForInput(employee.Modified_Date)
        : "",
      EmpTag: employee.EmpTag,
      BillingType: employee.BillingType,
      dept: employee.dept,
      bu: employee.bu,
      division: employee.division,
      contractor_id: employee.contractor_id,
      pfno: employee.pfno,
      uanno: employee.uanno,
      esino: employee.esino,
      skill_category: employee.skill_category,
      contact_no: employee.contact_no,
      doj: employee.doj,
      doj_group: employee.doj_group,
      display_name: employee.display_name,
      payment_mode: employee.payment_mode,
      bank_code: employee.bank_code,
      bank_account_no: employee.bank_account_no,
      ifsc_code: employee.ifsc_code,
      design_code: employee.design_code,
      section: employee.section,
      entity_code: employee.entity_code,
      local_address: employee.local_address,
      local_city: employee.local_city,
      local_state: employee.local_state,
      local_pin: employee.local_pin,
      pmt_address: employee.pmt_address,
      pmt_city: employee.pmt_city,
      pmt_state: employee.pmt_state,
      pmt_pin: employee.pmt_pin,
      emp_type: employee.emp_type,
      inactive_date: employee.inactive_date,
      emp_category_code: employee.emp_category_code,
      loc_code: employee.loc_code,
      cost_code: employee.cost_code,
      level: employee.level,
    });
    setSelectedEmployee(employee);
    // Use setTimeout to ensure the form is updated first, then set focus
    setTimeout(() => {
      employeeIdRef.current.focus(); // Set focus on Employee_Code input field
    }, 0);
  };

  if (!token) {
    return (
      <div>
        <p>You must be logged in to register a employee.</p>
        <button onClick={() => navigate("/")}>Go to Login</button>
      </div>
    );
  }

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredEmployees.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  const TimezoneInfo = () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezoneOffset = new Date().getTimezoneOffset();
    const timezoneOffsetInHours = timezoneOffset / 60;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB"); // 'en-GB' will format the date as dd/mm/yyyy
  };
  const formatDateForInput = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  // Function to open a new window with the not-inserted records displayed
  const openInNewWindow = (records) => {
    const newWindow = window.open("", "_blank");

    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>Not Inserted Records</title>
            <style>
              table {
                width: 100%;
                border-collapse: collapse;
              }
              th, td {
                border: 1px solid black;
                padding: 8px;
                text-align: left;
              }
              th {
                background-color: #f2f2f2;
              }
            </style>
          </head>
          <body>
            <h3>Not Inserted Records</h3>
            <table>
              <thead>
                <tr>
                  <th>Employee Code</th>
                  <th>BillingType</th>
                  <th>ProcessMonth</th>
                  <th>DedCode</th>
                  <th>DedValue</th>
                  <th>Remarks</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                ${records
                  .map(
                    (record) => `
                  <tr>
                    <td>${record.employee_code}</td>
                    <td>${record.billingType}</td>
                    <td>${record.pmonth}</td>
                    <td>${record.dedCode}</td>
                    <td>${record.dedValue}</td>
                    <td>${record.remarks}</td>
                    <td>${record.result}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </body>
        </html>
      `);
      newWindow.document.close(); // Close the document after writing to it
    }
  };

  return (
    <MainScreen
      scope="legacy-paginated"
      title={<span className="main-screen-title">Manage Employees</span>}
    >
      <div className="employee-list">
        <div ref={gridRef} tabIndex="-1" style={{ outline: "none" }}></div>{" "}
        {/* Hidden focusable element */}
        <div className="Paginated1">
          <Table responsive striped bordered hover>
            <thead style={{ height: "50%", verticalAlign: "midle" }}>
              <tr>
              <td
                style={{ height: "50$", width: "5%", verticalAlign: "midle" }}
              >
                No.Records:
              </td>
              <td width={"5%"}>
                <div>
                  <Form.Control
                    as="select"
                    value={itemsPerPage}
                    onChange={handleItemsPerPageChange}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </Form.Control>
                </div>
              </td>

              <td>
                <div
                  className="pagination-buttons"
                  style={{ width: "68%", color: "lightskyblue" }}
                >
                  <Button
                    variant="secondary"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                  >
                    {"<<"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    {"<"}
                  </Button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    {">"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    {">>"}
                  </Button>
                </div>
              </td>
              <td width={"5%"}></td>
              <td>
                <Form.Control
                  type="text"
                  placeholder="Search by code/name/mob/adhar/pan"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </td>
              <td className="button-cell">
                <Button variant="primary" onClick={() => handleAddNewRecord()}>
                  Add
                </Button>
                <Button variant="secondary" onClick={() => navigate('/development/import/employees')}>Upload</Button>
                <Button variant="secondary" disabled={!filteredEmployees.length} onClick={() => downloadWorkbook({ title: 'Local employee master', rows: filteredEmployees, columns: [{key:'Employee_Code',label:'Employee_Code'},{key:'display_name',label:'display_name'},{key:'contractor_id',label:'contractor_id'},{key:'dept',label:'dept'},{key:'bu',label:'bu'},{key:'loc_code',label:'loc_code'},{key:'doj',label:'doj'}], metadata: { Search: searchTerm || 'None', Scope: 'Current filtered employees' } }, 'CLMS-employees')}>Export</Button>
              </td>
              </tr>
            </thead>
          </Table>
        </div>
        <div className="Paginated2">
          <Table responsive striped bordered hover>
            <thead>
              <tr>
                <th>Employee Code</th>
                <th>First Name</th>
                <th>Middle Name</th>
                <th>Last Name</th>
                <th>Nick Name</th>
                <th>display name</th>
                <th>doj</th>
                <th>doj group</th>
                <th>Father Husband Name</th>
                <th>Salutation</th>
                <th>Gender</th>
                <th>Dateof Birth</th>
                <th>Dateof Birth Actual</th>
                <th>Placeof Birth</th>
                <th>Nationality</th>
                <th>Religion</th>
                <th>Caste</th>
                <th>Language</th>
                <th>Blood Group</th>
                <th>Marital Status</th>
                <th>Wedding Anniversary</th>
                <th>Handicap</th>
                <th>Handicap Details</th>
                <th>Smoker</th>
                <th>Is Active</th>
                <th>Black Listed</th>
                <th>Black Listed Challan</th>
                <th>Adhar No</th>
                <th>Adhar Name</th>
                <th>PAN No</th>
                <th>Hobbies</th>
                <th>Created By</th>
                <th>Created Date</th>
                <th>Modified By</th>
                <th>Modified Date</th>
                <th>EmpTag</th>
                <th>BillingType</th>
                <th>dept</th>
                <th>bu</th>
                <th>division</th>
                <th>contractor id</th>
                <th>pfno</th>
                <th>uanno</th>
                <th>esino</th>
                <th>skill category</th>
                <th>contact no</th>
                {/* Add more headers as needed */}
              </tr>
            </thead>
            <tbody>
              {currentItems.map((employee) => (
                <tr key={employee.Employee_Code}>
                  <td>
                    <a href="#" onClick={() => handleEmployeeClick(employee)}>
                      {employee.Employee_Code}
                    </a>
                  </td>
                  <td> {employee.First_Name} </td>
                  <td> {employee.Middle_Name} </td>
                  <td> {employee.Last_Name} </td>
                  <td> {employee.Nick_Name} </td>
                  <td> {employee.display_name} </td>
                  <td> {employee.doj}</td>
                  <td> {employee.doj_group}</td>
                  <td> {employee.Father_Husband_Name} </td>
                  <td> {employee.Salutation} </td>
                  <td> {employee.Gender} </td>
                  <td> {employee.Dateof_Birth}</td>
                  <td> {employee.Dateof_Birth_Actual}</td>
                  <td> {employee.Placeof_Birth} </td>
                  <td> {employee.Nationality} </td>
                  <td> {employee.Religion} </td>
                  <td> {employee.Caste} </td>
                  <td> {employee.Language} </td>
                  <td> {employee.Blood_Group} </td>
                  <td> {employee.Marital_Status} </td>
                  <td> {employee.Wedding_Anniversary} </td>
                  <td> {employee.Handicap} </td>
                  <td> {employee.handicap_details} </td>
                  <td> {employee.Smoker} </td>
                  <td> {employee.Is_Active} </td>
                  <td> {employee.blacklisted} </td>
                  <td> {employee.bloacklisted_reason} </td>
                  <td> {employee.Adhar_No} </td>
                  <td> {employee.Adhar_Name} </td>
                  <td> {employee.panno} </td>
                  <td> {employee.Hobbies} </td>
                  <td> {employee.Created_By} </td>
                  <td> {convertUTCToLocalTime(employee.Created_Date)} </td>
                  <td> {employee.Modified_By} </td>
                  <td> {convertUTCToLocalTime(employee.Modified_Date)} </td>
                  <td> {employee.EmpTag} </td>
                  <td> {employee.BillingType} </td>
                  <td> {employee.dept} </td>
                  <td> {employee.bu} </td>
                  <td> {employee.division} </td>
                  <td> {employee.contractor_id} </td>
                  <td> {employee.pfno} </td>
                  <td> {employee.uanno} </td>
                  <td> {employee.esino} </td>
                  <td> {employee.skill_category} </td>
                  <td> {employee.contact_no} </td>
                  {/* Add more columns as needed */}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
      <div className="loginContainer">
        {error1 && <Alert variant="danger">{error1}</Alert>}
        {message && <ErrorMessage variant="danger">{message}</ErrorMessage>}
        {loading && <Loading />}
        <Form onSubmit={submitHandler}>
          <Row className="d-flex ">
            {/* Frame 1: Personal Information */}
            <Col md={4}>
              <div className="form-frame">
                <h5 className="form-section-heading">Personal Information</h5>
                {/* Employee Code */}
                <Form.Group controlId="Employee_Code" className="formGroup">
                  <Form.Label>
                    Employee Code<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="Employee_Code"
                    value={formData.Employee_Code}
                    placeholder="Enter Employee Code"
                    onChange={handleChange}
                    ref={employeeIdRef}
                    style={{ textTransform: "uppercase" }}
                  />
                  {errors.Employee_Code && (
                    <div className="error-message">{errors.Employee_Code}</div>
                  )}
                </Form.Group>

                {/* Salutation (20%) and First Name (80%) on the same line */}
                <Form.Group
                  controlId="Salutation"
                  className="formGroup"
                  style={{ flexBasis: "20%" }}
                >
                  <Form.Label>
                    Salutation<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="Salutation"
                    value={formData.Salutation || ""}
                    onChange={handleChange}
                  >
                    <option value="">Select Saluation</option>
                    {salutationList.map((item) => (
                      <option
                        key={item.salutation_code}
                        value={item.salutation_code}
                      >
                        {item.salutation_code}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
                <Form.Group controlId="display_name" className="formGroup">
                  <Form.Label>
                    Full Name<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="display_name"
                    value={formData.display_name}
                    placeholder="Enter Display Name"
                    onChange={handleChange}
                    ref={display_nameRef}
                  />
                  {errors.display_name && (
                    <div className="error-message">{errors.display_name}</div>
                  )}
                </Form.Group>
                <Form.Group
                  controlId="Father_Husband_Name"
                  className="formGroup"
                >
                  <Form.Label>
                    Father/Husband Name<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="Father_Husband_Name"
                    value={formData.Father_Husband_Name}
                    placeholder="Enter Father/Husband Name"
                    onChange={handleChange}
                    ref={Father_Husband_NameRef}
                  />
                  {errors.Father_Husband_Name && (
                    <div className="error-message">
                      {errors.Father_Husband_Name}
                    </div>
                  )}
                </Form.Group>
                <Form.Group controlId="Gender">
                  <Form.Label>
                    Gender<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="Gender"
                    value={formData.Gender || ""}
                    ref={GenderRef}
                    //onChange={handleChange}
                    onChange={(e) =>
                      setFormData({ ...formData, Gender: e.target.value })
                    }
                  >
                    <option value="">Select Gender</option>
                    {genderList.map((item) => (
                      <option key={item.gender_code} value={item.gender_code}>
                        {item.gender_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.Gender && (
                    <div className="error-message">{errors.Gender}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="Dateof_Birth" className="formGroup">
                  <Form.Label>
                    Date of Birth<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="date"
                    name="Dateof_Birth"
                    ref={Dateof_BirthRef}
                    value={
                      formData.Dateof_Birth
                        ? formatDateForInput(formData.Dateof_Birth)
                        : ""
                    }
                    placeholder="Enter Date of Birth"
                    onChange={handleChange}
                  />
                  {errors.Dateof_Birth && (
                    <div className="error-message">{errors.Dateof_Birth}</div>
                  )}
                </Form.Group>
              </div>
            </Col>
            {/* Frame 3: Employment Information */}
            <Col md={4}>
              <div className="form-frame">
                <h5 className="form-section-heading">Personal Information</h5>
                <Form.Group controlId="Nationality">
                  <Form.Label>
                    Nationality<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="Nationality"
                    value={formData.Nationality || ""}
                    onChange={handleChange}
                    ref={NationalityRef}
                  >
                    <option value="">Select Nationality</option>
                    {nationalityList.map((item) => (
                      <option
                        key={item.nationality_code}
                        value={item.nationality_code}
                      >
                        {item.nationality_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.Nationality && (
                    <div className="error-message">{errors.Nationality}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="Religion">
                  <Form.Label>
                    Religion<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="Religion"
                    value={formData.Religion || ""}
                    ref={ReligionRef}
                    onChange={(e) =>
                      setFormData({ ...formData, Religion: e.target.value })
                    }
                  >
                    <option value="">Select Religion</option>
                    {religionList.map((item) => (
                      <option
                        key={item.religion_code}
                        value={item.religion_code}
                      >
                        {item.religion_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.Religion && (
                    <div className="error-message">{errors.Religion}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="Caste">
                  <Form.Label>
                    Caste<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="Caste"
                    value={formData.Caste || ""}
                    ref={CasteRef}
                    onChange={(e) =>
                      setFormData({ ...formData, Caste: e.target.value })
                    }
                  >
                    <option value="">Select Caste</option>
                    {castList.map((item) => (
                      <option key={item.cast_code} value={item.cast_code}>
                        {item.cast_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.Caste && (
                    <div className="error-message">{errors.Caste}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="Blood_Group">
                  <Form.Label>Blood Group</Form.Label>
                  <Form.Control
                    as="select"
                    name="Blood_Group"
                    value={formData.Blood_Group || ""}
                    onChange={handleChange}
                    ref={Blood_GroupRef}
                  >
                    <option value="">Select Blood</option>
                    {bloodGroupList.map((item) => (
                      <option key={item.blood_group} value={item.blood_group}>
                        {item.blood_group}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.Blood_Group && (
                    <div className="error-message">{errors.Blood_Group}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="Handicap" className="formGroup">
                  <Form.Label>
                    Handicaped<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="Handicap"
                    value={formData.Handicap || ""}
                    onChange={handleChange}
                    ref={HandicapRef}
                  >
                    <option value="">Select Handicap Status</option>{" "}
                    {/* Optional default placeholder */}
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                  </Form.Control>
                  {errors.Handicap && (
                    <div className="error-message">{errors.Handicap}</div>
                  )}
                </Form.Group>

                <Form.Group controlId="handicap_details" className="formGroup">
                  <Form.Label>
                    Handicaped Details{" "}
                    {formData.Handicap === "Y" && (
                      <span className="mandatory">*</span>
                    )}
                  </Form.Label>

                  <Form.Control
                    as="textarea"
                    rows={1}
                    name="handicap_details"
                    value={formData.handicap_details || ""}
                    onChange={(e) => {
                      handleChange(e);
                      autoGrow(e);
                    }}
                    onFocus={autoGrow}
                    ref={handicap_detailsRef}
                    placeholder="Enter handicap details"
                    disabled={formData.Handicap !== "Y"}
                    style={{
                      overflow: "hidden",
                      resize: "none",
                      minHeight: formData.Handicap === "Y" ? "80px" : "38px",
                      transition: "all 0.2s ease",
                    }}
                  />

                  {errors.handicap_details && (
                    <div className="error-message">
                      {errors.handicap_details}
                    </div>
                  )}
                </Form.Group>

                <Form.Group controlId="Marital_Status">
                  <Form.Label>
                    Marital Status<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="Marital_Status"
                    value={formData.Marital_Status || ""}
                    ref={Marital_StatusRef}
                    onChange={handleChange}
                  >
                    <option value="">Select Marital Status</option>
                    {maritalStatusList.map((item) => (
                      <option
                        key={item.marital_status}
                        value={item.marital_status}
                      >
                        {item.marital_status}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.Marital_Status && (
                    <div className="error-message">{errors.Marital_Status}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="emp_type">
                  <Form.Label>
                    Employee Type<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="emp_type"
                    value={formData.emp_type || ""}
                    ref={EmpTypeRef}
                    onChange={handleChange}
                  >
                    <option value="">Select Emplyee Type</option>
                    {empTypeList.map((item) => (
                      <option
                        key={item.emp_type_code}
                        value={item.emp_type_code}
                      >
                        {item.emp_type_desc}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.emp_type && (
                    <div className="error-message">{errors.emp_type}</div>
                  )}
                </Form.Group>

                <Form.Group controlId="emp_category_code">
                  <Form.Label>
                    Employee Category<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="emp_category_code"
                    value={formData.emp_category_code || ""}
                    ref={emp_category_codeRef}
                    onChange={handleChange}
                  >
                    <option value="">Select Emplyee category</option>
                    {emp_category_codeList.map((item) => (
                      <option
                        key={item.emp_category_code}
                        value={item.emp_category_code}
                      >
                        {item.emp_category_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.emp_type && (
                    <div className="error-message">
                      {errors.emp_category_code}
                    </div>
                  )}
                </Form.Group>

                <Form.Group controlId="loc_code">
                  <Form.Label>
                    Employee Location<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="loc_code"
                    value={formData.loc_code || ""}
                    ref={loc_codeRef}
                    onChange={handleChange}
                  >
                    <option value="">Select Emplyee Location</option>
                    {loc_codeList.map((item) => (
                      <option key={item.loc_code} value={item.loc_code}>
                        {item.loc_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.loc_code && (
                    <div className="error-message">{errors.loc_code}</div>
                  )}
                </Form.Group>

                <Form.Group controlId="level">
                  <Form.Label>
                    Employee Level<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="level"
                    value={formData.level || ""}
                    ref={levelRef}
                    onChange={handleChange}
                  >
                    <option value="">Select Emplyee Level</option>
                    {levelList.map((item) => (
                      <option key={item.level} value={item.level}>
                        {item.level_desc}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.level && (
                    <div className="error-message">{errors.level}</div>
                  )}
                </Form.Group>
              </div>
            </Col>
            <Col md={4}>
              <div className="form-frame">
                <h5 className="form-section-heading">Statutory Information</h5>
                <Form.Group controlId="cost_code">
                  <Form.Label>
                    Cost Center<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="cost_code"
                    value={formData.cost_code || ""}
                    ref={cost_codeRef}
                    onChange={handleChange}
                  >
                    <option value="">Select Emplyee Location</option>
                    {cost_codeList.map((item) => (
                      <option key={item.cost_code} value={item.cost_code}>
                        {item.cost_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.cost_code && (
                    <div className="error-message">{errors.cost_code}</div>
                  )}
                </Form.Group>

                <Form.Group controlId="BillingType" className="formGroup">
                  <Form.Label>
                    Wage Cycle<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="BillingType"
                    value={formData.BillingType || ""}
                    onChange={handleChange}
                    ref={BillingTypeRef}
                  >
                    <option value="">Select Wage Cycle</option>
                    {billingTypeList.map((item) => (
                      <option
                        key={item.billingType_code}
                        value={item.billingtype_code}
                      >
                        {item.billingtype_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.BillingType && (
                    <div className="error-message">{errors.BillingType}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="wage_type" className="formGroup">
                  <Form.Label>
                    Wage Type<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="wage_type"
                    value={formData.wage_type || ""}
                    ref={wage_typeRef}
                    onChange={handleChange}
                  >
                    <option value="">Select Wage Type</option>{" "}
                    {/* Optional default placeholder */}
                    <option value="D">Daily Wages</option>
                    <option value="M">Monthly Wages</option>
                  </Form.Control>
                  {errors.wage_type && (
                    <div className="error-message">{errors.wage_type}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="ot_factor" className="formGroup">
                  <Form.Label>OT Factor</Form.Label>
                  <Form.Control
                    type="number"
                    name="ot_factor"
                    value={formData.ot_factor ?? ""}
                    ref={ot_factorRef}
                    onChange={handleChange}
                    min="0"
                    max="99999999.99"
                    step="0.01"
                    placeholder="Enter OT Factor"
                  />
                  {errors.ot_factor && (
                    <div className="error-message">{errors.ot_factor}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="pfno" className="formGroup">
                  <Form.Label>PF No</Form.Label>
                  <Form.Control
                    type="text"
                    name="pfno"
                    value={formData.pfno}
                    placeholder="Enter PF No"
                    onChange={handleChange}
                  />
                </Form.Group>
                <Form.Group controlId="uanno" className="formGroup">
                  <Form.Label>UAN No</Form.Label>
                  <Form.Control
                    type="text"
                    name="uanno"
                    value={formData.uanno}
                    placeholder="Enter UAN No"
                    onChange={handleChange}
                  />
                </Form.Group>
                <Form.Group controlId="esino" className="formGroup">
                  <Form.Label>ESI No</Form.Label>
                  <Form.Control
                    type="text"
                    name="esino"
                    value={formData.esino}
                    placeholder="Enter ESI No"
                    onChange={handleChange}
                  />
                </Form.Group>
                <Form.Group controlId="skill_category" className="formGroup">
                  <Form.Label>Skill Category</Form.Label>
                  <Form.Control
                    as="select"
                    name="skill_category"
                    value={formData.skill_category || ""}
                    onChange={handleChange}
                  >
                    <option value="">Select Skill Category</option>
                    {skillCategoryList.map((item) => (
                      <option
                        key={item.skill_category}
                        value={item.skill_category}
                      >
                        {item.skill_category}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
                <Form.Group controlId="contact_no" className="formGroup">
                  <Form.Label>
                    Contact No<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="contact_no"
                    value={formData.contact_no}
                    placeholder="Enter Contact No"
                    onChange={handleChange}
                    ref={contact_noRef}
                  />
                  {errors.contact_no && (
                    <div className="error-message">{errors.contact_no}</div>
                  )}
                </Form.Group>
              </div>
            </Col>
          </Row>
          <Row className="d-flex align-items-stretch">
            {/* Frame 5: Local Address */}
            <Col md={4}>
              <div className="form-frame">
                <h5 className="form-section-heading">Statutory Information</h5>
                <Form.Group controlId="Adhar_No" className="formGroup">
                  <Form.Label>
                    Adhar No<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="Adhar_No"
                    value={formData.Adhar_No}
                    placeholder="Enter Adhar No"
                    onChange={(e) =>
                      setFormData({ ...formData, Adhar_No: e.target.value })
                    }
                    ref={Adhar_NoRef}
                  />
                  {errors.Adhar_No && (
                    <div className="error-message">{errors.Adhar_No}</div>
                  )}
                </Form.Group>

                <Form.Group controlId="panno" className="formGroup">
                  <Form.Label>
                    PAN No<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="panno"
                    value={formData.panno}
                    placeholder="Enter PAN No"
                    onChange={(e) =>
                      setFormData({ ...formData, panno: e.target.value })
                    }
                    ref={pannoRef}
                  />
                  {errors.panno && (
                    <div className="error-message">{errors.panno}</div>
                  )}
                </Form.Group>

                {/*payment_mode bank_code bank_account_no */}
                <Form.Group controlId="payment_mode" className="formGroup">
                  <Form.Label>
                    Payment Mode<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="payment_mode"
                    value={formData.payment_mode || ""}
                    ref={payment_modeRef}
                    onChange={(e) =>
                      setFormData({ ...formData, payment_mode: e.target.value })
                    }
                  >
                    <option value="">Select Payment Mode</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank</option>
                    <option value="Cheque">Cheque</option>
                  </Form.Control>
                  {errors.payment_mode && (
                    <div className="error-message">{errors.payment_mode}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="bank_code" className="formGroup">
                  <Form.Label>Bank Name</Form.Label>
                  <Form.Control
                    as="select"
                    name="bank_code"
                    value={formData.bank_code || ""}
                    placeholder="Enter Bank Name"
                    onChange={handleChange}
                    ref={bank_codeRef}
                  >
                    <option value="">Select Bank Name</option>
                    {bankMastList.map((item) => (
                      <option key={item.bank_code} value={item.bank_code}>
                        {item.bank_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.bank_code && (
                    <div className="error-message">{errors.bank_code}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="bank_account_no" className="formGroup">
                  <Form.Label>Bank Account</Form.Label>
                  <Form.Control
                    type="text"
                    name="bank_account_no"
                    value={formData.bank_account_no}
                    onChange={handleChange}
                    ref={bank_account_noRef}
                  ></Form.Control>
                  {errors.bank_account_no && (
                    <div className="error-message">
                      {errors.bank_account_no}
                    </div>
                  )}
                </Form.Group>

                <Form.Group controlId="ifsc_code" className="formGroup">
                  <Form.Label>IFSC Code</Form.Label>
                  <Form.Control
                    type="text"
                    name="ifsc_code"
                    value={formData.ifsc_code}
                    placeholder="Enter IFSC Code"
                    onChange={handleChange}
                    ref={ifsc_codeRef}
                  />
                  {errors.ifsc_code && (
                    <div className="error-message">{errors.ifsc_code}</div>
                  )}
                </Form.Group>
              </div>
            </Col>
            <Col md={4}>
              <div className="form-frame">
                <h5 className="form-section-heading">Employment Details</h5>
                <Form.Group controlId="designation" className="formGroup">
                  <Form.Label>
                    Designation<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="design_code"
                    value={formData.design_code || ""}
                    ref={design_codeRef}
                    onChange={(e) =>
                      setFormData({ ...formData, design_code: e.target.value })
                    }
                  >
                    <option value="">Select Designation</option>
                    {designationList.map((item) => (
                      <option key={item.design_code} value={item.design_code}>
                        {item.design_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.design_code && (
                    <div className="error-message">{errors.design_code}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="section" className="formGroup">
                  <Form.Label>Sub Dep/Section</Form.Label>
                  <Form.Control
                    as="select"
                    name="section"
                    value={formData.section || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, section: e.target.value })
                    }
                  >
                    <option value="">Select Sub Dept/Section</option>
                    {sectionList.map((item) => (
                      <option key={item.section_code} value={item.section_code}>
                        {item.section_name}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
                <Form.Group controlId="dept" className="formGroup">
                  <Form.Label>
                    Department<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="dept"
                    value={formData.dept || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, dept: e.target.value })
                    }
                    ref={deptRef}
                  >
                    <option value="">Select Dept</option>
                    {deptList.map((item) => (
                      <option key={item.dept_code} value={item.dept_code}>
                        {item.dept_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.dept && (
                    <div className="error-message">{errors.dept}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="bu" className="formGroup">
                  <Form.Label>
                    Business Unit<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="bu"
                    value={formData.bu || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, bu: e.target.value })
                    }
                    ref={buRef}
                  >
                    <option value="">Select Business Unit</option>
                    {buList.map((item) => (
                      <option key={item.bu_code} value={item.bu_code}>
                        {item.bu_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.bu && (
                    <div className="error-message">{errors.bu}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="division" className="formGroup">
                  <Form.Label>
                    Division<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="division"
                    value={formData.division || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, division: e.target.value })
                    }
                    ref={DivisionRef}
                  >
                    <option value="">Select Division</option>
                    {divisionList.map((item) => (
                      <option key={item.Div_code} value={item.Div_code}>
                        {item.div_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.division && (
                    <div className="error-message">{errors.division}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="blacklisted" className="formGroup">
                  <Form.Label>
                    BlackListed<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="blacklisted"
                    value={formData.blacklisted || ""}
                    ref={blacklistedRef}
                    onChange={handleChange}
                  >
                    <option value="">Select Blacklisted Status</option>{" "}
                    {/* Optional default placeholder */}
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                  </Form.Control>
                  {errors.blacklisted && (
                    <div className="error-message">{errors.blacklisted}</div>
                  )}
                </Form.Group>
                <Form.Group
                  controlId="blacklisted_reason"
                  className="formGroup"
                >
                  <Form.Label>
                    BlackListed Reason<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    name="blacklisted_reason"
                    value={formData.blacklisted_reason || ""}
                    ref={blacklisted_reasonRef}
                    onChange={handleChange}
                    rows={2} // Adjust the number of rows for the textarea
                    placeholder="Enter the reason for blacklisting"
                  />
                  {errors.blacklisted_reason && (
                    <div className="error-message">
                      {errors.blacklisted_reason}
                    </div>
                  )}
                </Form.Group>
              </div>
            </Col>

            {/* Frame 6: Permanent Address */}
            <Col md={4}>
              <div className="form-frame">
                <h5 className="form-section-heading">Employment Details</h5>
                <Form.Group controlId="entity" className="formGroup">
                  <Form.Label>
                    Entity<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="entity_code"
                    value={formData.entity_code || ""}
                    ref={entity_codeRef}
                    onChange={(e) =>
                      setFormData({ ...formData, entity_code: e.target.value })
                    }
                  >
                    <option value="">Select Entity</option>
                    {entityList.map((item) => (
                      <option key={item.entity_code} value={item.entity_code}>
                        {item.entity_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.entity_code && (
                    <div className="error-message">{errors.entity_code}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="contractor_id" className="formGroup">
                  <Form.Label>
                    Contractor Name<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="contractor_id"
                    value={formData.contractor_id || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contractor_id: e.target.value,
                      })
                    }
                    ref={contractor_idRef}
                  >
                    <option value="">Select Contractor Name</option>
                    {contractorList.map((item) => (
                      <option
                        key={item.Contractor_ID}
                        value={item.Contractor_ID}
                      >
                        {item.Contractor_Name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.contractor_id && (
                    <div className="error-message">{errors.contractor_id}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="doj" className="formGroup">
                  <Form.Label>
                    Date of Joining<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="date"
                    name="doj"
                    value={formData.doj ? formatDateForInput(formData.doj) : ""}
                    placeholder="Enter Date of Joining"
                    onChange={handleChange}
                    ref={dojRef}
                  />
                </Form.Group>
                <Form.Group controlId="medical_status" className="formGroup">
                  <Form.Label>
                    Medical Status<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="medical_status"
                    value={formData.medical_status || ""}
                    ref={medical_statusRef}
                    onChange={handleChange}
                  >
                    <option value="">Select Medical Status</option>{" "}
                    {/* Optional default placeholder */}
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                  </Form.Control>
                  {errors.medical_status && (
                    <div className="error-message">{errors.medical_status}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="Is_Active" className="formGroup">
                  <Form.Label>
                    Is Active<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="Is_Active"
                    value={formData.Is_Active || ""}
                    ref={Is_ActiveRef}
                    onChange={handleChange}
                  >
                    <option value="">Select Active Status</option>{" "}
                    {/* Optional default placeholder */}
                    <option value="Y">Yes</option>
                    <option value="N">No</option>
                  </Form.Control>
                  {errors.Is_Active && (
                    <div className="error-message">{errors.Is_Active}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="inactive_date" className="formGroup">
                  <Form.Label>InActivation Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="inactive_date"
                    value={
                      formData.inactive_date
                        ? formatDateForInput(formData.inactive_date)
                        : ""
                    }
                    placeholder="Enter InActivation Date"
                    onChange={handleChange}
                  />
                </Form.Group>
              </div>
            </Col>
          </Row>
          <Row className="d-flex align-items-stretch">
            <Col md={4}>
              <div className="form-frame">
                <h5 className="form-section-heading">Local Address</h5>
                <Form.Group controlId="local_address" className="formGroup">
                  <Form.Label>
                    Local Address<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="local_address"
                    value={formData.local_address}
                    onChange={handleChange}
                    ref={local_addressRef}
                  />
                  {errors.local_address && (
                    <div className="error-message">{errors.local_address}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="local_city" className="formGroup">
                  <Form.Label>
                    City<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="local_city"
                    value={formData.local_city || ""}
                    onChange={handleChange}
                    ref={local_cityRef}
                  >
                    <option value="">Select City</option>
                    {cityMastList.map((item) => (
                      <option key={item.city_code} value={item.city_code}>
                        {item.state_code}-{item.city_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.local_city && (
                    <div className="error-message">{errors.local_city}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="local_state" className="formGroup">
                  <Form.Label>
                    State<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="local_state"
                    value={formData.local_state || ""}
                    onChange={handleChange}
                    ref={local_stateRef}
                  >
                    <option value="">Select State</option>
                    {stateMastList.map((item) => (
                      <option key={item.state_code} value={item.state_code}>
                        {item.state_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.local_state && (
                    <div className="error-message">{errors.local_state}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="local_pin" className="formGroup">
                  <Form.Label>
                    PIN<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="local_pin"
                    value={formData.local_pin || ""}
                    onChange={handleChange}
                    ref={local_pinRef}
                  />
                  {errors.local_pin && (
                    <div className="error-message">{errors.local_pin}</div>
                  )}
                </Form.Group>
              </div>
            </Col>
            <Col md={4}>
              <div className="form-frame">
                <h5 className="form-section-heading">Permanent Address</h5>
                <Form.Group controlId="pmt_address" className="formGroup">
                  <Form.Label>
                    Address<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="pmt_address"
                    value={formData.pmt_address}
                    onChange={handleChange}
                    ref={pmt_addressRef}
                  />
                  {errors.pmt_address && (
                    <div className="error-message">{errors.pmt_address}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="pmt_city" className="formGroup">
                  <Form.Label>
                    City<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="pmt_city"
                    value={formData.pmt_city || ""}
                    onChange={handleChange}
                    ref={pmt_cityRef}
                  >
                    <option value="">Select City</option>
                    {cityMastList.map((item) => (
                      <option key={item.city_code} value={item.city_code}>
                        {item.state_code}-{item.city_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.pmt_city && (
                    <div className="error-message">{errors.pmt_city}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="pmt_state" className="formGroup">
                  <Form.Label>
                    State<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    as="select"
                    name="pmt_state"
                    value={formData.pmt_state || ""}
                    onChange={handleChange}
                    ref={pmt_stateRef}
                  >
                    <option value="">Select State</option>
                    {stateMastList.map((item) => (
                      <option key={item.state_code} value={item.state_code}>
                        {item.state_name}
                      </option>
                    ))}
                  </Form.Control>
                  {errors.pmt_state && (
                    <div className="error-message">{errors.pmt_state}</div>
                  )}
                </Form.Group>
                <Form.Group controlId="pmt_pin" className="formGroup">
                  <Form.Label>
                    PIN<span className="mandatory">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="pmt_pin"
                    value={formData.pmt_pin || ""}
                    onChange={handleChange}
                    ref={pmt_pinRef}
                  />
                  {errors.pmt_pin && (
                    <div className="error-message">{errors.pmt_pin}</div>
                  )}
                </Form.Group>
              </div>
            </Col>
            <Col md={4}>
              <div className="form-frame">
                <Form.Group controlId="Created_By" className="formGroup">
                  <Form.Label>Created By</Form.Label>
                  <Form.Control
                    type="text"
                    name="Created_By"
                    value={formData.Created_By}
                    readOnly
                  />
                </Form.Group>
                <Form.Group controlId="Created_Date" className="formGroup">
                  <Form.Label>Created Date</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    name="Created_Date"
                    value={
                      formData.Created_Date
                        ? formatDateTimeForInput(formData.Created_Date)
                        : ""
                    }
                    readOnly
                  />
                </Form.Group>
                <Form.Group controlId="Modified_By" className="formGroup">
                  <Form.Label>Modified By</Form.Label>
                  <Form.Control
                    type="text"
                    name="Modified_By"
                    value={formData.Modified_By}
                    readOnly
                  />
                </Form.Group>
                <Form.Group controlId="Modified_Date" className="formGroup">
                  <Form.Label>Modified Date</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    name="Modified_Date"
                    value={
                      formData.Modified_Date
                        ? formatDateTimeForInput(formData.Modified_Date)
                        : ""
                    }
                    readOnly
                  />
                </Form.Group>
              </div>
            </Col>
          </Row>
          {/* Submit Button */}
          <div className="submit-button">
            <Button variant="primary" type="submit">
              Submit
            </Button>
          </div>
        </Form>
      </div>

      <Modal show={showAdharPopup} onHide={() => setShowAdharPopup(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Employee Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {adharDetails ? (
            <div>
              <p>
                <strong>Adhar No:</strong> {adharDetails.Adhar_No}
              </p>
              <p>
                <strong>Name:</strong> {adharDetails.Employee_Code}-
                {adharDetails.display_name}
              </p>
              <p>
                <strong>Contractor Code:</strong> {adharDetails.contractor_id}-
                {adharDetails.Contractor_Name}
              </p>
              <p>
                <strong>Blacklisted:</strong>{" "}
                {adharDetails.blacklisted ? adharDetails.blacklisted : "N"}
              </p>
              <p>
                <strong>Is Active:</strong>{" "}
                {adharDetails.Is_Active ? adharDetails.Is_Active : "N"}
              </p>
              <p>
                <strong>Inactive Date:</strong>{" "}
                {adharDetails.inactive_date
                  ? adharDetails.inactive_date
                  : "N/A"}
              </p>
            </div>
          ) : (
            <p>No details available.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAdharPopup(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showPannoPopup} onHide={() => setShowPannoPopup(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Employee Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pannoDetails ? (
            <div>
              <p>
                <strong>PANr No:</strong> {pannoDetails.Adhar_No}
              </p>
              <p>
                <strong>Name:</strong> {pannoDetails.Employee_Code}-
                {pannoDetails.display_name}
              </p>
              <p>
                <strong>Contractor Code:</strong> {pannoDetails.contractor_id}-
                {pannoDetails.Contractor_Name}
              </p>
              <p>
                <strong>Blacklisted:</strong>{" "}
                {pannoDetails.blacklisted ? pannoDetails.blacklisted : "N"}
              </p>
              <p>
                <strong>Is Active:</strong>{" "}
                {pannoDetails.Is_Active ? pannoDetails.Is_Active : "N"}
              </p>
              <p>
                <strong>Inactive Date:</strong>{" "}
                {pannoDetails.inactive_date
                  ? pannoDetails.inactive_date
                  : "N/A"}
              </p>
            </div>
          ) : (
            <p>No details available.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPannoPopup(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showErrorModal} onHide={() => setShowErrorModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Error</Modal.Title>
        </Modal.Header>
        <Modal.Body>Unable to register</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowErrorModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showSuccessModal} onHide={handleSuccessModalClose}>
        <Modal.Header closeButton>
          <Modal.Title>Success</Modal.Title>
        </Modal.Header>
        <Modal.Body>User Registered Successfully</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleSuccessModalClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </MainScreen>
  );
};

export default ManageEmployees;
