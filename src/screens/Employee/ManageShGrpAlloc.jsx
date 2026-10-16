import React, { useState, useEffect, useRef } from "react";
import MainScreen from "../../components/MainScreen";
import { Table, Button, Row, Col, Form, Modal } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUser } from "../../features/userSlice";
import Loading from "../../components/Loading";
import ErrorMessage from "../../components/ErrorMessage";
import axios from "../../api/axios.js";
import moment from "moment";
import "./Paginated1.css";
import "./Paginated2.css";

const WEEKLY_OFF_OPTIONS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const compactFont = { fontSize: "0.78rem" };
const compactInput = { fontSize: "0.78rem", height: "28px" };

const ManageEmployees = () => {
  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();

  const employeeIdRef = useRef(null);

  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [shiftGroups, setShiftGroups] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState({
    employee_code: "",
    display_name: "",
    sh_group: "",
    weekly_off: "",
    sh_group_eff_from: "",
    created_by: "",
    created_date: "",
    modified_by: "",
    modified_date: "",
  });

  /* ===================== LOAD DATA ===================== */

  useEffect(() => {
    fetchEmployees();
    fetchShiftGroups();
  }, []);

  useEffect(() => {
    const f = employees.filter(
      (e) =>
        e.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredEmployees(f);
  }, [searchTerm, employees]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await axios.post("/api/attendance/getShGrpAlloc");
      setEmployees(res.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchShiftGroups = async () => {
    try {
      const res = await axios.get("/api/attendance/getShiftGroups");
      setShiftGroups(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  /* ===================== HANDLERS ===================== */

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const clearForm = () => {
    setFormData({
      employee_code: "",
      display_name: "",
      sh_group: "",
      weekly_off: "",
      sh_group_eff_from: "",
      created_by: "",
      created_date: "",
      modified_by: "",
      modified_date: "",
    });
  };

  const handleAddNewRecord = () => {
    clearForm();
    setSelectedEmployee(null);
    employeeIdRef.current?.focus();
  };

  const handleEmployeeClick = (emp) => {
    setSelectedEmployee(emp);
    setFormData({
      employee_code: emp.employee_code,
      display_name: emp.display_name,
      sh_group: emp.sh_group,
      weekly_off: emp.weekly_off || "",
      sh_group_eff_from: emp.sh_group_eff_from
        ? moment(emp.sh_group_eff_from).format("YYYY-MM-DD")
        : "",
      created_by: emp.created_by,
      created_date: emp.created_date,
      modified_by: emp.modified_by,
      modified_date: emp.modified_date,
    });
  };

  const validateForm = () => {
    const e = {};
    if (!formData.employee_code) e.employee_code = "Required";
    if (!formData.sh_group) e.sh_group = "Required";
    if (!formData.sh_group_eff_from) e.sh_group_eff_from = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload = {
        ...formData,
        sh_group_eff_from: formData.sh_group_eff_from,
      };

      if (selectedEmployee) {
        payload.modified_by = emp_id;
        payload.modified_date = new Date();
        await axios.put("/api/attendance/updShGrpAlloc", payload);
      } else {
        payload.created_by = emp_id;
        payload.created_date = new Date();
        await axios.post("/api/attendance/addShGrpAlloc", payload);
      }

      fetchEmployees();
      clearForm();
      setSelectedEmployee(null);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  /* ===================== PAGINATION ===================== */

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredEmployees.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  if (!token) {
    return (
      <div>
        <p>Please login</p>
        <Button onClick={() => navigate("/")}>Login</Button>
      </div>
    );
  }

  /* ===================== UI ===================== */

  return (
    <MainScreen scope="legacy-paginated" title="Manage Shift Group Allocation">
      {loading && <Loading />}
      {message && <ErrorMessage variant="danger">{message}</ErrorMessage>}

      {/* ===================== GRID HEADER ===================== */}
      <Row className="mb-2 align-items-center">
        <Col md={2}>
          <Form.Control
            as="select"
            size="sm"
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(+e.target.value)}
            style={compactInput}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </Form.Control>
        </Col>

        <Col md={6} className="text-center">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            {"<<"}
          </Button>{" "}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            {"<"}
          </Button>{" "}
          <span style={compactFont}>
            Page {currentPage} of {totalPages}
          </span>{" "}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            {">"}
          </Button>{" "}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            {">>"}
          </Button>
        </Col>

        <Col md={4}>
          <Form.Control
            size="sm"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={compactInput}
          />
        </Col>
      </Row>

      {/* ===================== GRID ===================== */}
      <Table striped bordered hover size="sm">
        <thead>
          <tr style={compactFont}>
            <th>Emp Code</th>
            <th>Name</th>
            <th>Shift Group</th>
            <th>Weekly Off</th>
            <th>Effective From</th>
          </tr>
        </thead>
        <tbody>
          {currentItems.map((e) => (
            <tr key={e.employee_code} style={compactFont}>
              <td>
                <a href="#" onClick={() => handleEmployeeClick(e)}>
                  {e.employee_code}
                </a>
              </td>
              <td>{e.display_name}</td>
              <td>{e.sh_group}</td>
              <td>{e.weekly_off}</td>
              <td>
                {e.sh_group_eff_from
                  ? moment(e.sh_group_eff_from).format("DD/MM/YYYY")
                  : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* ===================== ADD / EDIT FORM ===================== */}
      <Form onSubmit={submitHandler} className="mt-3">
        <Row>
          <Col md={3}>
            <Form.Label style={compactFont}>Employee Code</Form.Label>
            <Form.Control
              name="employee_code"
              value={formData.employee_code}
              onChange={handleChange}
              ref={employeeIdRef}
              style={compactInput}
            />
          </Col>

          <Col md={3}>
            <Form.Label style={compactFont}>Shift Group</Form.Label>
            <Form.Control
              as="select"
              name="sh_group"
              value={formData.sh_group}
              onChange={handleChange}
              style={compactInput}
            >
              <option value="">Select</option>
              {shiftGroups.map((g) => (
                <option key={g.sh_group} value={g.sh_group}>
                  {g.sh_group} - {g.timing}
                </option>
              ))}
            </Form.Control>
          </Col>

          <Col md={3}>
            <Form.Label style={compactFont}>Weekly Off</Form.Label>
            <Form.Control
              as="select"
              name="weekly_off"
              value={formData.weekly_off}
              onChange={handleChange}
              style={compactInput}
            >
              <option value="">Select</option>
              {WEEKLY_OFF_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Form.Control>
          </Col>

          <Col md={3}>
            <Form.Label style={compactFont}>Effective From</Form.Label>
            <Form.Control
              type="date"
              name="sh_group_eff_from"
              value={formData.sh_group_eff_from}
              onChange={handleChange}
              style={compactInput}
            />
          </Col>
        </Row>

        <div className="mt-3 text-end">
          <Button size="sm" variant="primary" type="submit">
            {selectedEmployee ? "Update" : "Add"}
          </Button>{" "}
          <Button size="sm" variant="secondary" onClick={handleAddNewRecord}>
            Clear
          </Button>
        </div>
      </Form>
    </MainScreen>
  );
};

export default ManageEmployees;
