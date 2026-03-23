import React, { useState, useEffect } from 'react';
import { Container, Card, Table, Button, Form, Modal, Row, Col, Alert, Badge, ListGroup } from 'react-bootstrap';
import { useAppStore, type Doctor } from '../store'; // Import Doctor interface

import { v4 as uuidv4 } from 'uuid'; // Import uuid

// Dnd-kit imports for sorting
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
  useDroppable, // Import useDroppable
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Draggable Item for both lists (now a SortableItem for both contexts)
interface DraggableItemProps {
    id: UniqueIdentifier;
    doctorName: string;
    index?: number; // Optional index for numbering in preferred list
}

const DraggableItem: React.FC<DraggableItemProps> = ({ id, doctorName, index }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 0,
    backgroundColor: 'white',
    cursor: 'grab', // Indicate draggable
  };

  return (
    <ListGroup.Item
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="d-flex justify-content-between align-items-center mb-1 rounded" // Added mb-1 for spacing
    >
      <span>{index !== undefined ? `${index + 1}. ` : ''}{doctorName}</span>
      <Badge bg="info">Trascina</Badge>
    </ListGroup.Item>
  );
};

// Droppable Container (for available doctors and preferred doctors)
interface DroppableContainerProps {
    id: UniqueIdentifier;
    children: React.ReactNode;
    title: string;
    items: UniqueIdentifier[]; // Pass items for SortableContext
}

const DroppableList: React.FC<DroppableContainerProps> = ({ id, children, title, items }) => {
    const { setNodeRef } = useDroppable({ id });

    return (
        <div className="p-2 border rounded" style={{ minHeight: '100px', backgroundColor: '#f8f9fa' }}>
            <h6>{title}</h6>
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
                <ListGroup ref={setNodeRef} style={{ minHeight: '80px' }}>
                    {children}
                </ListGroup>
            </SortableContext>
        </div>
    );
};


// Define Doctor type for form input, now including preferred_colleagues AND indisponibilita
interface DoctorFormInput {
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

const DoctorManagement: React.FC = () => {
    const { doctors, loading, error } = useAppStore();
    const { fetchDoctors, addDoctor, updateDoctor, deleteDoctor } = useAppStore(state => state.actions);

    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentDoctor, setCurrentDoctor] = useState<DoctorFormInput>({
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
    });
    const [formError, setFormError] = useState<string | null>(null);

    // Local states for the two DND lists
    const [preferredColleaguesInModal, setPreferredColleaguesInModal] = useState<UniqueIdentifier[]>([]);
    const [availableColleaguesInModal, setAvailableColleaguesInModal] = useState<UniqueIdentifier[]>([]);

