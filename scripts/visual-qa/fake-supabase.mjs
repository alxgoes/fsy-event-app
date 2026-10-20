#!/usr/bin/env node
// Supabase FALSO para QA visual local. Somente desenvolvimento: dados fictícios,
// sem segredos, sem RLS real. Não use para validar permissões (para isso há os
// testes de RLS em tests/database-rls.test.cjs). Uso:
//   node scripts/visual-qa/fake-supabase.mjs            (porta 54399)
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=dev \
//   SUPABASE_SERVICE_ROLE_KEY=dev npx next dev -p 3100
// O cookie de sessão de cada pessoa fictícia vem de sessionCookie() em session.mjs.
import http from "node:http";

const PORT = Number(process.env.FAKE_SUPABASE_PORT || 54399);
import { authUser, fixtures } from "./session.mjs";

const tables = structuredClone(fixtures.tables);
tables.user_layout_preferences ??= [];
tables.admin_account_events ??= [];
tables.announcement_likes ??= [];

const users = fixtures.users;
const userFromToken = (auth) => {
  const token = (auth || "").replace(/^Bearer\s+/i, "");
  try {
    const { sub } = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return users.find((u) => u.id === sub) || null;
  } catch {
    return null;
  }
};

function parseFilters(params) {
  const filters = [];
  for (const [key, raw] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(key)) continue;
    if (key === "or") continue; // aceita qualquer linha (fixtures já são do escopo)
    const [op, ...rest] = raw.split(".");
    const value = rest.join(".");
    filters.push({ key, op, value });
  }
  return filters;
}

const matches = (row, { key, op, value }) => {
  const v = row[key];
  switch (op) {
    case "eq": return String(v) === value;
    case "neq": return String(v) !== value;
    case "is": return value === "null" ? v == null : String(v) === value;
    case "in": return value.replace(/[()]/g, "").split(",").map((s) => s.replace(/"/g, "")).includes(String(v));
    case "gte": return String(v) >= value;
    case "lte": return String(v) <= value;
    case "ilike": return String(v ?? "").toLowerCase().includes(value.replace(/[%*]/g, "").toLowerCase());
    default: return true;
  }
};

function sortRows(rows, order) {
  if (!order) return rows;
  const [col, dir] = order.split(",")[0].split(".");
  return [...rows].sort((a, b) => (String(a[col] ?? "") < String(b[col] ?? "") ? -1 : 1) * (dir === "desc" ? -1 : 1));
}

function embed(table, row) {
  const out = { ...row };
  if ("author_id" in row) {
    const p = tables.profiles.find((x) => x.id === row.author_id);
    out.profiles = p ? { full_name: p.full_name, role: p.role } : null;
  }
  return out;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", "Access-Control-Expose-Headers": "Content-Range", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204);
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let body = "";
  for await (const chunk of req) body += chunk;
  const json = body ? JSON.parse(body) : undefined;

  if (url.pathname === "/auth/v1/user") {
    const u = userFromToken(req.headers.authorization);
    return u ? send(res, 200, authUser(u)) : send(res, 401, { code: 401, msg: "invalid JWT" });
  }
  if (url.pathname === "/auth/v1/logout") return send(res, 204);
  if (url.pathname === "/auth/v1/recover") return send(res, 200, {});
  if (url.pathname === "/auth/v1/admin/users") {
    const page = Number(url.searchParams.get("page") || 1);
    return send(res, 200, { users: page === 1 ? users.map(authUser) : [], aud: "authenticated" });
  }
  const adminUser = url.pathname.match(/^\/auth\/v1\/admin\/users\/([\w-]+)$/);
  if (adminUser) {
    const u = users.find((x) => x.id === adminUser[1]);
    if (!u) return send(res, 404, { msg: "not found" });
    if (req.method === "PUT") {
      if (json?.ban_duration) u.banned_until = json.ban_duration === "none" ? null : "2126-01-01T00:00:00Z";
      return send(res, 200, authUser(u));
    }
    if (req.method === "DELETE") return send(res, 200, {});
    return send(res, 200, authUser(u));
  }

  const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
  if (rpc) return send(res, 200, null);

  const rest = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
  if (rest) {
    const table = rest[1];
    tables[table] ??= [];
    const filters = parseFilters(url.searchParams);
    const single = (req.headers.accept || "").includes("vnd.pgrst.object");
    let rows = tables[table].filter((row) => filters.every((f) => matches(row, f)));

    if (req.method === "GET" || req.method === "HEAD") {
      rows = sortRows(rows, url.searchParams.get("order")).map((r) => embed(table, r));
      const limit = Number(url.searchParams.get("limit") || 0);
      if (limit) rows = rows.slice(0, limit);
      const headers = { "Content-Range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` };
      if (req.method === "HEAD") return send(res, 200, undefined, headers);
      if (single) return rows[0] ? send(res, 200, rows[0], headers) : send(res, 406, { code: "PGRST116", message: "0 rows" });
      return send(res, 200, rows, headers);
    }
    if (req.method === "POST") {
      const incoming = Array.isArray(json) ? json : [json];
      const conflict = url.searchParams.get("on_conflict")?.split(",");
      const saved = incoming.map((item) => {
        const existing = conflict && tables[table].find((r) => conflict.every((c) => r[c] === item[c]));
        if (existing) return Object.assign(existing, item);
        const row = { id: item.id ?? crypto.randomUUID(), created_at: new Date().toISOString(), ...item };
        tables[table].push(row);
        return row;
      });
      return send(res, 201, single ? saved[0] : saved);
    }
    if (req.method === "PATCH") {
      rows.forEach((r) => Object.assign(r, json));
      return send(res, 200, single ? rows[0] ?? null : rows);
    }
    if (req.method === "DELETE") {
      tables[table] = tables[table].filter((r) => !rows.includes(r));
      return send(res, 200, single ? rows[0] ?? null : rows);
    }
  }
  if (url.pathname.startsWith("/img/")) {
    // Imagens fictícias em SVG com proporções variadas.
    const [w, h] = (url.pathname.match(/(\d+)x(\d+)/) || [0, 1200, 800]).slice(1).map(Number);
    const hue = (w * 7 + h * 3) % 360;
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Access-Control-Allow-Origin": "*" });
    return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 62%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360} 70% 40%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="50%" font-family="sans-serif" font-size="${Math.round(Math.min(w, h) / 10)}" fill="white" text-anchor="middle" dominant-baseline="middle">${w}×${h}</text></svg>`);
  }
  send(res, 404, { message: `fake-supabase: rota não simulada ${req.method} ${url.pathname}` });
});

server.listen(PORT, "127.0.0.1", () => console.log(`fake-supabase ouvindo em http://127.0.0.1:${PORT}`));

