# Guida all'uso del Guardia Medica Scheduler

Benvenuto nel Guardia Medica Scheduler! Questa guida ti aiuterà a configurare, avviare e utilizzare tutte le funzionalità dell'applicazione.

## 1. Setup e Avvio dell'Applicazione

Prima di iniziare, assicurati di aver completato il setup iniziale. Per le istruzioni dettagliate di installazione dei prerequisiti e delle dipendenze, consulta il file [README.md](./README.md).

Per avviare l'applicazione:

1.  **Avvia il Backend (server Python):**
    Apri un terminale e naviga nella directory `guardiamedica/backend`. Esegui:
    ```bash
    ./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
    ```
    Lascia questo terminale aperto.

2.  **Avvia il Frontend (applicazione React):**
    Apri un **nuovo** terminale e naviga nella directory `guardiamedica/frontend`. Esegui:
    ```bash
    npm run dev
    ```
    Il tuo browser dovrebbe aprirsi automaticamente all'indirizzo dell'applicazione (solitamente `http://localhost:5173/`).

## 2. Navigazione nell'Applicazione

L'applicazione è divisa in tre sezioni principali, accessibili tramite la barra di navigazione in alto:

*   **Calendario:** La vista principale per visualizzare, generare e modificare i turni.
*   **Gestione Medici:** Per aggiungere, modificare o eliminare i medici e definire le loro preferenze.
*   **Gestione Indisponibilità:** Per specificare i giorni in cui i medici non sono disponibili.

## 3. Sezione Calendario

Questa è la schermata principale dove puoi gestire i turni.

*   **Selezione Anno e Mese:** In alto a sinistra, trovi due dropdown per selezionare l'anno e il mese desiderati. Al cambio di selezione, l'applicazione tenterà automaticamente di caricare un calendario già salvato per quel periodo.
*   **Pulsanti di Gestione Calendario (in base allo stato):**
    *   **Genera Calendario:** Se non esiste un calendario per il mese/anno selezionato, vedrai questo pulsante. Cliccalo per generare un nuovo calendario basato sui medici, le loro indisponibilità e preferenze.
    *   **Cancella Calendario:** Appare quando un calendario è visualizzato (sia generato che caricato da salvataggio). Cliccalo per rimuovere il calendario corrente. Ti verrà chiesta una conferma.
    *   **Salva Modifiche:** Appare solo se hai apportato modifiche manuali al calendario (tramite drag-and-drop) dall'ultima generazione/salvataggio. Cliccalo per salvare le modifiche.

*   **Visualizzazione Turni:** La tabella mostra i giorni del mese e i turni corrispondenti. Per i turni feriali (lunedì-venerdì) c'è un "Turno Serale". Per sabati, domeniche, festivi e prefestivi ci sono i turni "Giorno" e "Notte". Ogni cella del turno mostrerà i badge dei medici assegnati.

*   **Drag-and-Drop per Modifiche Manuali:**
    *   **Come Spostare un Medico:** Clicca e trascina il badge di un medico da un turno all'altro.
    *   **Validazioni:** L'applicazione eseguirà controlli automatici:
        *   Non puoi spostare un medico in un giorno di sua indisponibilità.
        *   Non puoi assegnare un medico a due turni contigui.
        *   Non puoi assegnare un medico a un turno se è già presente in quel turno.
        *   Se il trascinamento viola una regola, vedrai un messaggio di errore e l'operazione non sarà consentita.
    *   **Logica di Swap:** Se trascini un medico in un turno che è già pieno (con il numero massimo di medici assegnati), avverrà uno "swap". Il medico che hai trascinato prenderà il posto del primo medico presente nel turno di destinazione, e quest'ultimo tornerà al turno di origine.

*   **Annulla / Ripristina:** I pulsanti "Annulla" e "Ripristina" ti permettono di annullare o ripristinare le ultime modifiche manuali effettuate tramite drag-and-drop. Saranno abilitati/disabilitati in base alla disponibilità di azioni nella cronologia.

*   **Importante:** Ricorda di cliccare **"Salva Modifiche"** dopo aver apportato modifiche manuali al calendario se vuoi che vengano mantenute quando riapri l'applicazione o cambi mese.

## 4. Sezione Gestione Medici

Qui puoi gestire i medici registrati nel sistema.

*   **Aggiungi Nuovo Medico:** Clicca sul pulsante "Aggiungi Nuovo Medico" per aprire un modale. Compila i campi:
    *   **ID Medico:** Un identificativo univoco per il medico (es. `doc7`).
    *   **Nome:** Il nome completo del medico (es. `Dott. Rossi`).
    *   **Max Turni:** Il numero massimo di turni che il medico può fare in un mese (soft constraint per l'algoritmo).
    *   **Preferenze Distribuzione Turni:** Campi numerici per indicare le preferenze dell'algoritmo (es. `5` turni feriali, `1` sabato giorno, ecc.).
*   **Modifica Medico:** Clicca sul pulsante "Modifica" accanto a un medico esistente per aprire il modale di modifica. Puoi cambiare tutti i dettagli del medico, incluso l'ID (se non in uso), il nome, i turni massimi e le preferenze di distribuzione.

*   **Gestione Preferenze Affinità Colleghi (Drag-and-Drop):**
    *   All'interno del modale di modifica del medico, trovi una sezione "Preferenze Affinità Colleghi".
    *   Qui puoi **riordinare gli altri medici** trascinandoli. Il medico in cima alla lista è il più affine, mentre quello in fondo è il meno affine. Questo ordine influenzerà l'algoritmo di assegnazione del backend quando cerca il secondo medico per un turno.
    *   Dopo aver riordinato, clicca **"Salva Modifiche"** nel modale per applicare i cambiamenti.
*   **Elimina Medico:** Clicca sul pulsante "Elimina" accanto a un medico per rimuoverlo dal sistema. Ti verrà chiesta una conferma.

## 5. Sezione Gestione Indisponibilità

Qui puoi specificare i giorni in cui i medici non sono disponibili per lavorare.

*   **Seleziona Medico:** Utilizza il dropdown "Seleziona Medico" per scegliere il medico di cui vuoi gestire le indisponibilità.
*   **Calendario Indisponibilità:** Sotto il dropdown, apparirà un calendario. Clicca su qualsiasi data per selezionarla o deselezionarla come giorno di indisponibilità. Le date selezionate verranno evidenziate.
*   **Salva Indisponibilità:** Dopo aver selezionato le date, clicca sul pulsante "Salva Indisponibilità" per applicare le modifiche.
*   **Verifica:** Torna alla sezione "Calendario" e genera un nuovo calendario. Il medico selezionato non verrà assegnato ai turni nei giorni che hai marcato come indisponibile.

## Finalizzazione

L'applicazione è ora completa e pronta all'uso. Se riscontri problemi o hai suggerimenti, non esitare a segnalarli.
