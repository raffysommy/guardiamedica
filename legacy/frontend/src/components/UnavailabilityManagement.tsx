import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Form, Alert } from 'react-bootstrap';
import DatePicker from 'react-datepicker';
import { useAppStore } from '../store';
import { format, parseISO, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';

import "react-datepicker/dist/react-datepicker.css";
// Add custom styles for react-datepicker to match bootstrap
// These would typically be in a separate CSS file or handled by a styling library
const datepickerStyles = `
  .react-datepicker {
    font-size: 0.9rem;
    border: 1px solid #dee2e6;
    border-radius: 0.25rem;
  }
  .react-datepicker__header {
    background-color: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
  }
  .react-datepicker__current-month, .react-datepicker-time__header {
    font-weight: bold;
  }
  .react-datepicker__day--selected, .react-datepicker__day--keyboard-selected {
    background-color: #007bff;
    color: white; /* Ensure text is visible on selected date */
  }
  /* Style for highlighted dates (unavailability) */
  .react-datepicker__day--highlighted {
    background-color: #ffc107; /* Warning color */
    color: #343a40; /* Darker text */
  }
  .react-datepicker__day--highlighted.react-datepicker__day--selected {
      background-color: #dc3545; /* Danger color if selected and highlighted */
  }

  .react-datepicker__day--in-selecting-range, .react-datepicker__day--in-range {
    background-color: #e9ecef;
  }
  .react-datepicker__day--disabled {
    color: #ccc;
  }
  .react-datepicker__day:hover {
    background-color: #e2e6ea;
  }
  .react-datepicker__navigation-icon::before {
    border-color: #343a40;
  }
`;


const UnavailabilityManagement: React.FC = () => {
    const { doctors, loading, error } = useAppStore();
    const { fetchDoctors, updateDoctor } = useAppStore(state => state.actions); // Using updateDoctor directly

    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
    const [selectedDates, setSelectedDates] = useState<Date[]>([]); // Array of individual dates
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (doctors.length === 0 && !loading && !error) {
            fetchDoctors();
        }
    }, [doctors.length, loading, error, fetchDoctors]);

    useEffect(() => {
        // When selectedDoctorId changes, update selectedDates from the doctor's current unavailability
        const currentDoctor = doctors.find(d => d.doctor_id === selectedDoctorId);
        if (currentDoctor) {
            setSelectedDates(currentDoctor.indisponibilita.map(isoDate => parseISO(isoDate)).filter(d => !isNaN(d.getTime())));
        } else {
            setSelectedDates([]);
        }
    }, [selectedDoctorId, doctors]);


    const handleDateChange = (date: Date | null) => {
        if (!date) return;

        const isDateSelected = selectedDates.some(selected => isSameDay(selected, date));

        if (isDateSelected) {
            // Remove date if already selected
            setSelectedDates(prev => prev.filter(selected => !isSameDay(selected, date)));
        } else {
            // Add date if not selected
            setSelectedDates(prev => [...prev, date].sort((a,b) => a.getTime() - b.getTime()));
        }
    };

    const handleSaveUnavailability = async () => {
        if (!selectedDoctorId) {
            setFormError("Seleziona un medico per salvare le indisponibilità.");
            return;
        }
        setFormError(null);
        setFormSuccess(null);

        const currentDoctor = doctors.find(d => d.doctor_id === selectedDoctorId);
        if (!currentDoctor) {
            setFormError("Medico selezionato non trovato.");
            return;
        }

        try {
            // Convert Date objects back to ISO strings
            const unavailableIsoDates = selectedDates.map(d => format(d, 'yyyy-MM-dd'));

            // Prepare the full doctor object to send for update
            const doctorDataToUpdate = {
                ...currentDoctor,
                indisponibilita: unavailableIsoDates,
            };
            
            await updateDoctor(currentDoctor.doctor_id, doctorDataToUpdate); // Use the action from the store
            
            setFormSuccess("Indisponibilità salvate con successo!");
        } catch (err: any) {
            setFormError(err.message || "Errore durante il salvataggio delle indisponibilità.");
        }
    };

    // Highlight dates correctly for react-datepicker to visually show unavailable dates
    const highlightWithClassName = [
        { "react-datepicker__day--highlighted": selectedDates }
    ];

    return (
        <Container className="my-4">
            <style>{datepickerStyles}</style> {/* Apply custom styles for datepicker */}
            <Card>
                <Card.Header as="h5">Gestione Indisponibilità Medici</Card.Header>
                <Card.Body>
                    {loading && <Alert variant="info">Caricamento...</Alert>}
                    {error && <Alert variant="danger">Errore globale: {error}</Alert>}
                    {formError && <Alert variant="danger">{formError}</Alert>}
                    {formSuccess && <Alert variant="success">{formSuccess}</Alert>}

                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Seleziona Medico</Form.Label>
                            <Form.Control
                                as="select"
                                value={selectedDoctorId}
                                onChange={(e) => setSelectedDoctorId(e.target.value)}
                                disabled={loading || doctors.length === 0}
                            >
                                <option value="">-- Seleziona un medico --</option>
                                {doctors.map(doctor => (
                                    <option key={doctor.doctor_id} value={doctor.doctor_id}>
                                        {doctor.nome}
                                    </option>
                                ))}
                            </Form.Control>
                        </Form.Group>

                        {selectedDoctorId && (
                            <Card className="mt-3">
                                <Card.Body>
                                    <Card.Title>Indisponibilità per {doctors.find(d => d.doctor_id === selectedDoctorId)?.nome}</Card.Title>
                                    <DatePicker
                                        selected={null} // We manage selection through highlightDates and onChange
                                        onChange={handleDateChange}
                                        inline
                                        monthsShown={2}
                                        highlightDates={highlightWithClassName} // Use the correctly formatted highlight
                                        //filterDate={(date) => true} // Example: disable weekends
                                        locale={it} // Set locale for date-fns
                                    />
                                    <p className="mt-2">Date selezionate: {selectedDates.length > 0 ? selectedDates.map(d => format(d, 'dd/MM/yyyy', { locale: it })).join(', ') : 'Nessuna'}</p>
                                    <Button variant="primary" onClick={handleSaveUnavailability} disabled={loading} className="mt-3">
                                        Salva Indisponibilità
                                    </Button>
                                </Card.Body>
                            </Card>
                        )}
                    </Form>
                </Card.Body>
            </Card>
        </Container>
    );
};

export default UnavailabilityManagement;
