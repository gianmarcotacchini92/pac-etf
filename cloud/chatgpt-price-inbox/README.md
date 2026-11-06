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
