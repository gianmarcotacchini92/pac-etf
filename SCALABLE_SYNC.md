# Sincronizzazione prezzi Scalable (PC Windows)

Questa funzione aggiorna **solo il prezzo corrente** dei titoli presenti in PAC ETF. Quantità, prezzo medio di carico, allocazioni e storico non vengono modificati. Il valore aggiornato viene sincronizzato con Firebase tramite il meccanismo già presente nell'app, quando si è collegati a Google.

## Prerequisiti

1. **Windows 10/11**, Python 3 e **WSL con Ubuntu 24.04 (o Linux con glibc >= 2.38)**. La CLI ufficiale Scalable non ha al momento un eseguibile Windows distribuito ufficialmente.
2. Installa Scalable CLI **da [release ufficiali](https://github.com/ScalableCapital/scalable-cli/releases)** all'interno di WSL, seguendo il [README ufficiale](https://github.com/ScalableCapital/scalable-cli#install). Non utilizzare build non attendibili.
3. Dal sito Scalable, in Profilo > Sicurezza > Agentic Investing, attiva la CLI. In WSL esegui:

   ```bash
   sc login --local-read-only
   sc whoami
   sc broker portfolios
   sc broker quote --isin IE00B4ND3602 --json
   ```

   Completa login e 2FA **soltanto** dal flusso ufficiale. Se hai più portafogli, seleziona quello corretto con `sc broker context select --portfolio-id ...`.
4. In Windows, dalla cartella clonata del repository (dove si trova lo script), esegui:

   ```powershell
   py -3 scalable_price_bridge.py
   ```

   Il bridge rimane attivo sulla sola interfaccia locale `127.0.0.1:8788`; lascia aperta la finestra. Puoi verificarlo aprendo http://127.0.0.1:8788/health sullo stesso PC.
5. Apri **PAC ETF** da `https://gianmarcotacchini92.github.io/pac-etf/` sullo stesso PC e premi **Sincronizza Scalable**. Se Chrome richiede il permesso di accesso alla rete locale, autorizzalo per questo sito. Con il telefono non è necessario avviare il bridge: i prezzi aggiornati compaiono mediante Firebase.

## Comportamento e limiti

- La sorgente è **Scalable CLI** tramite `sc broker quote --isin ... --json`, non Yahoo Finance.
- Si aggiorna soltanto un titolo con ISIN valido che restituisce **prezzo e valuta EUR**. Quotazioni mancanti, non EUR o in formato non riconosciuto sono saltate e i prezzi precedenti restano invariati.
- L'aggiornamento è manuale. Il PC e il bridge devono essere attivi. La sessione della CLI richiede un nuovo login interattivo **entro 7 giorni al massimo**, o prima per inattività.
- **Attenzione:** il valore mid/last della quotazione restituita dalla CLI può differire dal prezzo di esecuzione degli ordini o da altre schermate del broker; il bridge non garantisce una quotazione eseguibile.
- Per sicurezza, nessuna password o token viene immesso nella PWA, in GitHub o su Firebase. Il bridge accetta richieste browser soltanto dal dominio GitHub Pages del progetto, è in sola lettura e risponde solo su loopback.
- Su alcuni browser, versioni o policy aziendali, le richieste da GitHub Pages a `127.0.0.1` possono essere bloccate. In quel caso la funzione non aggiorna alcun prezzo; verifica le autorizzazioni di accesso locale del browser.
- Il formato JSON della CLI può variare fra versioni. Se un aggiornamento segnala «Formato prezzo/valuta non riconosciuto», bisogna adeguare l'adattatore. Evita di caricare output della CLI con dati personali in issue pubbliche.

## Verifica prima di usarlo con dati reali

Verifica anzitutto `sc broker quote --isin ... --json` nella stessa installazione WSL. Il bridge accetta solo prezzi numerici positivi e valuta EUR; non deduce prezzi da costo di carico o controvalore del portafoglio. Controlla manualmente un paio di ISIN dopo la prima sincronizzazione e verifica su un secondo dispositivo che Firebase abbia recepito i prezzi. Il server non esegue operazioni di trading.
