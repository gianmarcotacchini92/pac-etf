# Gestione PAC ETF (cloud)

App single-file per la gestione di un piano di accumulo ETF con:

- portafoglio, grafici e regole di investimento;
- **sincronizzazione in tempo reale** tra dispositivi via Firebase Firestore;
- **accesso con Google**;
- installabile come **PWA** su Android/desktop.

## Uso

Apri `index.html` (ospitato su HTTPS, es. GitHub Pages), accedi con Google e i dati
vengono sincronizzati tra tutti i dispositivi collegati allo stesso account.

## Configurazione Firebase (una volta sola sul progetto)

1. **Authentication → Sign-in method → Google → Abilita.**
2. **Authentication → Settings → Authorized domains:** aggiungi il dominio di hosting
   (es. `tuonome.github.io`). `localhost` è già autorizzato.
3. **Firestore → Regole:** apri [Firebase Console](https://console.firebase.google.com/), seleziona il progetto usato dall'app, quindi Firestore Database → Regole. Copia il contenuto del file [firestore.rules](firestore.rules) e premi **Pubblica**.

   **Importante:** il file GitHub NON pubblica automaticamente le regole Firestore. Senza questo passaggio, le vecchie app possono ancora scrivere. Le nuove regole ammettono solo il protocollo v2 e rifiutano gli aggiornamenti che eliminano identificativi di mesi esistenti. La cancellazione manuale di singoli mesi richiede un futuro protocollo esplicito, perché altrimenti riapparirebbero dopo la sincronizzazione.

   Dopo la pubblicazione, apri la versione aggiornata di PAC ETF e usa **Account → Verifica e riconcilia lo storico con Firebase**. La prima scrittura aggiorna il documento allo schema v2. I vecchi client verranno respinti anche se ancora presenti in cache.

   **Limiti:** il blocco tutela gli identificativi dei mesi e l'accesso di client legacy, non evita ogni possibile conflitto sui valori interni di un mese o sulle posizioni ETF. Per una protezione completa serve un modello a documenti separati con versioni e revisioni.


La configurazione `firebaseConfig` del progetto è già incorporata in `index.html`.

## Import dei dati esistenti

Usa **Esporta JSON** dalla versione con i tuoi dati e **Importa JSON** nella nuova:
al primo salvataggio i dati vengono spinti in cloud.
