import React, { useState } from "react";
import MainScreen from "../../components/MainScreen";
import { Button, Row, Col, Form } from "react-bootstrap";
import { Link, Navigate, useNavigate } from "react-router-dom";
import "./RegisterScreen.css";
import axios from "../../api/axios.js";
import Loading from "../../components/Loading";
import ErrorMessage from "../../components/ErrorMessage";
import { useDispatch, useSelector } from "react-redux";
import { loginUser, logoutUser, registerUser } from "../../features/userSlice";
import { Modal } from "react-bootstrap";

const RegisterScreen = () => {
  // States for handling error modal
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [emp_id, setEmpId] = useState("");
  const [Name, setName] = useState("");
  const [email_id, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmpassword, setConfirmPassword] = useState("");
  const [error1, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate(); // Use useNavigate hook

  const submitHandler = async (e) => {
    console.log("Test at submitHandler");

    e.preventDefault();
    let userCredentials = {
      emp_id,
      Name,
      email_id,
      password,
    };
    //clea;
    setError(false);
    setLoading(true);
    try {
      await dispatch(registerUser(userCredentials)).then((result) => {
        if (result.payload) {
          setShowSuccessModal(true);
          setEmail("");
          setPassword("");
          //navigate("/"); // Navigate to the home route
        }
        //console.log("STage--1:", result);
        if (result.error) {
          setShowErrorModal(true);
          console.log("Error:", result.error);
          setError(true);
        }
      });
      //localStorage.setItem("userInfo", JSON.stringify(data));
      setLoading(false);
    } catch (error) {
      setShowErrorModal(true);
      console.log("Submit Err:", error);
      setError(true);
      setLoading(false);
    }
    console.log(emp_id, password);
  };

  /*----
  const submitHandler = async (e) => {
    e.preventDefault();
    setError(false);
    setLoading(true);

    if (password !== confirmpassword) {
      setMessage("Passwords do not match");
    } else {
      setMessage(null);

      try {
        const config = {
          header: {
            "Content-type": "application/json",
          },
        };
        const { data } = await axios.post(
          "/api/users/register",
          { emp_id, Name, email_id, password },
          config
        );
        localStorage.setItem("userInfo", JSON.stringify(data));
        setLoading(false);
        console.log("Registration Stage--1");
        console.log(data);
      } catch (error) {
        console.log("Registration Stage--2");
        setError(error.response.data.message);
        //setError(true);
        setLoading(false);
      }
      console.log(emp_id, password);
    }
  };
  ---*/
  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    navigate("/"); // Navigate to the home route after closing the modal
  };

  return (
    <MainScreen title="REGISTER">
      <div className="loginContainer">
        {error1 && (
          <ErrorMessage variant="danger">
            Unable to Register, Please check data
          </ErrorMessage>
        )}
        {message && <ErrorMessage variant="danger">{message}</ErrorMessage>}

        {loading && <Loading />}
        <Form onSubmit={submitHandler}>
          <Form.Group controlId="name" className="formGroup">
            <Form.Label>User ID</Form.Label>
            <Form.Control
              type="name"
              value={emp_id}
              placeholder="Enter User ID"
              onChange={(e) => setEmpId(e.target.value)}
            />
          </Form.Group>

          <Form.Group controlId="name" className="formGroup">
            <Form.Label>User Name</Form.Label>
            <Form.Control
              type="name"
              value={Name}
              placeholder="Enter Emplyee Name"
              onChange={(e) => setName(e.target.value)}
            />
          </Form.Group>

          <Form.Group controlId="formBasicEmail" className="formGroup">
            <Form.Label> Email Address</Form.Label>
            <Form.Control
              type="text"
              value={email_id}
              placeholder="Enter email"
              onChange={(e) => {
                setEmail(e.target.value);
              }}
            />
          </Form.Group>

          <Form.Group controlId="formBasicPassword" className="formGroup">
            <Form.Label> Password</Form.Label>
            <Form.Control
              type="password"
              value={password}
              placeholder="Enter Password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </Form.Group>

          <Form.Group controlId="confirmPassword" className="formGroup">
            <Form.Label> Confirm Password</Form.Label>
            <Form.Control
              type="password"
              value={confirmpassword}
              placeholder="Reenter Password"
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            Existing User ? <Link to="/login">Login Here</Link>
          </Col>
        </Row>
      </div>
      <Modal show={showErrorModal} onHide={setShowErrorModal}>
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

export default RegisterScreen;
