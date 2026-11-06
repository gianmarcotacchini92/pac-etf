#!/usr/bin/env python3
"""Read-only localhost bridge from PAC ETF to the official Scalable CLI.

Runs only on 127.0.0.1; never accepts credentials or executes orders.
Start with: python scalable_price_bridge.py
"""
import json
import math
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

HOST = "127.0.0.1"
PORT = 8788
ALLOWED_ORIGINS = {
    "https://gianmarcotacchini92.github.io",
}
ISIN_RE = re.compile(r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$")
MAX_SYMBOLS = 40
CLI = [ "wsl.exe", "--", "sc" ] if sys.platform == "win32" else ["sc"]


def get_quote(isin):
    try:
        proc = subprocess.run(
            CLI + ["broker", "quote", "--isin", isin, "--json"],
            capture_output=True, text=True, timeout=25, check=False
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ValueError("CLI non disponibile o richiesta scaduta") from exc
    if proc.returncode != 0:
        raise ValueError("Scalable CLI non disponibile, sessione scaduta o quotazione assente (verifica sc login)")
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise ValueError("Output CLI non valido") from exc

    # CLI releases can differ: accept only explicitly named quote-price fields,
    # never valuation, entry/FIFO price, bid/ask, or position quantity.
    def seek(node, inherited_currency=None, depth=0):
        if depth > 8 or not isinstance(node, dict):
            return None
        currency = node.get("currency") or node.get("quoteCurrency") or node.get("quote_currency") or inherited_currency
        for key in ("midPrice", "mid_price", "regularMarketPrice", "regular_market_price", "lastPrice", "last_price"):
            val = node.get(key)
            if isinstance(val, dict):
                val = val.get("amount") or val.get("value")
            try:
                price = float(val)
            except (ValueError, TypeError):
                continue
            if math.isfinite(price) and price > 0 and isinstance(currency, str):
                return {"isin": isin, "price": price, "currency": currency.upper()}
        for key in ("currentQuote", "current_quote", "quote", "marketData", "market_data", "data", "result"):
            if isinstance(node.get(key), dict):
                hit = seek(node[key], currency, depth + 1)
                if hit:
                    return hit
        return None

    result = seek(payload)
    if result is None:
        raise ValueError("Formato prezzo/valuta non riconosciuto: aggiornare l'adattatore CLI")
    if result["currency"] != "EUR":
        raise ValueError("Quotazione non EUR: conversione automatica non supportata in questo bridge")
    return result


class Handler(BaseHTTPRequestHandler):
    def send_json(self, code, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def allowed(self):
        host = self.headers.get("Host", "")
        if host not in (f"{HOST}:{PORT}", f"localhost:{PORT}"):
            self.send_json(403, {"error": "Host non autorizzato"})
            return False
        origin = self.headers.get("Origin")
        if origin is not None and origin not in ALLOWED_ORIGINS:
            self.send_json(403, {"error": "Origine non autorizzata"})
            return False
        return True

    def do_OPTIONS(self):
        if not self.allowed():
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", ""))
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if not self.allowed():
            return
        parsed = urlsplit(self.path)
        if parsed.path == "/health":
            self.send_json(200, {"status": "ok"})
            return
        if parsed.path != "/prices":
            self.send_json(404, {"error": "Endpoint inesistente"})
            return
        raw = parse_qs(parsed.query).get("isins", [""])[0]
        isins = list(dict.fromkeys(x.strip().upper() for x in raw.split(",") if x.strip()))
        if not isins or len(isins) > MAX_SYMBOLS or not all(ISIN_RE.fullmatch(x) for x in isins):
            self.send_json(400, {"error": "Elenco ISIN non valido"})
            return
        items, errors = [], []
        for isin in isins:
            try:
                items.append(get_quote(isin))
            except ValueError as exc:
                errors.append({"isin": isin, "error": str(exc)})
        self.send_json(200, {"source": "scalable-cli", "updatedAt": datetime.now(timezone.utc).isoformat(), "prices": items, "errors": errors})

    def log_message(self, format, *args):
        # Don't log holdings/ISIN query string.
        sys.stderr.write("PAC ETF bridge: richiesta ricevuta\n")


if __name__ == "__main__":
    if not shutil.which(CLI[0]):
        sys.exit("Scalable CLI / WSL non trovata. Leggi SCALABLE_SYNC.md")
    print(f"Bridge Scalable in sola lettura su http://{HOST}:{PORT}")
    print("Lascia questa finestra aperta durante la sincronizzazione.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
