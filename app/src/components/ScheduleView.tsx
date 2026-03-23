import React from 'react';
import { Card, Badge, Row, Col, ListGroup } from 'react-bootstrap';
import { useAppStore } from '../store';
import {
  DndContext,
  useDraggable,
  useDroppable,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

/* ---------- Drag-and-drop building blocks ---------- */

const DraggableBadge = ({ doctorId, doctorName, shiftId }: { doctorId: string; doctorName: string; shiftId: string }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${shiftId}-${doctorId}`,
    data: { doctorId, sourceShiftId: shiftId, type: 'DoctorInShift' },
  });

  return (
    <Badge
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      pill
      bg="primary"
      className="px-3 py-2 m-1"
      style={{
        transform: CSS.Translate.toString(transform),
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        fontSize: '0.9rem',
        fontWeight: 500,
        minHeight: 36,
        minWidth: 44,
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {doctorName}
    </Badge>
  );
};

const DraggablePoolDoctor = ({ doctorId, doctorName }: { doctorId: string; doctorName: string }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pool-${doctorId}`,
    data: { doctorId, type: 'DoctorInPool' },
  });

  return (
    <ListGroup.Item
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="d-flex align-items-center gap-2 border-0 rounded-3 mb-1 px-3 py-2"
      style={{
        transform: CSS.Translate.toString(transform),
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        backgroundColor: isDragging ? '#e8f4fd' : '#f0f7ff',
        fontSize: '0.95rem',
        minHeight: 44,
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: '1.1rem' }}>👨‍⚕️</span>
      {doctorName}
    </ListGroup.Item>
  );
};

const DroppableEmptySlot = ({ shiftId, slotIndex }: { shiftId: string; slotIndex: number }) => {
  const id: UniqueIdentifier = `${shiftId}-slot-${slotIndex}-empty`;
  const { setNodeRef, isOver } = useDroppable({ id, data: { shiftId, type: 'EmptySlot' } });

  return (
    <div
      ref={setNodeRef}
      className="d-flex align-items-center justify-content-center m-1 rounded-3"
      style={{
        minHeight: 38,
        border: `2px dashed ${isOver ? '#198754' : '#dee2e6'}`,
        backgroundColor: isOver ? '#d1e7dd' : '#f8f9fa',
        color: '#adb5bd',
        fontSize: '0.8rem',
        transition: 'all 0.15s',
      }}
    >
      Trascina qui
    </div>
  );
};

const TrashDropZone = () => {
  const { setNodeRef, isOver } = useDroppable({ id: 'trash-zone' });

  return (
    <div
      ref={setNodeRef}
      className="text-center rounded-4 mt-3 p-3"
      style={{
        border: `2px dashed ${isOver ? '#dc3545' : '#ced4da'}`,
        backgroundColor: isOver ? '#f8d7da' : '#fff5f5',
        color: isOver ? '#dc3545' : '#adb5bd',
        transition: 'all 0.15s',
        fontSize: '0.95rem',
      }}
    >
      🗑️ Trascina qui per rimuovere
    </div>
  );
};

const DroppableCell = ({ children, shift }: { children: React.ReactNode; shift: any | null }) => {
  const id: UniqueIdentifier = shift ? shift.shift_id : `empty-cell-${Math.random()}`;
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <td
      ref={setNodeRef}
      className="align-top"
      style={{
        backgroundColor: isOver ? '#e8f4fd' : undefined,
        minHeight: 50,
        transition: 'background-color 0.15s',
        padding: '6px 4px',
      }}
    >
      <div className="d-flex flex-wrap justify-content-center gap-1">{children}</div>
    </td>
  );
};

/* ---------- Day name helpers ---------- */
const DAYS_IT: Record<number, string> = {
  0: 'Domenica', 1: 'Lunedì', 2: 'Martedì', 3: 'Mercoledì',
  4: 'Giovedì', 5: 'Venerdì', 6: 'Sabato',
};

