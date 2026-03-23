import { useEffect } from 'react';
import { Container, Navbar, Nav, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

import Controls from './components/Controls';
import ScheduleView from './components/ScheduleView';
import DoctorManagement from './components/DoctorManagement';
import UnavailabilityManagement from './components/UnavailabilityManagement';
import { useAppStore } from './store';

function App() {
  const { year, month, loading, error } = useAppStore();
  const { fetchDoctors, loadSchedule } = useAppStore((state) => state.actions);

  useEffect(() => {
    const initialLoad = async () => {
        if (!loading && !error) {
            if (useAppStore.getState().doctors.length === 0) {
                await fetchDoctors();
            }
            await loadSchedule(year, month);
        }
    };
    initialLoad();
  }, [fetchDoctors, loadSchedule, year, month]);


  return (
    <Router>
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand as={Link} to="/">Guardiamedica Scheduler</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/">Calendario</Nav.Link>
              <Nav.Link as={Link} to="/doctors">Gestione Medici</Nav.Link>
              <Nav.Link as={Link} to="/unavailability">Gestione Indisponibilità</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <main className="py-4">
        <Container fluid>
          <Row>
            <Col>
              {/* Global loading and error indicators */}
              {loading && (
                <div className="text-center my-2">
                  <Spinner animation="border" variant="primary" />
                  <span className="ms-2">Caricamento...</span>
                </div>
              )}
              {error && <Alert variant="danger">Errore: {error}</Alert>}
            </Col>
          </Row>
          <Routes>
            <Route path="/" element={
              <>
                <Row>
                  <Col>
                    <Controls />
                  </Col>
                </Row>
                <Row className="mt-4">
                  <Col>
                    <ScheduleView />
                  </Col>
                </Row>
              </>
            } />
            <Route path="/doctors" element={<DoctorManagement />} />
            <Route path="/unavailability" element={<UnavailabilityManagement />} />
          </Routes>
        </Container>
      </main>

      <footer className="py-4 bg-light mt-auto">
        <Container className="text-center">
          <small className="text-muted">Applicazione creata da Gemini</small>
        </Container>
      </footer>
    </Router>
  );
}

export default App;