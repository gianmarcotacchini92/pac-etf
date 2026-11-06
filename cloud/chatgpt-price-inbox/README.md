# ChatGPT → Scalable → Cloudflare → PAC ETF → Firebase

Questa è un'**alternativa a GitHub Actions**, perché il collegamento GitHub in ChatGPT non dispone di workflow_dispatch.

## Sicurezza
- Il Worker convalida firma RS256, issuer, audience, scadenza e subject dei Firebase ID token.
- KV è privato: i prezzi sono indicizzati per UID Firebase e non pubblicati nel repository.
- L'API restituisce soltanto prezzi, ISIN e timestamp al proprietario autenticato.
- Il Worker non accede a Scalable, non conserva token Scalable, non può effettuare trading.
- L'app deve conservare quantità, prezzi medi e obiettivi; aggiornare solo prezzi EUR e timestamp.
- Il servizio deve essere testato in un branch prima del merge.

## Stato
- Namespace Cloudflare KV creato: `pac-etf-chatgpt-prices`.
- Worker sorgente predisposto, ma **non ancora distribuito né collegato alla PWA**.
- Occorre configurare il binding `PRICE_INBOX`, completare l'interfaccia Firebase e verificare login e lettura.
- ChatGPT potrà scrivere quotazioni nel KV tramite il collegamento Cloudflare, dopo aver associato il corretto UID Firebase.
- Non inserire posizioni/quantità o token nel repository pubblico.

## Implementazione (6 novembre 2026)

- Worker distribuito su `https://pac-etf-chatgpt-prices.gianmarcotacchini.workers.dev/prices` con binding `PRICE_INBOX` al namespace KV privato.
- `index.html` nel branch mostra `Carica prezzi da ChatGPT` e `Copia ID sincronizzazione`; la lettura è protetta da Firebase ID token e aggiorna esclusivamente le quotazioni EUR corrispondenti per ISIN.
- Per l'associazione una tantum, l'utente copia il Firebase UID e lo comunica a ChatGPT. L'UID non è un token di autenticazione; il Worker verifica comunque la firma del Firebase JWT.
- ChatGPT salva il payload prezzi nel KV usando il collegamento Cloudflare autenticato; **non** nel repository GitHub.
- **Non ancora testato end-to-end**: validare firma JWT e CORS dal browser, lettura KV, corrispondenza UID, assenza di sovrascritture errate, gestione prezzi non EUR e sincronizzazione Firebase.
- Per evitare un falso aggiornamento, nessuna quotazione viene generata se Scalable non restituisce un valore EUR valido.
- Il pulsante dell'app non può avviare autonomamente ChatGPT: l'utente deve prima chiedere «Sincronizza PAC ETF» in ChatGPT e poi premere il pulsante nella PWA.
