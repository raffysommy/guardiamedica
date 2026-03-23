import { HashRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Container, Navbar, Nav, Alert, Spinner } from 'react-bootstrap';
import Controls from './components/Controls';
import ScheduleView from './components/ScheduleView';
import DoctorManagement from './components/DoctorManagement';
import UnavailabilityManagement from './components/UnavailabilityManagement';
import { useAppStore } from './store';

function App() {
  const { loading, error } = useAppStore();

  return (
    <Router>
      <div className="d-flex flex-column min-vh-100" style={{ backgroundColor: '#f5f7fa' }}>
        {/* Navbar */}
        <Navbar
          expand="lg"
          className="shadow-sm px-3"
          style={{ backgroundColor: '#ffffff', borderBottom: '3px solid #4a90d9' }}
        >
          <Container fluid>
            <Navbar.Brand
              as={NavLink}
              to="/"
              className="fw-bold d-flex align-items-center gap-2"
              style={{ color: '#2c5282', fontSize: '1.3rem' }}
            >
              🏥 Guardia Medica
            </Navbar.Brand>
            <Navbar.Toggle aria-controls="main-nav" />
            <Navbar.Collapse id="main-nav">
              <Nav className="ms-auto">
                <Nav.Link
                  as={NavLink}
                  to="/"
                  end
                  className="px-3 py-2 rounded-3 mx-1"
                  style={{ fontSize: '1rem' }}
                >
                  📅 Calendario
                </Nav.Link>
                <Nav.Link
                  as={NavLink}
                  to="/medici"
                  className="px-3 py-2 rounded-3 mx-1"
                  style={{ fontSize: '1rem' }}
                >
                  👨‍⚕️ Medici
                </Nav.Link>
                <Nav.Link
                  as={NavLink}
                  to="/indisponibilita"
                  className="px-3 py-2 rounded-3 mx-1"
                  style={{ fontSize: '1rem' }}
                >
                  🚫 Indisponibilità
                </Nav.Link>
              </Nav>
            </Navbar.Collapse>
          </Container>
        </Navbar>

        {/* Main content */}
        <main className="flex-fill py-4">
          <Container fluid className="px-3 px-lg-4">
            {loading && (
              <div className="text-center my-3">
                <Spinner animation="border" variant="primary" />
                <span className="ms-2 text-muted">Caricamento...</span>
              </div>
            )}
            {error && (
              <Alert variant="danger" dismissible className="rounded-3 shadow-sm">
                ⚠️ {error}
              </Alert>
            )}
            <Routes>
              <Route
                path="/"
                element={
                  <>
                    <Controls />
                    <ScheduleView />
                  </>
                }
              />
              <Route path="/medici" element={<DoctorManagement />} />
              <Route path="/indisponibilita" element={<UnavailabilityManagement />} />
            </Routes>
          </Container>
        </main>

        {/* Footer */}
        <footer className="text-center py-3" style={{ backgroundColor: '#f0f4f8' }}>
          <small className="text-muted">Guardia Medica Scheduler</small>
        </footer>
      </div>
    </Router>
  );
}

export default App;
