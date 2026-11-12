// Paridade de rotas entre o cliente nativo Android (PortalApiClient.kt) e o proxy/Bearer da Web.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { loadRoute } = require('./helpers/route-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const PORTAL_CLIENT_PATH = path.join(
  ROOT,
  'android/app/src/main/java/br/com/fsyrp2/app/network/PortalApiClient.kt'
);

const PUBLIC_PORTAL_API_PATHS = new Set([
  '/api/auth/recover',
  '/api/instagram',
  '/api/app-release',
]);

const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LW5hdGl2ZSJ9.assinatura-paridade-app';

const bearer = loadRoute('src/lib/auth/bearer.ts');
const nativeAuth = loadRoute('src/types/native-auth.ts');

function extractPortalApiPaths(kotlinSource) {
  const regex = /"\$portalBaseUrl(\/api\/[^"\r\n]*)"/g;
  const rawPaths = [];
  let match;
  while ((match = regex.exec(kotlinSource)) !== null) {
    rawPaths.push(match[1]);
  }
  return rawPaths.map((raw) => {
    const withoutQuery = raw
      .replace(/\$query\b/g, '')
      .split('?')[0]
      .replace(/\$\{[^}]+\}/g, 'seg-id')
      .replace(/\$[A-Za-z0-9_]+/g, 'seg-id');
    return withoutQuery;
  });
}

function createProxyRunner({ tokenValid = true } = {}) {
  const seen = { verifiedTokens: [], cookieReads: 0 };
  const ssr = {
    createServerClient: () => ({
      auth: {
        getUser: async (token) => {
          if (token) {
            seen.verifiedTokens.push(token);
            return tokenValid
              ? { data: { user: { id: 'u-native' } }, error: null }
              : { data: { user: null }, error: { code: 'bad_jwt' } };
          }
          seen.cookieReads++;
          return { data: { user: null } };
        },
      },
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        single: async () => ({ data: { role: 'jovem' } }),
      }),
    }),
  };
  const nextServer = {
    NextResponse: {
      next: () => ({ kind: 'next', status: 200, cookies: { set() {} } }),
      json: (body, options = {}) => ({
        kind: 'json',
        body,
        status: options.status ?? 200,
        headers: options.headers ?? {},
      }),
      redirect: (url) => ({
        kind: 'redirect',
        status: 307,
        url: String(url.pathname ?? url),
      }),
    },
  };
  const { proxy } = loadRoute('src/proxy.ts', {
    extraModules: { '@supabase/ssr': ssr, 'next/server': nextServer },
  });
  return {
    seen,
    call(pathname, { method = 'GET', headers = {} } = {}) {
      const h = new Map(
        Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
      );
      return proxy({
        method,
        headers: { get: (k) => h.get(k.toLowerCase()) ?? null },
        cookies: { getAll: () => [], set() {} },
        nextUrl: {
          pathname,
          clone: () => ({ pathname, searchParams: new URLSearchParams() }),
        },
      });
    },
  };
}

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_test';

test('every $portalBaseUrl/api/... path in PortalApiClient.kt is covered by BEARER_API_PREFIXES or public allowlist', () => {
  const source = fs.readFileSync(PORTAL_CLIENT_PATH, 'utf8');
  const extracted = extractPortalApiPaths(source);
  assert.ok(
    extracted.length >= 20,
    `Expected at least 20 portal API paths in PortalApiClient.kt, found ${extracted.length}`
  );

  const uniquePaths = Array.from(new Set(extracted));
  for (const apiPath of uniquePaths) {
    if (PUBLIC_PORTAL_API_PATHS.has(apiPath)) {
      assert.equal(
        bearer.isBearerApiPath(apiPath),
        false,
        `Public route ${apiPath} should not require Bearer prefix`
      );
      continue;
    }

    const coveredByPrefix = nativeAuth.BEARER_API_PREFIXES.some(
      (prefix) => apiPath === prefix || apiPath.startsWith(`${prefix}/`)
    );
    assert.equal(
      coveredByPrefix,
      true,
      `PortalApiClient.kt calls ${apiPath}, which is missing from BEARER_API_PREFIXES in src/types/native-auth.ts`
    );
    assert.equal(
      bearer.isBearerApiPath(apiPath),
      true,
      `isBearerApiPath(${apiPath}) returned false`
    );
  }
});

test('/api/profile/photo, /reviews, /company and /api/companies/whatsapp accept Authorization: Bearer in proxy.ts', async () => {
  const { call, seen } = createProxyRunner({ tokenValid: true });
  const checks = [
    ['GET', '/api/profile/photo'],
    ['POST', '/api/profile/photo'],
    ['DELETE', '/api/profile/photo'],
    ['GET', '/api/profile/photo/reviews'],
    ['POST', '/api/profile/photo/reviews'],
    ['GET', '/api/profile/photo/company'],
    ['GET', '/api/companies/whatsapp'],
    ['PUT', '/api/companies/whatsapp'],
  ];

  for (const [method, pathname] of checks) {
    const res = await call(pathname, {
      method,
      headers: { authorization: `Bearer ${SAMPLE_JWT}` },
    });
    assert.equal(
      res.kind,
      'next',
      `Expected proxy.ts to allow ${method} ${pathname} with Bearer token`
    );
  }

  assert.equal(seen.verifiedTokens.length, checks.length);
  assert.equal(seen.cookieReads, 0);
});
