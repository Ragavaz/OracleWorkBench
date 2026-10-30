// Vantage Workbench Local — the only module that talks to Oracle.
// Fusion pods: HTTP Basic (integration user). OIC 3 Developer APIs: OAuth client credentials (Oracle requires OAuth there).
const tokenCache = new Map(); // envId -> { token, exp }
const MAX_LOG = 400_000;

async function oicToken(env, secrets) {
  const c = tokenCache.get(env.id);
  if (c && c.exp > Date.now() + 60_000) return c.token;
  const a = env.auth || {};
  if (!a.tokenUrl || !a.clientId || !secrets.clientSecret) throw Object.assign(new Error("OIC environment needs a token URL, client ID and client secret."), { code: "config" });
  const res = await fetch(a.tokenUrl, {
    method: "POST", signal: AbortSignal.timeout(30_000),
    headers: { Authorization: "Basic " + Buffer.from(a.clientId + ":" + secrets.clientSecret).toString("base64"), "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: "grant_type=client_credentials" + (a.scope ? "&scope=" + encodeURIComponent(a.scope) : ""),
  });
  const txt = await res.text(); let j = {}; try { j = JSON.parse(txt); } catch {}
  if (!res.ok || !j.access_token) throw Object.assign(new Error("Token request failed (" + res.status + "): " + (j.error_description || j.error || txt.slice(0, 200))), { code: "auth", status: res.status });
  tokenCache.set(env.id, { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 });
  return j.access_token;
}

export function buildUrl(env, path, query) {
  const u = new URL(path.startsWith("http") ? path : env.host + (path.startsWith("/") ? "" : "/") + path);
  if (!u.href.startsWith(env.host + "/")) throw Object.assign(new Error("Requests may only go to the environment host."), { code: "host" });
  Object.entries(query || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v)); });
  if (env.kind === "oic" && env.oicInstance && u.pathname.startsWith("/ic/api/") && !u.searchParams.has("integrationInstance")) u.searchParams.set("integrationInstance", env.oicInstance);
  // Fusion REST expects the ; and , inside q/finder unescaped; URLSearchParams escapes them, which Fusion also accepts.
  return u;
}

export async function call(env, secrets, req) {
  const u = buildUrl(env, req.path, req.query);
  const headers = { Accept: req.accept || "application/json", ...(req.headers || {}) };
  if (env.kind === "oic") headers.Authorization = "Bearer " + (await oicToken(env, secrets));
  else {
    if (!env.auth.username || !secrets.password) throw Object.assign(new Error("Fusion environment needs a username and password."), { code: "config" });
    headers.Authorization = "Basic " + Buffer.from(env.auth.username + ":" + secrets.password).toString("base64");
  }
  let body = req.body;
  if (body !== undefined && typeof body !== "string") { body = JSON.stringify(body); if (!headers["Content-Type"]) headers["Content-Type"] = "application/json"; }
  const t0 = Date.now();
  let res;
  try { res = await fetch(u, { method: req.method || "GET", headers, body, signal: AbortSignal.timeout(req.timeoutMs || 120_000), redirect: "manual" }); }
  catch (e) { throw Object.assign(new Error(e.name === "TimeoutError" ? "Oracle did not answer within " + Math.round((req.timeoutMs || 120000) / 1000) + " s." : "Could not reach " + u.host + ": " + (e.cause && e.cause.code || e.message)), { code: "network" }); }
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch {}
  if (res.status === 401 && env.kind === "oic") tokenCache.delete(env.id);
  return {
    status: res.status, ok: res.ok, ms: Date.now() - t0, url: u.href, method: req.method || "GET",
    contentType: res.headers.get("content-type") || "", location: res.headers.get("location") || undefined,
    json, text: json ? undefined : text.slice(0, MAX_LOG), truncated: !json && text.length > MAX_LOG,
  };
}

export function redactRequest(env, req) {
  const u = buildUrl(env, req.path, req.query);
  const h = { ...(req.headers || {}) }; delete h.Authorization;
  let body = req.body;
  if (typeof body === "string" && body.length > 4000) body = body.slice(0, 4000) + "…(" + body.length + " characters)";
  if (body && typeof body === "object") body = JSON.parse(JSON.stringify(body, (k, v) => (typeof v === "string" && v.length > 4000 ? v.slice(0, 80) + "…(" + v.length + " characters)" : v)));
  if (typeof body === "string") body = body.replace(/(<wsse:Password[^>]*>)[^<]*(<\/wsse:Password>)/g, "$1••••$2");
  return { method: req.method || "GET", url: u.href, headers: h, body, auth: env.kind === "oic" ? "OAuth bearer (client credentials)" : "Basic " + (env.auth.username || "") };
}
