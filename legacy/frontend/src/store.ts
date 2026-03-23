import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { format, parseISO, isSameDay, addDays } from 'date-fns'; // Import necessary date-fns functions
import { it } from 'date-fns/locale'; // Import locale for date-fns format

// Define the types to match backend models
export interface Doctor {
  doctor_id: string;
  nome: string;
  indisponibilita: string[];
  max_shifts: number;
  preferred_feriali: number;
  preferred_sabato_giorno: number;
  preferred_sabato_notte: number;
  preferred_domenica_giorno: number;
  preferred_domenica_notte: number;
  preferred_colleagues: string[]; // New field
}

interface Shift {
    shift_id: string;
    shift_date: string;
    shift_type: string;
    assigned_doctor_ids: string[];
    max_doctors: number;
}

// For Undo/Redo
interface History<T> {
    past: T[];
    present: T;
    future: T[];
}

interface AppState {
    doctors: Doctor[];
    shifts: History<Shift[]>; // Changed to support undo/redo
    year: number;
    month: number;
    loading: boolean;
    error: string | null;
    isScheduleDirty: boolean; // New state property
    actions: {
        fetchDoctors: () => Promise<void>;
        loadSchedule: (year: number, month: number) => Promise<void>; // New action to load schedule
        setYear: (year: number) => void;
        setMonth: (month: number) => void;
        generateSchedule: () => Promise<void>;
        saveSchedule: () => Promise<void>; // New action
        clearSchedule: () => Promise<void>; // New action
        addDoctor: (doctor: Omit<Doctor, 'indisponibilita' | 'preferred_colleagues'>) => Promise<void>; // Updated Omit
        updateDoctor: (doctor_id: string, doctor: Doctor) => Promise<void>;
        deleteDoctor: (doctor_id: string) => Promise<void>;
        updateShiftAssignment: (doctorId: string, sourceShiftId: string | null, destinationShiftId: string) => void;
        unassignDoctorFromShift: (doctorId: string, shiftId: string) => void; // For trash functionality
        undo: () => void;
        redo: () => void;
        exportScheduleToPdf: () => Promise<void>; // New action for PDF export
    }
}

// Helper function for API calls
const callApi = async (url: string, method: string, body?: any, responseType: 'json' | 'blob' = 'json') => {
    const response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': responseType === 'json' ? 'application/json' : 'application/pdf',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `API error: ${response.status}`);
    }
    if (responseType === 'blob') {
        return response.blob();
    }
    return response.json();
};

const initialShiftsState: History<Shift[]> = {
    past: [],
    present: [],
    future: [],
};

// --- Helper functions for client-side validation (mirroring backend logic) ---
const isContiguousFrontend = (shift1: Shift, shift2: Shift): boolean => {
    const date1 = parseISO(shift1.shift_date);
    const date2 = parseISO(shift2.shift_date);

    if (isSameDay(date1, date2)) {
        // Same day: Giorno -> Notte is contiguous
        if (shift1.shift_type.endsWith('_giorno') && shift2.shift_type.endsWith('_notte')) {
            return true;
        }
        return false;
    }
    
    // Shifts on consecutive days
    if (isSameDay(addDays(date1, 1), date2)) {
        // Night -> next day Giorno is contiguous
        if (shift1.shift_type.endsWith('_notte') && shift2.shift_type.endsWith('_giorno')) {
            return true;
        }
    }
    return false;
};

