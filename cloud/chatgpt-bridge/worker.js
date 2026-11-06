// Private quote reader for PAC ETF. The Scalable connector never reaches this Worker.
// ChatGPT writes price snapshots directly to private D1 using the owner's Cloudflare connection.
const FIREBASE_PROJECT_ID = "sincro-ai";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const ALLOWED_ORIGIN = "https://gianmarcotacchini92.github.io";
const enc = new TextEncoder();
let keyCache = null;
let keyCacheUntil = 0;

function response(status, payload, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin"
  };
  if (origin === ALLOWED_ORIGIN) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(payload), { status, headers });
}

function decodePart(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error("invalid_token");
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "=")), ch => ch.charCodeAt(0));
}

async function verifyFirebaseIdToken(raw) {
  if (typeof raw !== "string" || raw.length > 8192 || raw.length < 50) throw new Error("invalid_token");
  const parts = raw.split(".");
  if (parts.length !== 3) throw new Error("invalid_token");
  const header = JSON.parse(new TextDecoder().decode(decodePart(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decodePart(parts[1])));
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("invalid_token");
  if (!keyCache || Date.now() > keyCacheUntil) {
    const res = await fetch(GOOGLE_JWKS_URL, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) throw new Error("keys_unavailable");
    const body = await res.json();
    if (!Array.isArray(body.keys)) throw new Error("keys_unavailable");
    keyCache = body.keys;
    keyCacheUntil = Date.now() + 15 * 60 * 1000;
  }
  let jwk = keyCache.find(k => k.kid === header.kid && k.kty === "RSA");
  if (!jwk) {
    keyCache = null;
    throw new Error("unknown_key");
  }
  const publicKey = await crypto.subtle.importKey("jwk", jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey,
    decodePart(parts[2]), enc.encode(parts[0] + "." + parts[1]));
  if (!valid) throw new Error("invalid_signature");
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== FIREBASE_PROJECT_ID ||
      claims.iss !== "https://securetoken.google.com/" + FIREBASE_PROJECT_ID ||
      typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 128 ||
      !Number.isInteger(claims.exp) || claims.exp <= now ||
      !Number.isInteger(claims.iat) || claims.iat > now + 60 ||
      claims.iat < now - 25 * 60 * 60 ||
      claims.email_verified !== true ||
      typeof claims.email !== "string" || claims.email.length > 320) {
    throw new Error("invalid_claims");
  }
  return { uid: claims.sub, email: claims.email.toLowerCase() };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS" && url.pathname === "/prices") {
      if (origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization",
          "Access-Control-Max-Age": "600",
          "Vary": "Origin"
        }
      });
    }
    if (url.pathname === "/health" && request.method === "GET")
      return response(200, { status: "ready", data: "private", source: "chatgpt-scalable" }, origin);
    if (url.pathname !== "/prices" || request.method !== "GET")
      return response(404, { error: "not_found" }, origin);
    if (origin && origin !== ALLOWED_ORIGIN)
      return response(403, { error: "origin_not_allowed" }, origin);
    if (!env.QUOTES_DB) return response(503, { error: "database_not_configured" }, origin);
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer "))
      return response(401, { error: "firebase_login_required" }, origin);
    try {
      const user = await verifyFirebaseIdToken(authorization.slice(7));
      const allowed = await env.QUOTES_DB.prepare(
        "SELECT 1 FROM allowed_users WHERE email = ?"
      ).bind(user.email).first();
      if (!allowed) return response(403, { error: "account_not_authorized" }, origin);
      const data = await env.QUOTES_DB.prepare(
        "SELECT isin, price, currency, quoted_at AS timestampUtc, fetched_at AS fetchedAt FROM quotes WHERE email = ? ORDER BY isin"
      ).bind(user.email).all();
      const prices = (data.results || []).filter(row =>
        /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(row.isin) &&
        Number.isFinite(row.price) && row.price > 0 &&
        row.currency === "EUR");
      return response(200, { source: "scalable-chatgpt", prices }, origin);
    } catch (e) {
      if (String(e.message || "").includes("unavailable"))
        return response(503, { error: "auth_service_unavailable" }, origin);
      return response(401, { error: "invalid_firebase_session" }, origin);
    }
  }
};
