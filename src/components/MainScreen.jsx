import { Container, Row } from "react-bootstrap";

// `scope` opts a screen into a legacy stylesheet that is scoped by that class (see docs/ui-redesign/w0).
const MainScreen = ({ title, scope, children }) => {
  return (
    <div className={scope ? `mainback ${scope}` : "mainback"}>
      <Container>
        <Row>
          <div className="page">
            {title && (
              <>
                <h1 className="heading">{title}</h1>
                <hr />
              </>
            )}
            {children}
          </div>
        </Row>
      </Container>
    </div>
  );
};

export default MainScreen;
