import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Form, Alert, Badge } from 'react-bootstrap';
import DatePicker from 'react-datepicker';
import { useAppStore } from '../store';
import { format, isSameDay, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

import 'react-datepicker/dist/react-datepicker.css';

const UnavailabilityManagement: React.FC = () => {
  const { doctors, loading } = useAppStore();
  const { updateDoctor } = useAppStore((s) => s.actions);

  const [selectedId, setSelectedId] = useState('');
  const [dates, setDates] = useState<Date[]>([]);
  const [msg, setMsg] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    const doc = doctors.find((d) => d.doctor_id === selectedId);
    if (doc) {
      setDates(doc.indisponibilita.map((iso) => parseISO(iso)).filter((d) => !isNaN(d.getTime())));
    } else {
      setDates([]);
    }
  }, [selectedId, doctors]);

  const toggleDate = (date: Date | null) => {
    if (!date) return;
    const exists = dates.some((d) => isSameDay(d, date));
    if (exists) {
      setDates((prev) => prev.filter((d) => !isSameDay(d, date)));
    } else {
      setDates((prev) => [...prev, date].sort((a, b) => a.getTime() - b.getTime()));
    }
  };

  const save = () => {
    if (!selectedId) {
      setMsg({ type: 'danger', text: 'Seleziona un medico.' });
      return;
    }
    const doc = doctors.find((d) => d.doctor_id === selectedId);
    if (!doc) return;

    const isoList = dates.map((d) => format(d, 'yyyy-MM-dd'));
    updateDoctor(doc.doctor_id, { ...doc, indisponibilita: isoList });
    setMsg({ type: 'success', text: 'Indisponibilità salvate!' });
    setTimeout(() => setMsg(null), 3000);
  };

  const selectedDoc = doctors.find((d) => d.doctor_id === selectedId);

  return (
    <Container className="my-4" style={{ maxWidth: 700 }}>
      <h4 className="mb-4">📅 Gestione Indisponibilità</h4>

      {msg && <Alert variant={msg.type} className="rounded-3">{msg.text}</Alert>}

      <Card className="border-0 shadow-sm" style={{ borderRadius: 16 }}>
        <Card.Body className="p-4">
          <Form.Label className="fw-semibold">Seleziona Medico</Form.Label>
          <Form.Select
            value={selectedId}
            onChange={(e) => { setSelectedId(e.target.value); setMsg(null); }}
            className="rounded-3 mb-4"
            style={{ fontSize: '1.1rem' }}
            disabled={loading || doctors.length === 0}
          >
            <option value="">-- Seleziona un medico --</option>
            {doctors.map((d) => (
              <option key={d.doctor_id} value={d.doctor_id}>{d.nome}</option>
            ))}
          </Form.Select>

          {selectedDoc && (
            <>
              <div className="d-flex justify-content-center mb-3">
                <DatePicker
                  selected={null}
                  onChange={toggleDate}
                  inline
                  monthsShown={2}
                  highlightDates={[{ 'react-datepicker__day--highlighted': dates }]}
                  locale={it}
                />
              </div>

              {dates.length > 0 && (
                <div className="mb-3">
                  <small className="text-muted fw-semibold">Date selezionate:</small>
                  <div className="mt-1 d-flex flex-wrap gap-1">
                    {dates.map((d) => (
                      <Badge
                        key={d.toISOString()}
                        bg="warning"
                        text="dark"
                        className="px-2 py-1"
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleDate(d)}
                      >
                        {format(d, 'dd/MM/yyyy')} ✕
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="primary" size="lg" className="w-100 rounded-3 fw-bold" onClick={save} disabled={loading}>
                💾 Salva Indisponibilità
              </Button>
            </>
          )}
        </Card.Body>
      </Card>

      <style>{`
        .react-datepicker { font-size: 0.95rem; border: 1px solid #dee2e6; border-radius: 12px; }
        .react-datepicker__header { background-color: #f0f7ff; border-bottom: 1px solid #dee2e6; border-radius: 12px 12px 0 0; }
        .react-datepicker__day--highlighted { background-color: #ffc107 !important; color: #343a40 !important; border-radius: 50%; }
        .react-datepicker__day:hover { background-color: #e2e6ea; border-radius: 50%; }
        .react-datepicker__day--selected { background-color: #0d6efd; color: white; border-radius: 50%; }
      `}</style>
    </Container>
  );
};

export default UnavailabilityManagement;
