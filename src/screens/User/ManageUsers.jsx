import React, { useState, useEffect, useRef } from "react";
import MainScreen from "../../components/MainScreen";
import { Table, Button, Row, Col, Form, Modal } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllUsers,
  registerUser,
  selectUser,
} from "../../features/userSlice";
import Loading from "../../components/Loading";
import ErrorMessage from "../../components/ErrorMessage";
import "./User.css";
import axios from "../../api/axios.js";
import "./Paginated1.css";
import "./Paginated2.css";

const ManageUsers = () => {
  const [Users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [errors, setErrors] = useState({}); // State for errors
  const [formData, setFormData] = useState([]);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneOffset = new Date().getTimezoneOffset();
  const timezoneOffsetInHours = timezoneOffset / 60;

  const user = useSelector(selectUser);
  const emp_id = user?.emp_id;
  const token = user?.token;
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const UserIdRef = useRef(null); // Ref for User_ID input field

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const filtered = Users.filter((User) =>
      User.Name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, Users]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/Users/getAllUsers"); // Adjust URL as per your backend API
      console.log("API response:", response.data); // Log the response data
      const UsersData = Array.isArray(response.data)
        ? response.data
        : [response.data];
      /*--raj
      // Convert date fields for each User
      const updatedUsersData = UsersData.map((User) => ({
        ...User,
        Created_Date: convertUTCToLocalTime(User.Created_Date),
        Modified_Date: convertUTCToLocalTime(User.Modified_Date),
      }));

      setUsers(updatedUsersData);
      --*/
      setUsers(UsersData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching Users:", error);
      setLoading(false);
      // Handle error state as needed
    }
  };

  const handleAddNewRecord = () => {
    setSelectedUser(null); // Reset form
    clearForm();
    UserIdRef.current.focus(); // Set focus on User_ID input field
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
      emp_id: "",
      Name: "",
      email_id: "",
      mobile_no: "",
      Created_By: "",
      Created_Date: "",
      Modified_By: "",
      Modified_Date: "",
    });
  };

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error1, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevFormData) => ({
      ...prevFormData,
      [name]: type === "checkbox" ? checked : value,
      [name]: name === 'emp_id' ? parseInt(value) : value, // Ensure emp_id is stored as an integer
  
    }));
  };
  // Validation function
  const validateForm = () => {
    const newErrors = {};

    if (!formData.emp_id) {
      newErrors.emp_id = "User ID is required.";
    }
    if (!formData.Name) {
      newErrors.User_Name = "User Name is required.";
    } else if (formData.Name.length > 50) {
      newErrors.User_Name = "User Name cannot exceed 50 characters.";
    }

    if (!selectedUser && !formData.password) {
      newErrors.password = "Password is required.";
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

    setError(false);
    setLoading(true);

    try {
      const updatedFormData = {
        ...formData,
      };

      let result;
      if (selectedUser) {
        const localDate = new Date(); // Assuming this is the local date you want to store
        console.log("Local Time:", localDate);
        console.log("Current Date Tome:", formatDateTimeForInput(new Date()));
        const utcDate = convertLocalTimeToUTC(localDate);
        console.log("UTC Time:", utcDate);

        const tmp_date = formatDateTimeForInput(new Date());
        const utcDateFromBackend = "2024-06-18T12:31:34.945Z";
        const localDateForDisplay = convertUTCToLocalTime(utcDateFromBackend);
        console.log("Local Time:", localDateForDisplay); // Display the local date

        const updatedFormData1 = {
          ...updatedFormData,
          Modified_By: emp_id,
          Modified_Date: formatDateTimeForInput(new Date()),
        };
        console.log("Time at submite-Cre:", updatedFormData1.Created_Date);
        console.log("Time at submite-Mod:", updatedFormData1.Modified_Date);
        console.log("updatedFormData1:", updatedFormData1);
        // Edit existing User
        result = await axios.put(
          `/api/Users/updateUser/${selectedUser.emp_id}`,
          updatedFormData1
        );
        console.log(result); // Will contain your API response
      } else {
        // Add new User
        const updatedFormData1 = {
          ...updatedFormData,
          Created_By: emp_id,
          Created_Date: formatDateTimeForInput(new Date()),
          Modified_By: null,
          Modified_Date: null,
        };
        result = await axios.post( `/api/Users/register`,updatedFormData1);
        //result = await dispatch(registerUser(updatedFormData1));
        console.log(result); // Will contain redux action response
      }

      if (result.data || result.payload) {
        setShowSuccessModal(true);
        fetchUsers(); // Refresh the User data
        setSelectedUser(null); // Reset form
        clearForm();
      } else if (result.error) {
        setShowErrorModal(true);
        console.error("Error:", result);
        setError(true);
        setMessage(result.error.message || "Submission failed.");
      }
      setLoading(false);
    } catch (error) {
      setShowErrorModal(true);
      console.error("Submit Error:", error);
      setError(true);
      setLoading(false);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setErrors({}); // Clear validation errors
    setMessage(""); // Clear error message
    navigate("/manageUsers"); // Navigate to the home route after closing the modal
  };

  const handleUserClick = (User) => {
    setErrors({}); // Clear validation errors
    setMessage(""); // Clear error message

    setFormData({
      emp_id: User.emp_id,
      Name: User.Name,
      email_id: User.email_id,
      password: User.password,
      mobile_no: User.mobile_no,
      Created_By: User.Created_By,
      Modified_By: User.Modified_By,
      Created_Date: formatDateTimeForInput(User.Created_Date),
      Modified_Date: formatDateTimeForInput(User.Modified_Date),
    });
    setSelectedUser(User);
  };

  if (!token) {
    return (
      <div>
        <p>You must be logged in to register a User.</p>
        <button onClick={() => navigate("/")}>Go to Login</button>
      </div>
    );
  }

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const TimezoneInfo = () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezoneOffset = new Date().getTimezoneOffset();
    const timezoneOffsetInHours = timezoneOffset / 60;
  };

  return (
    <MainScreen title="Manage Users">
      <div className="User-list">
        <div className="Paginated1">
          <Table responsive striped bordered hover>
            <thead style={{ height: "50%", verticalAlign: "midle" }}>
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
                  placeholder="Search by name"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </td>
              <td className="button-cell">
                <Button variant="primary" onClick={() => handleAddNewRecord()}>
                  Add
                </Button>
                <Button variant="secondary">Upload</Button>
                <Button variant="secondary">Export</Button>
              </td>
            </thead>
          </Table>
        </div>
        <div className="Paginated2">
          <Table responsive striped bordered hover>
            <thead>
              <tr>
                <th>User ID</th>
                <th>User Name</th>
                <th>Email ID</th>
                <th>Password</th>
                <th>Mobile No</th>
                <th>Created_By</th>
                <th>Created_Date</th>
                <th>Modified_By</th>
                <th>Modified_Date</th>
                {/* Add more headers as needed */}
              </tr>
            </thead>
            <tbody>
              {currentItems.map((User) => (
                <tr key={User.emp_id}>
                  <td>
                    <a href="#" onClick={() => handleUserClick(User)}>
                      {User.emp_id}
                    </a>
                  </td>
                  <td>{User.Name}</td>
                  <td>{User.email_id}</td>
                  <td>{User.password}</td>
                  <td>{User.mobile_no}</td>
                  <td>{User.Created_By}</td>
                  <td>
                    {User.Created_Date
                      ? convertUTCToLocalTime(User.Created_Date)
                      : ""}
                  </td>
                  <td>{User.Modified_By}</td>
                  <td>
                    {User.Modified_Date
                      ? convertUTCToLocalTime(User.Modified_Date)
                      : ""}
                  </td>
                  {/* Add more columns as needed */}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>

      <div className="loginContainer">
        {error1 && (
          <ErrorMessage variant="danger">
            Unable to Register, Please check data
          </ErrorMessage>
        )}
        {message && <ErrorMessage variant="danger">{message}</ErrorMessage>}
        {loading && <Loading />}
        <Form onSubmit={submitHandler}>
          <Form.Group controlId="emp_id" className="formGroup">
            <Form.Label>User ID</Form.Label>
            <Form.Control
              type="number"
              name="emp_id"
              value={formData.emp_id}
              placeholder="Enter User ID"
              onChange={handleChange}
              ref={UserIdRef}
            />
            {errors.User_ID && (
              <div className="error-message">{errors.User_ID}</div>
            )}
          </Form.Group>
          <Form.Group controlId="UserName" className="formGroup">
            <Form.Label>User Name</Form.Label>
            <Form.Control
              type="text"
              name="Name"
              value={formData.Name}
              placeholder="Enter User Name"
              onChange={handleChange}
            />
            {errors.User_Name && (
              <div className="error-message">{errors.User_Name}</div>
            )}
          </Form.Group>
          <Form.Group controlId="email_id" className="formGroup">
            <Form.Label>Email Id</Form.Label>
            <Form.Control
              type="text"
              name="email_id"
              value={formData.email_id}
              placeholder="Enter email id"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="email_id" className="formGroup">
            <Form.Label>Mobile No</Form.Label>
            <Form.Control
              type="text"
              name="mobile_no"
              value={formData.mobile_no}
              placeholder="Enter email id"
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group controlId="panNo" className="formGroup">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="text"
              name="password"
              value={formData.password}
              placeholder="Enter Password"
              onChange={handleChange}
            />
            {errors.PAN_No && (
              <div className="error-message">{errors.PAN_No}</div>
            )}
          </Form.Group>
          <Form.Group controlId="createdBy" className="formGroup">
            <Form.Label>Created By</Form.Label>
            <Form.Control
              type="text"
              name="Created_By"
              value={formData.Created_By}
              readOnly
            />
          </Form.Group>

          <Form.Group controlId="createdDate" className="formGroup">
            <Form.Label>Created Date</Form.Label>
            <Form.Control
              type="datetime-local"
              name="Created_Date"
              value={formData.Created_Date}
              readOnly
            />
          </Form.Group>

          <Form.Group controlId="modifiedBy" className="formGroup">
            <Form.Label>Modified By</Form.Label>
            <Form.Control
              type="text"
              name="Modified_By"
              value={formData.Modified_By}
              readOnly
            />
          </Form.Group>

          <Form.Group controlId="modifiedDate" className="formGroup">
            <Form.Label>Modified Date</Form.Label>
            <Form.Control
              type="datetime-local"
              name="Modified_Date"
              value={formData.Modified_Date}
              readOnly
            />
          </Form.Group>

          <div className="submit-button">
            <Button variant="primary" type="submit">
              Submit
            </Button>
          </div>
        </Form>
        <Row className="py-3">
          <Col>
            Existing User? <Link to="/login">Login Here</Link>
          </Col>
        </Row>
      </div>

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

export default ManageUsers;
