# ChatGPT → Scalable → PAC ETF (senza JSON)

Questa integrazione **non usa OAuth Scalable nella PWA** e **non richiede software locale**.

## Flusso

1. L'utente scrive a ChatGPT: **«Sincronizza PAC ETF»**.
2. ChatGPT usa il collegamento Scalable già autorizzato e recupera le quotazioni del broker.
3. ChatGPT usa il collegamento Cloudflare già autorizzato per aggiornare direttamente la tabella privata `quotes` del database D1 `pac-etf-chatgpt-quotes`.
4. L'utente apre PAC ETF e preme **Sincronizza Scalable** (dopo il login Google già disponibile).
5. Il Worker `pac-etf-chatgpt-bridge` verifica firma e claim del Firebase ID token (progetto `sincro-ai`) con le chiavi pubbliche Google, controlla l'email nella tabella privata `allowed_users`, poi restituisce **solo** quotazioni in EUR e timestamp.
6. L'app applica solo i campi `price`, `currency`, `srcPrice`, `srcCurrency` ai titoli con ISIN corrispondente; chiama `save()` che salva in locale e sincronizza con Firebase per tutti i dispositivi.

## Sicurezza

- Nessun dato del portafoglio o credenziale Scalable viene pubblicato su GitHub.
- Cloudflare D1 è privato e configurato per la giurisdizione UE.
- La tabella `allowed_users` e i dati `quotes` sono conservati **solo in D1**, non nel repository.
- Il Worker accetta solo ID token Firebase verificati con firma RS256, `aud`, `iss`, `exp`, `iat`, `sub` e `email_verified` coerenti. Il browser non può decidere liberamente quale account leggere.
- La lettura dei prezzi non permette ordini o modifiche sul broker.
- Risposte `Cache-Control: no-store`; CORS limitato all'origine GitHub Pages.
- I prezzi senza timestamp valido o vecchi di oltre 14 giorni vengono ignorati.
- Le posizioni manuali e i campi `qty`, `buyPrice`, `target`, storico mensile e configurazioni non vengono modificati.
- Se una fonte non risponde, non azzerare i prezzi esistenti.
- L'app non contiene segreti Cloudflare o token Scalable.

## Risorse

- Worker: `pac-etf-chatgpt-bridge` (separato dal vecchio probe OAuth).
- Database: `pac-etf-chatgpt-quotes`, D1 UUID `d8fc3c33-19d1-4993-9857-d06e3921f095`.
- API: `GET https://pac-etf-chatgpt-bridge.gianmarcotacchini.workers.dev/prices`
- Intestazione: `Authorization: Bearer <Firebase ID token>`
- Repository: questa cartella contiene soltanto il codice del Worker, non snapshots finanziari.

## Cosa è stato verificato

- Il collegamento Scalable ha restituito otto titoli con ISIN, quotazione e timestamp.
- Il collegamento Cloudflare ha inserito otto righe D1 private.
- Il Worker è stato caricato con il binding D1 e il dominio workers.dev risulta abilitato.
- La sintassi JavaScript dell'interfaccia esistente aggiornata è stata controllata.

## Cosa resta da verificare prima del merge

- Prova end-to-end del browser con login Google realmente autenticato sul GitHub Pages dell'app.
- Autorizzazione dell'account Firebase nella allowlist D1 (attualmente configurato con l'email del proprietario Cloudflare).
- Corrispondenza ISIN tra titoli di PAC ETF e titoli Scalable.
- Ricaricamento dell'app su un secondo dispositivo e sincronizzazione Firebase.

**Importante:** questo flusso NON avvia un GitHub Action e non aggiorna Firebase senza apertura dell'app. Il primo aggiornamento avviene quando l'utente preme il pulsante; poi Firebase distribuisce le modifiche agli altri dispositivi. È stato scelto perché il collegamento GitHub ChatGPT attuale non espone un'operazione di avvio workflow con payload riservato. Il risultato pratico è l'assenza del copia-incolla JSON.

## Nota sul vecchio bridge locale

Lo script `scalable_price_bridge.py` e la sua documentazione restano nella branch principale come storia del progetto. La nuova funzione dell'app **non usa** il bridge locale né Scalable CLI.

## Aggiornamenti successivi

Una richiesta «Sincronizza PAC ETF» in ChatGPT deve riutilizzare questo database e Worker, facendo un upsert di **soli prezzi e timestamp verificati**, senza mai inviare numeri di quote, contanti o dati personali tramite repository pubblici.
