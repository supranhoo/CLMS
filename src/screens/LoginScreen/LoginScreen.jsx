import React, { useState, useEffect } from "react";
import MainScreen from "../../components/MainScreen";
import { Button, Row, Col, Form, Modal } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import axios from "../../api/axios.js";
import Loading from "../../components/Loading";
import ErrorMessage from "../../components/ErrorMessage";
import { useDispatch } from "react-redux";
import { loginUser } from "../../features/userSlice";
import "./LoginScreen.css";
import { useRuntime } from '../../components/RuntimeEnvironment';

const LoginScreen = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const runtime = useRuntime();

  /* ---------------- LOCAL STATE ---------------- */
  const [emp_id, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [menuOptions, setMenuOptions] = useState([]);

  /* ---------------- UI STATE ---------------- */
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState(false);

  /* ---------------- ERROR MODAL ---------------- */
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    "Invalid User ID or Password"
  );

  /* ---------------- FETCH MENU AFTER LOGIN ---------------- */
  useEffect(() => {
    if (!isLoggedIn || !emp_id) return;

    const fetchMenuOptions = async () => {
      try {
        const res = await axios.post("/api/menu/getMenuUserData", { emp_id });
        setMenuOptions(res.data || []);
      } catch (err) {
        console.log("Error fetching menu options:", err.message);
      }
    };

    fetchMenuOptions();
  }, [isLoggedIn, emp_id]);

  /* ---------------- LOGIN SUBMIT ---------------- */
  const submitHandler = async (e, credentials = { emp_id, password }) => {
    e.preventDefault();
    setInlineError(false);
    setLoading(true);

    const result = await dispatch(loginUser(credentials));

    setLoading(false);

    // ✅ LOGIN SUCCESS
    if (loginUser.fulfilled.match(result)) {
      setIsLoggedIn(true);
      setEmpId("");
      setPassword("");
      navigate(result.payload.mustChangePassword ? '/change-password' : '/dashboard');
      return;
    }

    // ❌ LOGIN FAILURE
    const msg = result.payload?.message || "Invalid User ID or Password";

    setErrorMessage(msg);
    setInlineError(true);
    setShowErrorModal(true);
  };

  return (
    <MainScreen title="Login to Your Account">
      <div className="login-container">
        {inlineError && (
          <ErrorMessage variant="danger">{errorMessage}</ErrorMessage>
        )}

        {loading && <Loading />}

        {/* ---------------- MENU TILES AFTER LOGIN ---------------- */}
        {isLoggedIn ? (
          <div className="menu-tiles-container">
            <Row>
              {menuOptions.map((menu, index) => (
                <Col key={index} md={6} className="mb-3">
                  <Button
                    variant="outline-primary"
                    className="menu-tile-btn btn-lg w-100"
                  >
                    <Link to={menu.url} className="menu-tile-link">
                      {menu.name}
                    </Link>
                  </Button>
                </Col>
              ))}
            </Row>
          </div>
        ) : (
          /* ---------------- LOGIN FORM ---------------- */
          <Form onSubmit={submitHandler} className="login-form">
            {runtime.demo && <div className="alert alert-warning" role="note">
              <strong>Local sample workspace</strong>
              <p className="mb-2">Use the demo account to explore synthetic records and develop new features.</p>
              <Button
                variant="outline-dark"
                type="button"
                disabled={loading}
                onClick={(event) => submitHandler(event, { emp_id: "demo", password: "demo123" })}
              >
                Enter demo workspace
              </Button>
              <div className="small mt-2">Demo credentials: demo / demo123</div>
            </div>}
            <Form.Group className="mb-4">
              <Form.Label>User ID</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter your user ID"
                value={emp_id}
                onChange={(e) => setEmpId(e.target.value)}
                className="login-input"
                required
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                required
              />
            </Form.Group>

            <div className="d-grid gap-2">
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? "Loading..." : "Submit"}
              </Button>
            </div>

            {/* 🔐 FORGOT PASSWORD (RESTORED) */}
            {runtime.demo ? <div className="text-center mt-3">
              <Button
                variant="link"
                className="forgot-password-btn"
                onClick={() => navigate("/resetPassword")}
              >
                Forgot Password?
              </Button>
            </div> : <p className="small mt-3">Contact your system administrator if you cannot sign in. Self-service recovery is not enabled.</p>}
          </Form>
        )}
      </div>

      {/* ---------------- ERROR MODAL ---------------- */}
      <Modal
        show={showErrorModal}
        onHide={() => setShowErrorModal(false)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>Login Error</Modal.Title>
        </Modal.Header>
        <Modal.Body>{errorMessage}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowErrorModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </MainScreen>
  );
};

export default LoginScreen;