const validateShiftAssignment = (
    doctorId: string, 
    destinationShift: Shift, 
    allShifts: Shift[], 
    doctors: Doctor[],
    currentAssignedDoctorIds: string[],
    isAddingFromPool: boolean // New parameter
): string | null => {
    const doctor = doctors.find(d => d.doctor_id === doctorId);
    if (!doctor) return "Medico non trovato.";

    // 1. Check Max Shifts (only if adding from pool, not moving)
    if (isAddingFromPool) {
        const doctorsCurrentShifts = allShifts.filter(s => s.assigned_doctor_ids.includes(doctorId)).length;
        if (doctorsCurrentShifts >= doctor.max_shifts) {
            return `Il medico ${doctor.nome} ha già raggiunto il suo numero massimo di turni (${doctor.max_shifts}).`;
        }
    }

    // 2. Check Unavailability
    if (doctor.indisponibilita.includes(destinationShift.shift_date)) {
        return `Il medico ${doctor.nome} non è disponibile il ${format(parseISO(destinationShift.shift_date), 'dd/MM/yyyy', { locale: it })}.`;
    }

    // 3. Check if doctor is already in destination shift (prevent "Dottor Blu Dottor Blu")
    if (currentAssignedDoctorIds.includes(doctorId)) {
        return `Il medico ${doctor.nome} è già assegnato a questo turno.`;
    }

    // 4. Check Contiguity (for ALL of doctor's assigned shifts, considering the potential new assignment)
    const doctorsOtherShifts = allShifts.filter(s => 
        s.assigned_doctor_ids.includes(doctorId) && s.shift_id !== destinationShift.shift_id
    );

    for (const otherShift of doctorsOtherShifts) {
        if (isContiguousFrontend(otherShift, destinationShift) || isContiguousFrontend(destinationShift, otherShift)) {
            return `Il medico ${doctor.nome} non può fare due turni contigui.`;
        }
    }
    
    return null; // No validation errors
};


