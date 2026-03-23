import React from 'react';
import { Card, Table, Badge, Stack, Row, Col, ListGroup } from 'react-bootstrap';
import { useAppStore } from '../store';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Draggable Badge for doctors in shifts
const DraggableBadge = ({ doctorId, doctorName, shiftId }: { doctorId: string, doctorName: string, shiftId: string }) => {
  const draggableId = `${shiftId}-${doctorId}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { doctorId, sourceShiftId: shiftId, type: 'DoctorInShift' },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    cursor: 'grab',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <Badge ref={setNodeRef} style={style} {...listeners} {...attributes} bg="primary" className="m-1">
      {doctorName}
    </Badge>
  );
};

// Draggable Doctor in the pool
const DraggablePoolDoctor = ({ doctorId, doctorName }: { doctorId: string, doctorName: string }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `pool-${doctorId}`,
        data: { doctorId, type: 'DoctorInPool' },
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 0,
    };
    
    return (
        <ListGroup.Item ref={setNodeRef} style={style} {...listeners} {...attributes} className="mb-1">
            {doctorName}
        </ListGroup.Item>
    );
};

// Droppable Empty Slot
const DroppableEmptySlot = ({ shiftId, slotIndex }: { shiftId: string, slotIndex: number }) => {
    const droppableId: UniqueIdentifier = `${shiftId}-slot-${slotIndex}-empty`;
    const { setNodeRef, isOver } = useDroppable({
        id: droppableId,
        data: { shiftId, type: 'EmptySlot' },
    });

    return (
        <div ref={setNodeRef} style={{ backgroundColor: isOver ? '#e6ffe6' : undefined, minHeight: '38px', border: '1px dashed #ccc', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7, fontSize: '0.8em', color: '#6c757d' }} className="m-1">
            Slot Vuoto
        </div>
    );
};

// Trash Drop Zone
const TrashDropZone = () => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'trash-zone',
    });

    const style: React.CSSProperties = {
        padding: '20px',
        marginTop: '20px',
        border: `2px dashed ${isOver ? 'red' : '#6c757d'}`,
        borderRadius: '0.5rem',
        textAlign: 'center',
        color: isOver ? 'red' : '#6c757d',
        backgroundColor: isOver ? '#ffdddd' : '#f8f9fa',
    };

    return (
        <div ref={setNodeRef} style={style}>
            Trascina qui per rimuovere dal turno
        </div>
    );
};



// Droppable Table Cell
const DroppableCell = ({ children, shift }: { children: React.ReactNode, shift: any | null }) => {
    const droppableId: UniqueIdentifier = shift ? shift.shift_id : `empty-cell-${Math.random()}`;
    const { setNodeRef, isOver } = useDroppable({ id: droppableId });

    return (
        <td ref={setNodeRef} style={{ backgroundColor: isOver ? 'lightblue' : undefined, minHeight: '45px', verticalAlign: 'top', position: 'relative' }}>
            <Stack direction="horizontal" gap={1} className="justify-content-center">
                {children}
            </Stack>
        </td>
    );
};


const ScheduleView: React.FC = () => {
  const shifts = useAppStore((state) => state.shifts.present);
  const doctors = useAppStore((state) => state.doctors);
  const { updateShiftAssignment, unassignDoctorFromShift } = useAppStore((state) => state.actions);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const sourceData = active.data.current;
    if (!sourceData) return;

    const { doctorId, type: sourceType, sourceShiftId } = sourceData;

    // Handle dropping into the trash zone
    if (over.id === 'trash-zone') {
        if (sourceType === 'DoctorInShift') {
            unassignDoctorFromShift(doctorId, sourceShiftId);
        }
        return; // End the handler here
    }
    
    const overData = over.data.current;
    let destinationShiftId: string;
    
    // Determine the destination shift ID based on what was dropped over
    if (overData?.type === 'EmptySlot') {
        destinationShiftId = overData.shiftId;
    } else {
        destinationShiftId = over.id as string;
    }

    if (sourceType === 'DoctorInPool') {
        // From pool to shift
        updateShiftAssignment(doctorId, null, destinationShiftId);
    } else if (sourceType === 'DoctorInShift') {
        // From shift to another shift
        updateShiftAssignment(doctorId, sourceShiftId, destinationShiftId);
    }
  };

  if (shifts.length === 0) {
    return (
      <Card>
        <Card.Header as="h5">Calendario Turni</Card.Header>
        <Card.Body>
          <p className="text-muted">Nessun calendario generato. Usa i controlli qui sopra per generarne uno.</p>
        </Card.Body>
      </Card>
    );
  }

  const doctorMap = new Map(doctors.map(doc => [doc.doctor_id, doc.nome]));
  const shiftsByDate = shifts.reduce((acc, shift) => {
    const date = shift.shift_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(shift);
    return acc;
  }, {} as Record<string, typeof shifts>);

  const sortedDates = Object.keys(shiftsByDate).sort();
  const getDayName = (dateString: string) => format(parseISO(dateString), 'EEEE', { locale: it });

  return (
    <DndContext onDragEnd={handleDragEnd}>
        <Row>
            <Col md={3}>
                <Card>
                    <Card.Header as="h5">Medici Disponibili</Card.Header>
                    <Card.Body>
                        <ListGroup>
                            {doctors.map(doc => (
                                <DraggablePoolDoctor key={doc.doctor_id} doctorId={doc.doctor_id} doctorName={doc.nome} />
                            ))}
                        </ListGroup>
                    </Card.Body>
                </Card>
                <TrashDropZone />
            </Col>
            <Col md={9}>
                <Card>
                    <Card.Header as="h5">Calendario Turni</Card.Header>
                    <Card.Body>
                    <Table striped bordered hover responsive size="sm">
                        <thead>
                        <tr>
                            <th>Data</th>
                            <th>Giorno</th>
                            <th>Turno Serale (Feriale)</th>
                            <th>Turno Giorno (Sab/Dom/Festivi)</th>
                            <th>Turno Notte (Sab/Dom/Festivi)</th>
                        </tr>
                        </thead>
                        <tbody>
                        {sortedDates.map(date => {
                            const dayShifts = shiftsByDate[date];
                            const feriale = dayShifts.find(s => s.shift_type === 'feriale_serale');
                            const giorno = dayShifts.find(s => s.shift_type.endsWith('_giorno'));
                            const notte = dayShifts.find(s => s.shift_type.endsWith('_notte'));

                            const renderShiftDoctors = (shift: any) => {
                            if (!shift) return null;
                            const doctorElements = shift.assigned_doctor_ids.map((docId: string) => (
                                <DraggableBadge
                                key={`${shift.shift_id}-${docId}`}
                                shiftId={shift.shift_id}
                                doctorId={docId}
                                doctorName={doctorMap.get(docId) || '??'}
                                />
                            ));

                            while (doctorElements.length < shift.max_doctors) {
                                doctorElements.push(
                                    <DroppableEmptySlot 
                                        key={`${shift.shift_id}-empty-${doctorElements.length}`} 
                                        shiftId={shift.shift_id} 
                                        slotIndex={doctorElements.length} 
                                    />
                                );
                            }
                            return doctorElements;
                            };

                            return (
                            <tr key={date}>
                                <td>{format(parseISO(date), 'dd/MM/yyyy')}</td>
                                <td>{getDayName(date)}</td>
                                <DroppableCell shift={feriale}>{renderShiftDoctors(feriale)}</DroppableCell>
                                <DroppableCell shift={giorno}>{renderShiftDoctors(giorno)}</DroppableCell>
                                <DroppableCell shift={notte}>{renderShiftDoctors(notte)}</DroppableCell>
                            </tr>
                            );
                        })}
                        </tbody>
                    </Table>
                    </Card.Body>
                </Card>
            </Col>
        </Row>
    </DndContext>
  );
};

export default ScheduleView;