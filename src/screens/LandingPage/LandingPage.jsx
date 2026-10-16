import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Container, Row } from "react-bootstrap";
import "./LandingPage.css";
import { selectUser } from "../../features/userSlice"; // Adjust based on your actual slice path

const LandingPage = () => {
  const user = useSelector(selectUser); // Access the user from Redux store
  const token = user?.token; // Get token if user is logged in
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to dashboard if the user is already logged in
    if (token) {
      navigate("/dashboard");
    }
  }, [token, navigate]);

  return (
    <div className="main">
      <Container>
        <Row>
          <div className="intro-text">
            <div>
              <h1 className="title">
                Welcome to Bihar Foundry & Castings Limited
              </h1>
              <p className="subtitle">
                Committed to providing high-quality products
              </p>
            </div>
            <div className="buttonContainer">
              {/* Conditionally render the buttons based on token presence */}
              {!token ? (
                <>
                  <a href="/login">
                    <button size="lg" className="landingbutton">
                      Login
                    </button>
                  </a>
                </>
              ) : null}
            </div>
          </div>
        </Row>
      </Container>
    </div>
  );
};

export default LandingPage;
