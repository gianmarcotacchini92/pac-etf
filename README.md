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
3. **Firestore → Regole:**

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /pacStates/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

La configurazione `firebaseConfig` del progetto è già incorporata in `index.html`.

## Import dei dati esistenti

Usa **Esporta JSON** dalla versione con i tuoi dati e **Importa JSON** nella nuova:
al primo salvataggio i dati vengono spinti in cloud.
