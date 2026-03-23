# Guardia Medica Scheduler

Applicazione web per la gestione e generazione automatica dei turni di guardia medica. Funziona interamente nel browser — nessun server richiesto. I dati vengono salvati localmente nel browser.

**🌐 [Apri l'applicazione](https://raffysommy.github.io/guardiamedica/)**

## Funzionalità

- 📅 **Generazione automatica** dei turni mensili con algoritmo intelligente
- 👨‍⚕️ **Gestione medici** — aggiungi, modifica, elimina
- 🤝 **Affinità tra colleghi** — definisci preferenze di coppia con drag-and-drop
- 🚫 **Indisponibilità** — segna le date in cui un medico non è disponibile
- ✋ **Drag-and-drop** — modifica manuale dei turni nel calendario
- ↩️ **Annulla/Ripristina** — undo/redo per le modifiche manuali
- 📄 **Esporta PDF** — scarica il calendario in formato PDF
- 💾 **Salvataggio locale** — i dati restano nel browser tra una sessione e l'altra

## Regole dell'algoritmo

- Ogni turno richiede **2 medici**
- **Mai 3+ notti consecutive** per lo stesso medico
- **Penalità pesante** per 2 notti consecutive
- **Distribuzione settimanale** — evita di concentrare troppi turni in pochi giorni
- **Rispetta le preferenze** — affinità tra colleghi e distribuzione turni preferita
- **Festività italiane** calcolate automaticamente (inclusa Pasqua)

## Sviluppo

```bash
cd app
npm install
npm run dev    # Server dev su localhost:5173
npm run build  # Build produzione → dist/
```

## Deploy

Il deploy avviene automaticamente su GitHub Pages ad ogni push su `main` tramite GitHub Actions.
