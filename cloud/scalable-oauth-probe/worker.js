// OAuth discovery-only: no user account data, secrets, authentication, or token exchange.
// It validates HTTPS, the Scalable domain and refuses redirects when fetching metadata.
function trusted(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password &&
      (u.hostname === "scalable.capital" || u.hostname.endsWith(".scalable.capital"));
  } catch { return false; }
}
async function discover(url) {
  if (!trusted(url)) return { error: "untrusted_url" };
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(8000)
    });
    if (response.status >= 300 && response.status < 400) return { status: response.status, error: "redirect_rejected" };
    if (!response.ok) return { status: response.status, error: "http_error" };
    const payload = await response.json().catch(() => ({}));
    return {
      status: response.status,
      resource: typeof payload.resource === "string" ? payload.resource : null,
      authorization_servers: Array.isArray(payload.authorization_servers)
        ? payload.authorization_servers.filter(trusted) : [],
      issuer: trusted(payload.issuer) ? payload.issuer : null,
      authorization_endpoint: trusted(payload.authorization_endpoint) ? payload.authorization_endpoint : null,
      token_endpoint: trusted(payload.token_endpoint) ? payload.token_endpoint : null,
      registration_endpoint: trusted(payload.registration_endpoint) ? payload.registration_endpoint : null,
      code_challenge_methods_supported: Array.isArray(payload.code_challenge_methods_supported)
        ? payload.code_challenge_methods_supported : []
    };
  } catch (error) { return { error: "metadata_unavailable" }; }
}
const SCALABLE_REGISTER = "https://mcp.scalable.capital/register";
const REDIRECT_URI = "https://pac-etf-scalable-oauth-probe.gianmarcotacchini.workers.dev/oauth/callback";
function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
function isValidBearer(value) {
  return typeof value === "string" && value.startsWith("Bearer ") && value.length > 39 && !/[\r\n]/.test(value);
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

async function registrationTest(request, env) {
  if (!env.REGISTRATION_TEST_KEY || env.REGISTRATION_TEST_KEY.length < 32)
    return json(503, { error: "registration_test_disabled" });
  const header = request.headers.get("Authorization");
  if (!isValidBearer(header) || !(await safeEqual(header.slice(7), env.REGISTRATION_TEST_KEY)))
    return json(403, { error: "forbidden" });
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
  if (response.status >= 300 && response.status < 400)
    return json(502, { registration: "redirect_rejected", status: response.status });
  const body = await response.json().catch(() => ({}));
  // Registration is unauthenticated and the caller is secret-gated.
  // Return only short, plain-text diagnostic fields from unsuccessful responses.
  // Do not leak registration access tokens, client secrets or response headers.
  const safeReason = value => typeof value === "string" &&
    value.length <= 350 && !value.includes("\\n") && !value.includes("\\r") &&
    !/[<>{}]/.test(value) && !/bearer|client_secret|access_token|refresh_token/i.test(value)
    ? value : null;
  const accepted = response.ok && typeof body.client_id === "string" && body.client_id.length > 0;
  return json(accepted ? 200 : 502, {
    registration: accepted ? "accepted" : "rejected",
    http_status: response.status,
    error: accepted ? null : safeReason(body.error),
    error_description: accepted ? null : safeReason(body.error_description || body.message),
    public_client: accepted ? body.token_endpoint_auth_method === "none" : null,
    client_id_present: accepted,
    redirect_uri: REDIRECT_URI
  });
}
export default {
  async fetch(request, env) {
    const route = new URL(request.url).pathname;
    if (route === "/test-registration") {
      if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
      return registrationTest(request, env);
    }
    if (route !== "/check") return new Response("Not found", { status: 404 });
    const resource = await Promise.all([
      discover("https://mcp.scalable.capital/.well-known/oauth-protected-resource/mcp"),
      discover("https://mcp.scalable.capital/.well-known/oauth-protected-resource")
    ]);
    const issuers = [...new Set(resource.flatMap(r => r.authorization_servers || []))];
    const authorization = await Promise.all(issuers.map(async issuer => {
      const u = new URL(issuer);
      const path = u.origin + "/.well-known/oauth-authorization-server" +
        (u.pathname === "/" ? "" : u.pathname);
      return { issuer, metadata: await discover(path) };
    }));
    return new Response(JSON.stringify({ type: "oauth_discovery_only", resource, authorization }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }
};
