// Northstar Market — requests API (Cloudflare Worker)
// Receives visitor website-request submissions, stores them in KV,
// and (optionally) forwards them to the owner's email via the SEND_EMAIL binding.

// KV namespace is bound as REQUESTS (configured in wrangler.toml).
// Optional email binding is named SEND_EMAIL (Cloudflare Email Routing).

const OWNER_EMAIL = "hs9961984@gmail.com";
const ALLOWED_ORIGIN = "https://notknowngamerz.github.io";
// Admin token for viewing submissions. Change this to something only you know.
const ADMIN_SECRET = "northstar-admin-2026";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": ALLOWED_ORIGIN,
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    },
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function handleRequest(request) {
  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (request.method === "GET") {
    const url = new URL(request.url);
    if (url.searchParams.get("secret") !== ADMIN_SECRET) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const indexRaw = await REQUESTS.get("index");
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    const items = [];
    for (const entry of index) {
      const full = await REQUESTS.get("req:" + entry.id);
      if (full) items.push(JSON.parse(full));
    }
    return json({ ok: true, count: items.length, items });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim();
  const site = String(payload.site || "").trim();
  const message = String(payload.message || site);

  if (!name) return json({ ok: false, error: "Name is required" }, 400);
  if (!isValidEmail(email))
    return json({ ok: false, error: "A valid email is required" }, 400);
  if (!site) return json({ ok: false, error: "Describe the website you want" }, 400);

  const id =
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const record = {
    id,
    name,
    email,
    site,
    receivedAt: new Date().toISOString(),
    source: "northstar-market",
  };

  // Persist to KV.
  try {
    await REQUESTS.put("req:" + id, JSON.stringify(record));
    // Keep a lightweight index list for easy retrieval.
    const indexRaw = await REQUESTS.get("index");
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    index.unshift({ id, name, email, receivedAt: record.receivedAt });
    await REQUESTS.put("index", JSON.stringify(index.slice(0, 200)));
  } catch (err) {
    return json({ ok: false, error: "Could not store request" }, 500);
  }

  // Optional email forwarding (only if the SEND_EMAIL binding is set up).
  if (typeof SEND_EMAIL !== "undefined") {
    try {
      const subject = `[Website Request] ${name}`;
      const body = `New website request\n\nName: ${name}\nEmail: ${email}\n\nWebsite wanted:\n${site}\n\nReceived: ${record.receivedAt}\n--\nNorthstar Market requests API`;
      await SEND_EMAIL.send({
        from: OWNER_EMAIL,
        to: OWNER_EMAIL,
        subject,
        text: body,
        replyTo: email,
      });
    } catch {
      // Email is best-effort; storage already succeeded.
    }
  }

  return json({ ok: true, id });
}

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});
