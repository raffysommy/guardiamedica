import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Form, Modal, Row, Col, Alert, Badge, ListGroup } from 'react-bootstrap';
import { useAppStore, type Doctor } from '../store';
import { v4 as uuidv4 } from 'uuid';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* ---------- DnD sub-components ---------- */

const DraggableItem: React.FC<{ id: UniqueIdentifier; doctorName: string; index?: number }> = ({
  id, doctorName, index,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <ListGroup.Item
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="d-flex justify-content-between align-items-center mb-1 rounded-3 border-0 px-3 py-2"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: index !== undefined ? '#e8f4fd' : '#f8f9fa',
        cursor: 'grab',
      }}
    >
      <span>
        {index !== undefined && <Badge bg="primary" className="me-2">{index + 1}</Badge>}
        {doctorName}
      </span>
      <small className="text-muted">⇅</small>
    </ListGroup.Item>
  );
};

const DroppableList: React.FC<{
  id: UniqueIdentifier;
  children: React.ReactNode;
  title: string;
  items: UniqueIdentifier[];
  icon: string;
}> = ({ id, children, title, items, icon }) => {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div className="p-3 rounded-3" style={{ backgroundColor: '#fafbfc', minHeight: 120 }}>
      <h6 className="mb-2">{icon} {title}</h6>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ListGroup ref={setNodeRef} variant="flush" style={{ minHeight: 80 }}>
          {children}
        </ListGroup>
      </SortableContext>
    </div>
  );
};

/* ---------- Form state ---------- */

interface DoctorForm {
  doctor_id: string;
  nome: string;
  max_shifts: number;
  preferred_feriali: number;
  preferred_sabato_giorno: number;
  preferred_sabato_notte: number;
  preferred_domenica_giorno: number;
  preferred_domenica_notte: number;
  preferred_colleagues: string[];
  indisponibilita: string[];
}

const DEFAULT_FORM: DoctorForm = {
  doctor_id: '',
  nome: '',
  max_shifts: 10,
  preferred_feriali: 5,
  preferred_sabato_giorno: 1,
  preferred_sabato_notte: 1,
  preferred_domenica_giorno: 1,
  preferred_domenica_notte: 1,
  preferred_colleagues: [],
  indisponibilita: [],
};

/* ---------- Main component ---------- */

