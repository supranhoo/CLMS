import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Alert, Card } from "react-bootstrap";
import MainScreen from "../../components/MainScreen";

export default function Unavailable() {
  const { module } = useParams();
  const location = useLocation();
  const label = module ? module.replace(/-/g, " ").toUpperCase() : location.pathname;

  return (
    <MainScreen title="Unavailable in recovered build">
      <Alert variant="warning">
        <strong>{label}</strong>
        <p className="mb-0 mt-2">
          {module
            ? "This menu is included for development, but its screen was not present in the supplied frontend build."
            : "This address does not have a recovered screen in the development replica."}
        </p>
      </Alert>
      <Card className="mb-3">
        <Card.Body>
          <Card.Title>Feature development starting point</Card.Title>
          <Card.Text>
            Add the screen, sample API behavior and validation before treating this module as available.
            The replica uses synthetic sample data for local development.
          </Card.Text>
          <Card.Text>
            Review current local feature coverage and enter the supplied BFCL requirements in the feature development workbench.
          </Card.Text>
          <Link className="btn btn-primary me-2" to="/development/features">Feature workbench</Link>
          <Link className="btn btn-outline-secondary" to="/dashboard">Return to dashboard</Link>
        </Card.Body>
      </Card>
    </MainScreen>
  );
}
