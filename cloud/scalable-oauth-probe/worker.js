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
export default {
  async fetch(request) {
    if (new URL(request.url).pathname !== "/check") return new Response("Not found", { status: 404 });
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