    // Dnd-kit sensors
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    );

    useEffect(() => {
        // Ensure doctors are loaded when this component mounts
        if (doctors.length === 0 && !loading && !error) {
            fetchDoctors();
        }
    }, [doctors.length, loading, error, fetchDoctors]);

    // Populate DND lists when modal opens for editing
    useEffect(() => {
        if (showModal) {
            const doc = doctors.find(d => d.doctor_id === currentDoctor.doctor_id);
            const selfId = currentDoctor.doctor_id;

            const allOtherDoctorIds = doctors
                .filter(d => d.doctor_id !== selfId)
                .map(d => d.doctor_id);

            let initialPreferred: UniqueIdentifier[] = [];
            let initialAvailable: UniqueIdentifier[] = [];

            if (isEditing && doc) {
                // Filter doc.preferred_colleagues to ensure they are still valid doctors and not self
                initialPreferred = doc.preferred_colleagues.filter(colId => allOtherDoctorIds.includes(colId));
                initialAvailable = allOtherDoctorIds.filter(colId => !initialPreferred.includes(colId));
                
                // Ensure currentDoctor state reflects the actual preferred_colleagues from store for form submission
                setCurrentDoctor(prev => ({ ...prev, preferred_colleagues: doc.preferred_colleagues, indisponibilita: doc.indisponibilita }));

            } else { // Adding new doctor
                initialPreferred = [];
                initialAvailable = allOtherDoctorIds;
                setCurrentDoctor(prev => ({ ...prev, preferred_colleagues: [], indisponibilita: [] }));
            }
            setPreferredColleaguesInModal(initialPreferred);
            setAvailableColleaguesInModal(initialAvailable);
        }
    }, [showModal, isEditing, currentDoctor.doctor_id, doctors]); 


    const handleClose = () => {
        setShowModal(false);
        setFormError(null);
        setCurrentDoctor({
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
        });
        setPreferredColleaguesInModal([]);
        setAvailableColleaguesInModal([]);
    };
    const handleShowAdd = () => {
        setIsEditing(false);
        setCurrentDoctor(prev => ({ ...prev, doctor_id: uuidv4() })); // Autogenerate ID for new doctor
        setShowModal(true);
    };
    const handleShowEdit = (doctor: Doctor) => {
        setIsEditing(true);
        setCurrentDoctor({
            doctor_id: doctor.doctor_id,
            nome: doctor.nome,
            max_shifts: doctor.max_shifts,
            preferred_feriali: doctor.preferred_feriali,
            preferred_sabato_giorno: doctor.preferred_sabato_giorno,
            preferred_sabato_notte: doctor.preferred_sabato_notte,
            preferred_domenica_giorno: doctor.preferred_domenica_giorno,
            preferred_domenica_notte: doctor.preferred_domenica_notte,
            preferred_colleagues: doctor.preferred_colleagues, 
            indisponibilita: doctor.indisponibilita, 
        });
        setShowModal(true);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setCurrentDoctor(prev => ({
            ...prev,
            [name]: name === 'doctor_id' || name === 'nome' ? value : parseInt(value, 10),
        }));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) return;

        const activeId = active.id;
        const overId = over.id;
        const isOverPreferredList = over.id === 'preferred-doctors-list' || preferredColleaguesInModal.includes(overId);
        const isOverAvailableList = over.id === 'available-doctors-list' || availableColleaguesInModal.includes(overId);

        // Dragging within the preferred list
        if (isOverPreferredList && preferredColleaguesInModal.includes(activeId)) {
            const oldIndex = preferredColleaguesInModal.indexOf(activeId);
            const newIndex = preferredColleaguesInModal.indexOf(overId);
            if (oldIndex !== -1 && newIndex !== -1) { // Ensure both are valid indices
                setPreferredColleaguesInModal((items) => arrayMove(items, oldIndex, newIndex));
            }
        } 
        // Dragging from available to preferred
        else if (availableColleaguesInModal.includes(activeId) && isOverPreferredList) {
            setAvailableColleaguesInModal((items) => items.filter((id) => id !== activeId));
            setPreferredColleaguesInModal((items) => {
                const newItems = [...items];
                const overIndex = items.indexOf(overId);
                if (overIndex !== -1) {
                    newItems.splice(overIndex, 0, activeId);
                } else {
                    newItems.push(activeId); // Add to end if no specific target
                }
                return newItems;
            });
        } 
        // Dragging from preferred to available
        else if (preferredColleaguesInModal.includes(activeId) && isOverAvailableList) {
            setPreferredColleaguesInModal((items) => items.filter((id) => id !== activeId));
            setAvailableColleaguesInModal((items) => [...items, activeId].sort((a,b) => getDoctorName(String(a)).localeCompare(getDoctorName(String(b))))); // Add back to available, sorted by name
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        try {
            if (isEditing) {
                // Send only the actually preferred colleagues from the modal state
                await updateDoctor(currentDoctor.doctor_id, { ...currentDoctor, preferred_colleagues: preferredColleaguesInModal.map(String) });
            } else {
                // For adding a new doctor, create an object that respects the Omit type
                const { indisponibilita, preferred_colleagues, ...newDoctorData } = currentDoctor;
                await addDoctor(newDoctorData);
            }
            handleClose();
        } catch (err: any) {
            setFormError(err.message || 'Errore durante l\'operazione.');
        }
    };

    const handleDelete = async (doctor_id: string) => {
        if (window.confirm('Sei sicuro di voler eliminare questo medico?')) {
            try {
                await deleteDoctor(doctor_id);
            } catch (err: any) {
                setFormError(err.message || 'Errore durante l\'eliminazione.');
            }
        }
    };

    const getDoctorName = (id: string) => doctors.find(d => d.doctor_id === id)?.nome || id;

    return (
        <Container className="my-4">
            <Card>
                <Card.Header as="h5">Gestione Medici</Card.Header>
                <Card.Body>
                    <Button variant="success" onClick={handleShowAdd} className="mb-3">
                        Aggiungi Nuovo Medico
                    </Button>
                    {loading && <Alert variant="info">Caricamento...</Alert>}
                    {error && <Alert variant="danger">Errore globale: {error}</Alert>}
                    {formError && <Alert variant="warning">{formError}</Alert>}

                    <Table striped bordered hover responsive>
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Max Turni</th>
                                <th>Preferenze Affinità</th> {/* New column */}
                                <th>Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {doctors.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={4} className="text-center">Nessun medico registrato.</td>
                                </tr>
                            ) : (
                                doctors.map(doctor => (
                                    <tr key={doctor.doctor_id}>
                                        <td>{doctor.nome}</td>
                                        <td>{doctor.max_shifts}</td>
                                        <td>
                                            {doctor.preferred_colleagues.length > 0
                                                ? doctor.preferred_colleagues.map(colId => getDoctorName(colId)).join(', ')
                                                : 'Nessuna preferenza'}
                                        </td>
                                        <td>
                                            <Button variant="warning" size="sm" className="me-2" onClick={() => handleShowEdit(doctor)}>Modifica</Button>
                                            <Button variant="danger" size="sm" onClick={() => handleDelete(doctor.doctor_id)}>Elimina</Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </Table>

                    <Modal show={showModal} onHide={handleClose} size="lg"> {/* Increased modal size */}
                        <Modal.Header closeButton>
                            <Modal.Title>{isEditing ? 'Modifica Medico' : 'Aggiungi Medico'}</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            {formError && <Alert variant="warning">{formError}</Alert>}
                            <Form onSubmit={handleSubmit}>
                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Nome</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="nome"
                                                value={currentDoctor.nome}
                                                onChange={handleChange}
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Max Turni</Form.Label>
                                            <Form.Control
                                                type="number"
                                                name="max_shifts"
                                                value={currentDoctor.max_shifts}
                                                onChange={handleChange}
                                                min="1"
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Row className="mb-3">
                                    <Col>
                                        <Form.Group>
                                            <Form.Label>Pref. Feriali</Form.Label>
                                            <Form.Control type="number" name="preferred_feriali" value={currentDoctor.preferred_feriali} onChange={handleChange} min="0" />
                                        </Form.Group>
                                    </Col>
                                    <Col>
                                        <Form.Group>
                                            <Form.Label>Pref. Sab. Giorno</Form.Label>
                                            <Form.Control type="number" name="preferred_sabato_giorno" value={currentDoctor.preferred_sabato_giorno} onChange={handleChange} min="0" />
                                        </Form.Group>
                                    </Col>
                                    <Col>
                                        <Form.Group>
                                            <Form.Label>Pref. Sab. Notte</Form.Label>
                                            <Form.Control type="number" name="preferred_sabato_notte" value={currentDoctor.preferred_sabato_notte} onChange={handleChange} min="0" />
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Row className="mb-3">
                                    <Col>
                                        <Form.Group>
                                            <Form.Label>Pref. Dom. Giorno</Form.Label>
                                            <Form.Control type="number" name="preferred_domenica_giorno" value={currentDoctor.preferred_domenica_giorno} onChange={handleChange} min="0" />
                                        </Form.Group>
                                    </Col>
                                    <Col>
                                        <Form.Group>
                                            <Form.Label>Pref. Dom. Notte</Form.Label>
                                            <Form.Control type="number" name="preferred_domenica_notte" value={currentDoctor.preferred_domenica_notte} onChange={handleChange} min="0" />
                                        </Form.Group>
                                    </Col>
                                </Row>

                                {/* Preferred Colleagues Management Section */}
                                {isEditing && doctors.length > 1 && (
                                    <div className="mt-4">
                                        <h5>Preferenze Affinità Colleghi</h5>
                                        <p className="text-muted">Trascina i medici tra le liste per definire le preferenze (più in alto = più affine).</p>
                                        <DndContext 
                                            sensors={sensors} 
                                            collisionDetection={closestCenter} 
                                            onDragEnd={handleDragEnd}
                                        >
                                            <Row>
                                                <Col md={6}>
                                                    <DroppableList id="preferred-doctors-list" title="Medici Preferiti" items={preferredColleaguesInModal}>
                                                        {preferredColleaguesInModal.length === 0 ? (
                                                            <ListGroup.Item className="text-muted text-center py-3">Trascina qui i medici preferiti.</ListGroup.Item>
                                                        ) : (
                                                            preferredColleaguesInModal.map((colleagueId, index) => (
                                                                <DraggableItem 
                                                                    key={colleagueId} 
                                                                    id={colleagueId} 
                                                                    doctorName={getDoctorName(String(colleagueId))} 
                                                                    index={index} 
                                                                />
                                                            ))
                                                        )}
                                                    </DroppableList>
                                                </Col>
                                                <Col md={6}>
                                                    <DroppableList id="available-doctors-list" title="Altri Medici Disponibili" items={availableColleaguesInModal}>
                                                        {availableColleaguesInModal.length === 0 ? (
                                                            <ListGroup.Item className="text-muted text-center py-3">Tutti i medici sono nelle preferenze.</ListGroup.Item>
                                                        ) : (
                                                            availableColleaguesInModal.map((colleagueId) => (
                                                                <DraggableItem 
                                                                    key={colleagueId} 
                                                                    id={colleagueId} 
                                                                    doctorName={getDoctorName(String(colleagueId))} 
                                                                />
                                                            ))
                                                        )}
                                                    </DroppableList>
                                                </Col>
                                            </Row>
                                        </DndContext>
                                    </div>
                                )}
                                
                                <Modal.Footer>
                                    <Button variant="secondary" onClick={handleClose}>
                                        Annulla
                                    </Button>
                                    <Button variant="primary" type="submit" disabled={loading}>
                                        {isEditing ? 'Salva Modifiche' : 'Aggiungi'}
                                    </Button>
                                </Modal.Footer>
                            </Form>
                        </Modal.Body>
                    </Modal>
                </Card.Body>
            </Card>
        </Container>
    );
};

export default DoctorManagement;