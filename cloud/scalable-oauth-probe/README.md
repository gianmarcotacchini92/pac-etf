# Scalable Cloud OAuth — verifica preliminare

Il progetto PAC ETF è pubblicato su GitHub Pages e sincronizza già il suo stato su Firebase. Questa cartella contiene un **prototipo di sola discovery OAuth** su Cloudflare Workers. Non effettua login, non memorizza token e non legge dati finanziari.

## Stato verificato (6 novembre 2026)

- Il file `cloud/scalable-oauth-probe/worker.js` è presente nel branch di prova.
- Il Worker Cloudflare `pac-etf-scalable-oauth-probe` è stato caricato.
- ✅ L'endpoint pubblico `workers.dev` del Worker è abilitato e il test HTTP `/check` è riuscito: la risorsa protetta risponde HTTP 200 e pubblica `authorization_servers`.
- ✅ La discovery dell'authorization server restituisce `authorization_endpoint=https://mcp.scalable.capital/authorize`, `token_endpoint=https://mcp.scalable.capital/token`, `registration_endpoint=https://mcp.scalable.capital/register` e PKCE `S256`.
- Il repository ufficiale Scalable CLI documenta l'uso della API Scalable e il server MCP remoto è raggiungibile tramite ChatGPT.
- ⬜ Registrazione di client con redirect URI HTTPS, token exchange e accesso alle quotazioni **non ancora verificati**.
- Un client desktop indipendente [scalable-capital-desktop](https://github.com/suneetk92/scalable-capital-desktop) descrive Dynamic Client Registration, Authorization Code + PKCE S256 e redirect loopback. Questo **non prova** che il redirect HTTPS di un Worker sia già accettato.

## Criteri da soddisfare prima dell'integrazione

1. Recuperare i metadati di protected resource e authorization server del MCP Scalable con validazione rigorosa degli URL.
2. Verificare che il provider consenta la registrazione di un client con redirect HTTPS sul dominio Cloudflare del progetto.
3. Implementare PKCE S256, un valore `state` monouso associato alla sessione dell'utente e un callback protetto.
4. Convalidare lato server l'identità Firebase dell'utente prima di usare o aggiornare credenziali di Scalable.
5. Cifrare i token a riposo e proteggerli da letture via browser, logs e repository; prevedere revoca e logout.
6. Consentire al backend esclusivamente operazioni di lettura per ISIN; impedire qualsiasi comando di trading.
7. Verificare origine e accesso alle API; imporre rate limit, validazione ISIN e divieto di cache condivisa.
8. Aggiornare solo `holdings[].price`, lasciando invariati `qty`, `buyPrice`, `target` e storico.
9. In caso di errore o dato non affidabile, conservare gli ultimi prezzi validi e indicarne il timestamp.

Non distribuire una sincronizzazione fittizia e non collegare il pulsante della PWA fino al completamento dei test di autenticazione e autorizzazione.

## Riferimenti

- https://github.com/ScalableCapital/scalable-cli
- https://github.com/suneetk92/scalable-capital-desktop

La versione pubblicata dell'app non viene modificata da questo branch.

## Test registrazione client HTTPS (nuovo)

È stato aggiunto `registration-test.js`, **non distribuito** in produzione. Il test effettua POST al solo endpoint Scalable ufficiale `https://mcp.scalable.capital/register` con callback HTTPS del nostro Worker e scope `openid profile offline_access`.

Per evitare registrazioni abusive non espone una route anonima: richiede il segreto Cloudflare `REGISTRATION_TEST_KEY` come header Bearer. Se manca il segreto, risponde 503 senza contattare Scalable. La risposta filtra qualsiasi informazione sensibile e comunica solo se la registrazione è stata accettata e se il server ha restituito un identificativo client.

**Il test non è stato ancora eseguito:** l'accettazione dell'URI HTTPS rimane da verificare. Non attivare login, callback OAuth o salvataggio token fino a quel momento. Conservare il Worker originale di sola discovery sul percorso pubblico.
