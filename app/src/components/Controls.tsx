import React from 'react';
import { Button, Row, Col, Card, ButtonGroup, Form } from 'react-bootstrap';
import { useAppStore } from '../store';

const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const Controls: React.FC = () => {
  const { year, month, loading, shifts, isScheduleDirty } = useAppStore();
  const {
    setYear, setMonth, generateScheduleAction, saveSchedule,
    clearSchedule, undo, redo, exportPdf,
  } = useAppStore((s) => s.actions);

  const hasShifts = shifts.present.length > 0;
  const canUndo = shifts.past.length > 0;
  const canRedo = shifts.future.length > 0;

  return (
    <Card className="shadow-sm border-0 mb-4" style={{ borderRadius: 16 }}>
      <Card.Body className="p-4">
        <Row className="align-items-end g-3">
          {/* Year/Month selectors */}
          <Col xs={6} md={2}>
            <Form.Label className="fw-semibold text-muted small mb-1">Anno</Form.Label>
            <Form.Control
              type="number"
              value={year}
              onChange={(e) => setYear(+e.target.value)}
              disabled={loading}
              className="rounded-3"
              style={{ fontSize: '1.1rem' }}
            />
          </Col>
          <Col xs={6} md={3}>
            <Form.Label className="fw-semibold text-muted small mb-1">Mese</Form.Label>
            <Form.Select
              value={month}
              onChange={(e) => setMonth(+e.target.value)}
              disabled={loading}
              className="rounded-3"
              style={{ fontSize: '1.1rem' }}
            >
              {MESI.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </Form.Select>
          </Col>

          {/* Primary action */}
          <Col xs={12} md={3}>
            {!hasShifts ? (
              <Button
                size="lg"
                variant="primary"
                className="w-100 rounded-3 fw-bold"
                onClick={() => generateScheduleAction()}
                disabled={loading}
                style={{ fontSize: '1.05rem' }}
              >
                {loading ? '⏳ Generazione...' : '📅 Genera Calendario'}
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline-danger"
                className="w-100 rounded-3 fw-bold"
                onClick={() => {
                  if (window.confirm('Sei sicuro di voler cancellare il calendario?')) clearSchedule();
                }}
                disabled={loading}
                style={{ fontSize: '1.05rem' }}
              >
                🗑️ Cancella Calendario
              </Button>
            )}
          </Col>

          {/* Undo/redo + save + export */}
          <Col xs={12} md={4}>
            <div className="d-flex flex-column gap-2">
              <ButtonGroup className="w-100">
                <Button variant="outline-secondary" className="rounded-start-3" onClick={undo} disabled={!canUndo || loading}>
                  ↩️ Annulla
                </Button>
                <Button variant="outline-secondary" className="rounded-end-3" onClick={redo} disabled={!canRedo || loading}>
                  ↪️ Ripristina
                </Button>
              </ButtonGroup>
              <div className="d-flex gap-2">
                <Button
                  variant="success"
                  className="flex-fill rounded-3 fw-bold"
                  onClick={saveSchedule}
                  disabled={loading || !isScheduleDirty || !hasShifts}
                >
                  💾 Salva
                </Button>
                <Button
                  variant="outline-primary"
                  className="flex-fill rounded-3"
                  onClick={exportPdf}
                  disabled={loading || !hasShifts}
                >
                  📄 PDF
                </Button>
              </div>
            </div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

export default Controls;