export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      doctors: [],
      shifts: initialShiftsState,
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      loading: false,
      error: null,
      isScheduleDirty: false, // Initialize dirty state
      actions: {
        setYear: (year) => {
            set({ year });
            get().actions.loadSchedule(year, get().month); // Load schedule for new year
        },
        setMonth: (month) => {
            set({ month });
            get().actions.loadSchedule(get().year, month); // Load schedule for new month
        },

        fetchDoctors: async () => {
            if (get().loading) return;
            set({ loading: true, error: null });
            try {
                const doctors = await callApi('/api/doctors', 'GET');
                set({ doctors, loading: false });
            } catch (error: any) {
                set({ error: error.message, loading: false });
            }
        },

        loadSchedule: async (year, month) => {
            if (get().loading) return;
            set({ loading: true, error: null });
            try {
                const data = await callApi(`/api/schedule?year=${year}&month=${month}`, 'GET');
                set({ 
                    shifts: { past: [], present: data.shifts || [], future: [] }, // Clear history on load
                    doctors: data.doctors || [], // Doctors might be returned from backend, update state
                    loading: false,
                    isScheduleDirty: false, // Loaded schedule is not dirty
                });
            } catch (error: any) {
                set({ error: error.message, loading: false });
            }
        },
        
        generateSchedule: async () => {
            if (get().loading) return;
            const { year, month } = get();
            set({ loading: true, error: null });
            try {
                const data = await callApi(`/api/generate-schedule?year=${year}&month=${month}`, 'POST');
                set({ 
                    shifts: { past: [], present: data.shifts, future: [] }, 
                    doctors: data.doctors, // Update doctors in case of changes from backend
                    loading: false,
                    isScheduleDirty: false, 
                });
            } catch (error: any) {
                set({ error: error.message, loading: false });
                throw error; 
            }
        },

        saveSchedule: async () => {
            if (get().loading) return;
            const { shifts, year, month } = get();
            set({ loading: true, error: null });
            try {
                // Send current present shifts to backend for saving
                await callApi(`/api/schedule?year=${year}&month=${month}`, 'PUT', shifts.present);
                set({ loading: false, isScheduleDirty: false }); // Not dirty after saving
                alert('Calendario salvato con successo!');
            } catch (error: any) {
                set({ error: error.message, loading: false });
                alert('Errore durante il salvataggio del calendario: ' + error.message);
            }
        },

        clearSchedule: async () => {
            if (get().loading) return;
            const { year, month } = get();
            if (!window.confirm(`Sei sicuro di voler cancellare il calendario per ${month}/${year}?`)) {
                return;
            }
            set({ loading: true, error: null });
            try {
                await callApi(`/api/schedule?year=${year}&month=${month}`, 'DELETE');
                set({ 
                    shifts: { past: [], present: [], future: [] }, // Clear shifts
                    loading: false,
                    isScheduleDirty: false, // Not dirty after clearing
                });
                alert('Calendario cancellato con successo!');
            } catch (error: any) {
                set({ error: error.message, loading: false });
                alert('Errore durante la cancellazione del calendario: ' + error.message);
            }
        },

        addDoctor: async (doctorData) => {
            if (get().loading) return;
            set({ loading: true, error: null });
            try {
                // Ensure preferred_colleagues is an empty array by default
                const newDoctor = await callApi('/api/doctors', 'POST', { ...doctorData, indisponibilita: [], preferred_colleagues: [] });
                set((state) => ({ doctors: [...state.doctors, newDoctor], loading: false }));
            } catch (error: any) {
                set({ error: error.message, loading: false });
                throw error;
            }
        },

        updateDoctor: async (doctor_id, doctorData) => {
            if (get().loading) return;
            set({ loading: true, error: null });
            try {
                // Backend expects the full Doctor object, including its existing preferred_colleagues
                const currentDoctor = get().doctors.find(d => d.doctor_id === doctor_id);
                if (!currentDoctor) throw new Error("Doctor to update not found in store.");

                const updatedDoctor = await callApi(`/api/doctors/${doctor_id}`, 'PUT', {
                    ...doctorData,
                    indisponibilita: doctorData.indisponibilita || currentDoctor.indisponibilita,
                    preferred_colleagues: doctorData.preferred_colleagues || currentDoctor.preferred_colleagues,
                });
                set((state) => ({
                    doctors: state.doctors.map((d) => d.doctor_id === doctor_id ? updatedDoctor : d),
                    loading: false,
                }));
            } catch (error: any) {
                set({ error: error.message, loading: false });
                throw error;
            }
        },

        deleteDoctor: async (doctor_id) => {
            if (get().loading) return;
            set({ loading: true, error: null });
            try {
                await callApi(`/api/doctors/${doctor_id}`, 'DELETE');
                set((state) => ({
                    doctors: state.doctors.filter((d) => d.doctor_id !== doctor_id),
                    loading: false,
                }));
            } catch (error: any) {
                set({ error: error.message, loading: false });
                throw error;
            }
        },
        
        updateShiftAssignment: (doctorId, sourceShiftId, destinationShiftId) => {
            set((state) => {
                const { past, present } = state.shifts;
                const allDoctors = get().doctors; 
                
                const isAddingFromPool = sourceShiftId === null;

                // Find the shifts
                const sourceShift = sourceShiftId ? present.find(s => s.shift_id === sourceShiftId) : undefined;
                const destinationShift = present.find(s => s.shift_id === destinationShiftId);

                if (!destinationShift) {
                    console.error("Destination shift not found.");
                    set({ error: "Turno di destinazione non trovato." });
                    return {};
                }
                
                // --- VALIDATION ---
                const validationError = validateShiftAssignment(
                    doctorId, 
                    destinationShift, 
                    present, 
                    allDoctors,
                    destinationShift.assigned_doctor_ids,
                    isAddingFromPool // Pass the new flag
                );
                if (validationError) {
                    set({ error: validationError }); // Set error message in store
                    console.error("Validation failed:", validationError);
                    return {};
                }
                set({ error: null }); // Clear previous errors if validation passes

                // --- Update Logic ---
                let newPresent = [...present];
                let doctorSwappedOut: string | null = null;
                
                // Step 1: Remove doctor from source shift (if sourceShiftId is valid)
                if (sourceShift) {
                    newPresent = newPresent.map(shift => {
                        if (shift.shift_id === sourceShiftId) {
                            return { 
                                ...shift, 
                                assigned_doctor_ids: shift.assigned_doctor_ids.filter(id => id !== doctorId) 
                            };
                        }
                        return shift;
                    });
                }
               
                // Step 2: Determine if swap is needed in destination
                let newDestinationAssigned: string[] = [...destinationShift.assigned_doctor_ids];
                
                // Use original destinationShift for length check
                if (newDestinationAssigned.length < destinationShift.max_doctors) {
                    // There's an empty slot, just add the doctor
                    newDestinationAssigned.push(doctorId);
                } else {
                    // Destination is full, perform a swap.
                    // The incoming doctor replaces the first doctor in the destination.
                    doctorSwappedOut = newDestinationAssigned[0]; 
                    newDestinationAssigned[0] = doctorId;
                }

                // Apply changes to the shifts array (re-map to apply changes from above)
                newPresent = newPresent.map(shift => {
                    if (shift.shift_id === destinationShiftId) {
                        return { ...shift, assigned_doctor_ids: newDestinationAssigned };
                    }
                    return shift;
                });

                // Step 3: If a doctor was swapped out, put them back in the source shift
                if (doctorSwappedOut && sourceShift) { 
                    newPresent = newPresent.map(shift => {
                        if (shift.shift_id === sourceShiftId) {
                            return { ...shift, assigned_doctor_ids: [...shift.assigned_doctor_ids, doctorSwappedOut!] };
                        }
                        return shift;
                    });
                }
                
                const newPast = [...past, present]; 

                return { shifts: { past: newPast, present: newPresent, future: [] }, isScheduleDirty: true }; // Mark dirty
            });
        },

        unassignDoctorFromShift: (doctorId, shiftId) => {
            set((state) => {
                const { past, present } = state.shifts;
                const newPresent = present.map(shift => {
                    if (shift.shift_id === shiftId) {
                        return {
                            ...shift,
                            assigned_doctor_ids: shift.assigned_doctor_ids.filter(id => id !== doctorId)
                        };
                    }
                    return shift;
                });
                
                const newPast = [...past, present]; 
                return { shifts: { past: newPast, present: newPresent, future: [] }, isScheduleDirty: true };
            });
        },

        undo: () => {
            set((state) => {
                const { past, present, future } = state.shifts;
                if (past.length === 0) return {}; // Can't undo
                const previous = past[past.length - 1];
                const newPast = past.slice(0, past.length - 1);
                return {
                    shifts: {
                        past: newPast,
                        present: previous,
                        future: [present, ...future],
                    },
                    isScheduleDirty: true, // Undo makes it dirty
                };
            });
        },

        redo: () => {
            set((state) => {
                const { past, present, future } = state.shifts;
                if (future.length === 0) return {}; // Can't redo
                const next = future[0];
                const newFuture = future.slice(1);
                return {
                    shifts: {
                        past: [...past, present],
                        present: next,
                        future: newFuture,
                    },
                    isScheduleDirty: true, // Redo makes it dirty
                };
            });
        },

        exportScheduleToPdf: async () => {
            if (get().loading) return;

            const { year, month, isScheduleDirty, actions } = get();
            
            set({ loading: true, error: null });

            try {
                if (isScheduleDirty) {
                    if (window.confirm("Ci sono modifiche non salvate. Vuoi salvarle prima di esportare il PDF?")) {
                        await actions.saveSchedule();
                    }
                }

                const blob = await callApi(`/api/export-pdf/${year}/${month}`, 'GET', undefined, 'blob');
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;

                const monthName = new Date(year, month - 1, 1).toLocaleString('it-IT', { month: 'long' });
                link.setAttribute('download', `Turni_Guardia_${monthName}_${year}.pdf`);
                
                document.body.appendChild(link);
                link.click();
                
                link.parentNode?.removeChild(link);
                window.URL.revokeObjectURL(url);

                set({ loading: false });

            } catch (error: any) {
                set({ error: error.message, loading: false });
                alert('Errore durante l\'esportazione del PDF: ' + error.message);
            }
        }
      }
    }),
    { name: 'AppStore' }
  )
);