const DoctorManagement: React.FC = () => {
  const { doctors, loading } = useAppStore();
  const { addDoctor, updateDoctor, deleteDoctor } = useAppStore((s) => s.actions);

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<DoctorForm>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<UniqueIdentifier[]>([]);
  const [available, setAvailable] = useState<UniqueIdentifier[]>([]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  // Sync DnD lists when modal opens
  useEffect(() => {
    if (!showModal) return;
    const selfId = form.doctor_id;
    const otherIds = doctors.filter((d) => d.doctor_id !== selfId).map((d) => d.doctor_id);

    if (isEditing) {
      const doc = doctors.find((d) => d.doctor_id === selfId);
      const pref = (doc?.preferred_colleagues ?? []).filter((id) => otherIds.includes(id));
      setPreferred(pref);
      setAvailable(otherIds.filter((id) => !pref.includes(id)));
    } else {
      setPreferred([]);
      setAvailable(otherIds);
    }
  }, [showModal, isEditing, form.doctor_id, doctors]);

  const close = () => {
    setShowModal(false);
    setFormError(null);
    setForm(DEFAULT_FORM);
  };

  const openAdd = () => {
    setIsEditing(false);
    setForm({ ...DEFAULT_FORM, doctor_id: uuidv4() });
    setShowModal(true);
  };

  const openEdit = (d: Doctor) => {
    setIsEditing(true);
    setForm({ ...d });
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'nome' ? value : parseInt(value, 10) || 0,
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    const isOverPref = overId === 'preferred-list' || preferred.includes(overId);
    const isOverAvail = overId === 'available-list' || available.includes(overId);

    if (isOverPref && preferred.includes(activeId)) {
      const oldIdx = preferred.indexOf(activeId);
      const newIdx = preferred.indexOf(overId);
      if (oldIdx !== -1 && newIdx !== -1) setPreferred((items) => arrayMove(items, oldIdx, newIdx));
    } else if (available.includes(activeId) && isOverPref) {
      setAvailable((items) => items.filter((id) => id !== activeId));
      setPreferred((items) => {
        const idx = items.indexOf(overId);
        const copy = [...items];
        idx !== -1 ? copy.splice(idx, 0, activeId) : copy.push(activeId);
        return copy;
      });
    } else if (preferred.includes(activeId) && isOverAvail) {
      setPreferred((items) => items.filter((id) => id !== activeId));
      setAvailable((items) =>
        [...items, activeId].sort((a, b) => getName(String(a)).localeCompare(getName(String(b))))
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (isEditing) {
        updateDoctor(form.doctor_id, { ...form, preferred_colleagues: preferred.map(String) });
      } else {
        addDoctor(form);
      }
      close();
    } catch (err: any) {
      setFormError(err.message || 'Errore durante il salvataggio.');
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questo medico?')) deleteDoctor(id);
  };

  const getName = (id: string) => doctors.find((d) => d.doctor_id === id)?.nome ?? id;

  return (
    <Container className="my-4" style={{ maxWidth: 900 }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">👨‍⚕️ Gestione Medici</h4>
        <Button variant="primary" size="lg" className="rounded-3 px-4" onClick={openAdd}>
          ➕ Nuovo Medico
        </Button>
      </div>

      {doctors.length === 0 ? (
        <Card className="border-0 shadow-sm text-center py-5" style={{ borderRadius: 16 }}>
          <Card.Body>
            <div style={{ fontSize: '3rem' }}>👨‍⚕️</div>
            <h5 className="text-muted mt-3">Nessun medico registrato</h5>
            <p className="text-muted">Aggiungi il primo medico per iniziare.</p>
          </Card.Body>
        </Card>
      ) : (
        <Row className="g-3">
          {doctors.map((doc) => (
            <Col md={6} key={doc.doctor_id}>
              <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 16 }}>
                <Card.Body className="p-4">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h5 className="mb-0">{doc.nome}</h5>
                    <div>
                      <Button variant="outline-primary" size="sm" className="me-1 rounded-3" onClick={() => openEdit(doc)}>
                        ✏️
                      </Button>
                      <Button variant="outline-danger" size="sm" className="rounded-3" onClick={() => handleDelete(doc.doctor_id)}>
                        🗑️
                      </Button>
                    </div>
                  </div>
                  <p className="text-muted small mb-2">
                    Max turni: <strong>{doc.max_shifts}</strong>
                  </p>
                  {doc.preferred_colleagues.length > 0 && (
                    <div>
                      <small className="text-muted">Colleghi preferiti:</small>
                      <div className="mt-1">
                        {doc.preferred_colleagues.map((cid) => (
                          <Badge key={cid} bg="info" className="me-1 mb-1">{getName(cid)}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {doc.indisponibilita.length > 0 && (
                    <div className="mt-2">
                      <small className="text-muted">Giorni non disponibili: {doc.indisponibilita.length}</small>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Modal */}
      <Modal show={showModal} onHide={close} size="lg" centered>
        <Modal.Header closeButton className="border-0">
          <Modal.Title>{isEditing ? '✏️ Modifica Medico' : '➕ Nuovo Medico'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Row className="g-3 mb-3">
              <Col md={8}>
                <Form.Label className="fw-semibold">Nome</Form.Label>
                <Form.Control name="nome" value={form.nome} onChange={handleChange} required className="rounded-3" style={{ fontSize: '1.1rem' }} />
              </Col>
              <Col md={4}>
                <Form.Label className="fw-semibold">Max turni/mese</Form.Label>
                <Form.Control type="number" name="max_shifts" value={form.max_shifts} onChange={handleChange} min={1} required className="rounded-3" />
              </Col>
            </Row>

            <Card className="border-0 mb-3" style={{ backgroundColor: '#f8f9fa', borderRadius: 12 }}>
              <Card.Body>
                <h6 className="mb-3">📊 Preferenze distribuzione turni</h6>
                <Row className="g-2">
                  {[
                    ['preferred_feriali', 'Feriali sera'],
                    ['preferred_sabato_giorno', 'Sab. giorno'],
                    ['preferred_sabato_notte', 'Sab. notte'],
                    ['preferred_domenica_giorno', 'Dom. giorno'],
                    ['preferred_domenica_notte', 'Dom. notte'],
                  ].map(([key, label]) => (
                    <Col key={key}>
                      <Form.Label className="small text-muted">{label}</Form.Label>
                      <Form.Control
                        type="number"
                        name={key}
                        value={(form as any)[key]}
                        onChange={handleChange}
                        min={0}
                        className="rounded-3 text-center"
                      />
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card>

            {/* Affinity management */}
            {isEditing && doctors.length > 1 && (
              <Card className="border-0 mb-3" style={{ backgroundColor: '#f8f9fa', borderRadius: 12 }}>
                <Card.Body>
                  <h6 className="mb-1">🤝 Colleghi Preferiti</h6>
                  <p className="text-muted small mb-3">
                    Trascina i medici nella lista di sinistra. Più in alto = più affine.
                  </p>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <Row className="g-3">
                      <Col md={6}>
                        <DroppableList id="preferred-list" title="Preferiti" items={preferred} icon="⭐">
                          {preferred.length === 0 ? (
                            <ListGroup.Item className="text-muted text-center py-3 border-0">
                              Trascina qui i colleghi preferiti
                            </ListGroup.Item>
                          ) : (
                            preferred.map((cid, idx) => (
                              <DraggableItem key={cid} id={cid} doctorName={getName(String(cid))} index={idx} />
                            ))
                          )}
                        </DroppableList>
                      </Col>
                      <Col md={6}>
                        <DroppableList id="available-list" title="Disponibili" items={available} icon="👥">
                          {available.length === 0 ? (
                            <ListGroup.Item className="text-muted text-center py-3 border-0">
                              Tutti nelle preferenze
                            </ListGroup.Item>
                          ) : (
                            available.map((cid) => (
                              <DraggableItem key={cid} id={cid} doctorName={getName(String(cid))} />
                            ))
                          )}
                        </DroppableList>
                      </Col>
                    </Row>
                  </DndContext>
                </Card.Body>
              </Card>
            )}

            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button variant="outline-secondary" className="rounded-3 px-4" onClick={close}>
                Annulla
              </Button>
              <Button variant="primary" type="submit" className="rounded-3 px-4" disabled={loading}>
                {isEditing ? '💾 Salva' : '➕ Aggiungi'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default DoctorManagement;
