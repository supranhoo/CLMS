import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const Footer = () => {
  return (
    <footer className="workspace-footer">
      <Container>
        <Row>
          <Col className="text-center py-3">
            Copyright & copy; Bihar Foundry & Castings Limited
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;
