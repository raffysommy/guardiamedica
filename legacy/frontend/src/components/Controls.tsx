import React from 'react';
import { Form, Button, Row, Col, Card, ButtonGroup } from 'react-bootstrap';
import { useAppStore } from '../store';

const Controls: React.FC = () => {
  // Get state and actions from the Zustand store
  const { year, month, loading, shifts, isScheduleDirty } = useAppStore();
  const { setYear, setMonth, generateSchedule, saveSchedule, clearSchedule, undo, redo, exportScheduleToPdf } = useAppStore((state) => state.actions);

  // Derive state for button visibility/disability
  const isSchedulePresent = shifts.present.length > 0;
  const canUndo = shifts.past.length > 0;
  const canRedo = shifts.future.length > 0;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    generateSchedule();
  };

  const handleSave = () => {
    saveSchedule();
  };

  const handleClear = () => {
    clearSchedule();
  };

  return (
    <Card className="mb-4">
      <Card.Header as="h5">Controlli</Card.Header>
      <Card.Body>
        <Row>
            <Col md={8}>
                <Form onSubmit={handleGenerate}>
                <Row className="align-items-end">
                    <Col md={4}>
                    <Form.Group controlId="formYear">
                        <Form.Label>Anno</Form.Label>
                        <Form.Control
                        type="number"
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value, 10))}
                        disabled={loading}
                        />
                    </Form.Group>
                    </Col>
                    <Col md={4}>
                    <Form.Group controlId="formMonth">
                        <Form.Label>Mese</Form.Label>
                        <Form.Control
                        as="select"
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                        disabled={loading}
                        >
                        <option value="1">Gennaio</option>
                        <option value="2">Febbraio</option>
                        <option value="3">Marzo</option>
                        <option value="4">Aprile</option>
                        <option value="5">Maggio</option>
                        <option value="6">Giugno</option>
                        <option value="7">Luglio</option>
                        <option value="8">Agosto</option>
                        <option value="9">Settembre</option>
                        <option value="10">Ottobre</option>
                        <option value="11">Novembre</option>
                        <option value="12">Dicembre</option>
                        </Form.Control>
                    </Form.Group>
                    </Col>
                    <Col md={4} className="d-flex align-items-end">
                        {!isSchedulePresent ? (
                            <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                                {loading ? 'Generazione...' : 'Genera Calendario'}
                            </Button>
                        ) : (
                            <Button variant="danger" onClick={handleClear} className="w-100" disabled={loading}>
                                Cancella Calendario
                            </Button>
                        )}
                    </Col>
                </Row>
                </Form>
            </Col>
            <Col md={4} className="d-flex align-items-end">
                 <div className="w-100">
                    <h6 className="text-muted text-center mb-1">Modifica Manuale</h6>
                    <ButtonGroup className="w-100">
                        <Button variant="outline-secondary" onClick={undo} disabled={!canUndo || loading}>
                            Annulla
                        </Button>
                        <Button variant="outline-secondary" onClick={redo} disabled={!canRedo || loading}>
                            Ripristina
                        </Button>
                    </ButtonGroup>
                    <Button 
                        variant="success" 
                        onClick={handleSave} 
                        className="w-100 mt-2" 
                        disabled={loading || !isScheduleDirty || !isSchedulePresent}
                    >
                        Salva Modifiche
                    </Button>
                     <Button 
                        variant="outline-info" 
                        onClick={exportScheduleToPdf} 
                        className="w-100 mt-2"
                        disabled={loading || !isSchedulePresent}
                    >
                        Esporta PDF
                    </Button>
                </div>
            </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

export default Controls;