function getDayName(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return DAYS_IT[d.getDay()] ?? '';
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/* ---------- Row color helper ---------- */
function getRowStyle(iso: string, holidays: string[]): React.CSSProperties {
  const d = new Date(iso + 'T00:00:00');
  const dow = d.getDay();
  const isHoliday = holidays.includes(iso) || dow === 0;
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  const nextISO = next.toISOString().slice(0, 10);
  const isPreHoliday = holidays.includes(nextISO) || dow === 6;

  if (isHoliday) return { backgroundColor: '#fff8e1' }; // warm yellow
  if (isPreHoliday) return { backgroundColor: '#e8f5e9' }; // soft green
  return {};
}

/* ---------- Main component ---------- */

const ScheduleView: React.FC = () => {
  const shifts = useAppStore((s) => s.shifts.present);
  const doctors = useAppStore((s) => s.doctors);
  const holidays = useAppStore((s) => s.holidays);
  const { updateShiftAssignment, unassignDoctorFromShift } = useAppStore((s) => s.actions);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const src = active.data.current;
    if (!src) return;

    if (over.id === 'trash-zone') {
      if (src.type === 'DoctorInShift') unassignDoctorFromShift(src.doctorId, src.sourceShiftId);
      return;
    }

    const overData = over.data.current;
    const destShiftId = overData?.type === 'EmptySlot' ? overData.shiftId : (over.id as string);

    if (src.type === 'DoctorInPool') {
      updateShiftAssignment(src.doctorId, null, destShiftId);
    } else if (src.type === 'DoctorInShift') {
      updateShiftAssignment(src.doctorId, src.sourceShiftId, destShiftId);
    }
  };

  if (shifts.length === 0) {
    return (
      <Card className="border-0 shadow-sm" style={{ borderRadius: 16 }}>
        <Card.Body className="py-5 px-4">
          <div className="text-center mb-4">
            <div style={{ fontSize: '3rem' }}>📋</div>
            <h5 className="text-muted mt-3">Nessun calendario generato</h5>
            <p className="text-muted">Seleziona mese e anno, poi premi <strong>Genera Calendario</strong>.</p>
          </div>

          <hr className="my-4" />

          <div className="mx-auto" style={{ maxWidth: 700 }}>
            <h5 className="mb-3" style={{ color: '#2c5282' }}>📖 Come usare l'app</h5>

            <div className="d-flex align-items-start gap-3 mb-3">
              <span className="badge rounded-circle bg-primary d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 32, height: 32, fontSize: '0.95rem' }}>1</span>
              <div>
                <strong>Aggiungi i medici</strong>
                <p className="text-muted mb-0">
                  Vai alla sezione <strong>👨‍⚕️ Medici</strong> nella barra in alto. Per ogni medico puoi impostare il nome,
                  il numero massimo di turni al mese e i colleghi preferiti (affinità).
                </p>
              </div>
            </div>

            <div className="d-flex align-items-start gap-3 mb-3">
              <span className="badge rounded-circle bg-primary d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 32, height: 32, fontSize: '0.95rem' }}>2</span>
              <div>
                <strong>Imposta le indisponibilità</strong>
                <p className="text-muted mb-0">
                  Nella sezione <strong>🚫 Indisponibilità</strong> puoi selezionare le date in cui ogni medico non è disponibile
                  (ferie, permessi, ecc.).
                </p>
              </div>
            </div>

            <div className="d-flex align-items-start gap-3 mb-3">
              <span className="badge rounded-circle bg-primary d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 32, height: 32, fontSize: '0.95rem' }}>3</span>
              <div>
                <strong>Genera il calendario</strong>
                <p className="text-muted mb-0">
                  Torna qui, seleziona <strong>mese e anno</strong> dai menù sopra e premi <strong>Genera Calendario</strong>.
                  L'algoritmo distribuirà i turni in modo equo, evitando notti consecutive e rispettando le preferenze.
                </p>
              </div>
            </div>

            <div className="d-flex align-items-start gap-3 mb-3">
              <span className="badge rounded-circle bg-primary d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 32, height: 32, fontSize: '0.95rem' }}>4</span>
              <div>
                <strong>Modifica manualmente (opzionale)</strong>
                <p className="text-muted mb-0">
                  Puoi trascinare i nomi dei medici da un turno all'altro, oppure dalla lista laterale alla tabella.
                  Per rimuovere un'assegnazione, trascina il nome nel cestino 🗑️.
                </p>
              </div>
            </div>

            <div className="d-flex align-items-start gap-3 mb-3">
              <span className="badge rounded-circle bg-primary d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 32, height: 32, fontSize: '0.95rem' }}>5</span>
              <div>
                <strong>Salva e scarica il PDF</strong>
                <p className="text-muted mb-0">
                  Quando sei soddisfatto, premi <strong>💾 Salva</strong> per memorizzare il calendario.
                  Usa <strong>📄 Esporta PDF</strong> per scaricare una versione stampabile.
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-3" style={{ backgroundColor: '#e8f4fd' }}>
              <small className="text-muted">
                💡 <strong>Suggerimento:</strong> i tuoi dati vengono salvati nel browser — quando torni
                li ritroverai. Per ricominciare da zero, usa il pulsante <strong>🗑️ Cancella Tutto</strong> nella barra di navigazione.
              </small>
            </div>
          </div>
        </Card.Body>
      </Card>
    );
  }

  const doctorMap = new Map(doctors.map((d) => [d.doctor_id, d.nome]));
  const byDate: Record<string, typeof shifts> = {};
  for (const s of shifts) {
    (byDate[s.shift_date] ??= []).push(s);
  }
  const sortedDates = Object.keys(byDate).sort();

  const renderDoctors = (shift: any) => {
    if (!shift) return null;
    const els: React.ReactNode[] = shift.assigned_doctor_ids.map((id: string) => (
      <DraggableBadge key={`${shift.shift_id}-${id}`} shiftId={shift.shift_id} doctorId={id} doctorName={doctorMap.get(id) || '??'} />
    ));
    for (let i = els.length; i < shift.max_doctors; i++) {
      els.push(<DroppableEmptySlot key={`${shift.shift_id}-empty-${i}`} shiftId={shift.shift_id} slotIndex={i} />);
    }
    return els;
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <Row className="g-3">
        {/* Doctor pool */}
        <Col lg={2} md={3}>
          <Card className="border-0 shadow-sm sticky-top" style={{ borderRadius: 16, top: 16 }}>
            <Card.Body className="p-3">
              <h6 className="text-center text-muted mb-3">👨‍⚕️ Medici</h6>
              <ListGroup variant="flush">
                {doctors.map((d) => (
                  <DraggablePoolDoctor key={d.doctor_id} doctorId={d.doctor_id} doctorName={d.nome} />
                ))}
              </ListGroup>
              <TrashDropZone />
            </Card.Body>
          </Card>
        </Col>

        {/* Calendar */}
        <Col lg={10} md={9}>
          <Card className="border-0 shadow-sm" style={{ borderRadius: 16 }}>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0" style={{ fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e3f2fd' }}>
                      <th className="ps-3" style={{ width: 90 }}>Data</th>
                      <th style={{ width: 100 }}>Giorno</th>
                      <th className="text-center">🌙 Serale Feriale</th>
                      <th className="text-center">☀️ Giorno Festivo</th>
                      <th className="text-center">🌙 Notte Festivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDates.map((date) => {
                      const dayShifts = byDate[date];
                      const feriale = dayShifts.find((s) => s.shift_type === 'feriale_serale');
                      const giorno = dayShifts.find((s) => s.shift_type.endsWith('_giorno'));
                      const notte = dayShifts.find((s) => s.shift_type.endsWith('_notte'));
                      const dayName = getDayName(date);
                      const isWeekend = dayName === 'Sabato' || dayName === 'Domenica';

                      return (
                        <tr key={date} style={getRowStyle(date, holidays)}>
                          <td className="ps-3 fw-semibold">{formatDate(date)}</td>
                          <td className={isWeekend ? 'fw-bold' : ''}>{dayName}</td>
                          <DroppableCell shift={feriale}>{renderDoctors(feriale)}</DroppableCell>
                          <DroppableCell shift={giorno}>{renderDoctors(giorno)}</DroppableCell>
                          <DroppableCell shift={notte}>{renderDoctors(notte)}</DroppableCell>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </DndContext>
  );
};

export default ScheduleView;
