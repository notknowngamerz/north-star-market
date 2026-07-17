// Northstar Market — requests API (Cloudflare Worker, module format)
// Stores visitor website-request submissions in KV and serves them via a
// token-gated GET. Email forwarding is optional (SEND_EMAIL binding).

// Bindings (set in wrangler.toml):
//   REQUESTS   - KV namespace for submissions
//   SEND_EMAIL - optional email forwarding (requires Email Routing setup)
// Secrets (wrangler secret put):
//   ADMIN_SECRET - token required to read/clear submissions

const OWNER_EMAIL = "hs9961984@gmail.com";
const ALLOWED_ORIGIN = "https://notknowngamerz.github.io";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": ALLOWED_ORIGIN,
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    },
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return json({ ok: true });

    const url = new URL(request.url);
    const secret = url.searchParams.get("secret");

    // GET -> list submissions (admin only)
    if (request.method === "GET") {
      if (secret !== env.ADMIN_SECRET)
        return json({ ok: false, error: "Unauthorized" }, 401);
      const indexRaw = await env.REQUESTS.get("index");
      const index = indexRaw ? JSON.parse(indexRaw) : [];
      const items = [];
      for (const entry of index) {
        const full = await env.REQUESTS.get("req:" + entry.id);
        if (full) items.push(JSON.parse(full));
      }
      return json({ ok: true, count: items.length, items });
    }

    // DELETE -> clear all submissions (admin only)
    if (request.method === "DELETE") {
      if (secret !== env.ADMIN_SECRET)
        return json({ ok: false, error: "Unauthorized" }, 401);
      const indexRaw = await env.REQUESTS.get("index");
      const index = indexRaw ? JSON.parse(indexRaw) : [];
      for (const entry of index) await env.REQUESTS.delete("req:" + entry.id);
      await env.REQUESTS.delete("index");
      return json({ ok: true, cleared: index.length });
    }

    // POST -> store a new submission
    if (request.method !== "POST")
      return json({ ok: false, error: "Method not allowed" }, 405);

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON body" }, 400);
    }

    const name = String(payload.name || "").trim();
    const email = String(payload.email || "").trim();
    const site = String(payload.site || "").trim();

    if (!name) return json({ ok: false, error: "Name is required" }, 400);
    if (!isValidEmail(email))
      return json({ ok: false, error: "A valid email is required" }, 400);
    if (!site) return json({ ok: false, error: "Describe the website you want" }, 400);

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const record = {
      id,
      name,
      email,
      site,
      receivedAt: new Date().toISOString(),
      source: "northstar-market",
    };

    try {
      await env.REQUESTS.put("req:" + id, JSON.stringify(record));
      const indexRaw = await env.REQUESTS.get("index");
      const index = indexRaw ? JSON.parse(indexRaw) : [];
      index.unshift({ id, name, email, receivedAt: record.receivedAt });
      await env.REQUESTS.put("index", JSON.stringify(index.slice(0, 200)));
    } catch {
      return json({ ok: false, error: "Could not store request" }, 500);
    }

    // Optional email forwarding (best-effort; KV is the source of truth).
    if (env.SEND_EMAIL) {
      try {
        await env.SEND_EMAIL.send({
          from: OWNER_EMAIL,
          to: OWNER_EMAIL,
          subject: `[Website Request] ${name}`,
          text: `New website request\n\nName: ${name}\nEmail: ${email}\n\nWebsite wanted:\n${site}\n\nReceived: ${record.receivedAt}\n--\nNorthstar Market requests API`,
          replyTo: email,
        });
      } catch {
        // Ignore email failures; storage already succeeded.
      }
    }

    return json({ ok: true, id });
  },
};
