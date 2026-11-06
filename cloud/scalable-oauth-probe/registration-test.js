// Server-side OAuth client-registration diagnostic.
// This endpoint is deliberately not a login endpoint and does not handle user tokens.
// Configure REGISTRATION_TEST_KEY as a Cloudflare Worker secret before deployment.
const SCALABLE_REGISTER = "https://mcp.scalable.capital/register";
const REDIRECT_URI = "https://pac-etf-scalable-oauth-probe.gianmarcotacchini.workers.dev/oauth/callback";

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
function isValidBearer(value) {
  return typeof value === "string" && /^Bearer [A-Za-z0-9_-]{32,}$/.test(value);
}
async function safeEqual(a, b) {
  // Hash and compare without short-circuiting on byte equality.
  const te = new TextEncoder();
  const [ha, hb] = await Promise.all([a, b].map(v => crypto.subtle.digest("SHA-256", te.encode(v))));
  const aa = new Uint8Array(ha), bb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET")
      return json(200, { state: "registration_diagnostic_available", login: false, trading: false });
    if (url.pathname !== "/test-registration" || request.method !== "POST")
      return json(404, { error: "not_found" });
    if (!env.REGISTRATION_TEST_KEY || env.REGISTRATION_TEST_KEY.length < 32)
      return json(503, { error: "registration_test_disabled" });
    const header = request.headers.get("Authorization");
    if (!isValidBearer(header) || !(await safeEqual(header.slice(7), env.REGISTRATION_TEST_KEY)))
      return json(403, { error: "forbidden" });
    // No user account is authenticated here. Register ONLY this fixed client redirect URI.
    const response = await fetch(SCALABLE_REGISTER, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        client_name: "PAC ETF Scalable Cloud Test",
        redirect_uris: [REDIRECT_URI],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        scope: "openid profile offline_access"
      }),
      signal: AbortSignal.timeout(12000)
    });
    // Never return raw response, credentials, full OAuth metadata or headers.
    if (response.status >= 300 && response.status < 400)
      return json(502, { registration: "redirect_rejected", status: response.status });
    const body = await response.json().catch(() => ({}));
    return json(200, {
      registration: response.ok && typeof body.client_id === "string" ? "accepted" : "rejected",
      http_status: response.status,
      public_client: body.token_endpoint_auth_method === "none",
      client_id_present: typeof body.client_id === "string" && body.client_id.length > 0,
      redirect_uri: REDIRECT_URI
    });
  }
};
