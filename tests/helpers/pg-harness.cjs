// Postgres embutido (PGlite) com um esqueleto mínimo do Supabase: papéis anon,
// authenticated e service_role, schema auth e funções auth.uid()/auth.role().
// Serve para testar migrações e RLS reais sem tocar no projeto de produção.
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');

const SUPABASE_STUB = `
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  banned_until timestamptz
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $f$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
  $f$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $f$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role() TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
`;

function migrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

async function createDatabase({ upTo } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(fs.readFileSync(path.join(ROOT, 'supabase', 'schema.sql'), 'utf8'));
  for (const file of migrationFiles()) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
    if (upTo && file.startsWith(upTo)) break;
  }
  return db;
}

async function applyMigration(db, prefix) {
  const file = migrationFiles().find((f) => f.startsWith(prefix));
  await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
}

/** Executa fn numa transação com a identidade de um papel do Supabase; sempre desfaz. */
async function as(db, { role = 'authenticated', sub = '' } = {}, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)`, [sub, role]);
    await tx.exec(`SET LOCAL ROLE ${role}`);
    try {
      return await fn(tx);
    } finally {
      await tx.rollback();
    }
  }).catch((err) => {
    if (err && /rollback/i.test(String(err.message))) return undefined;
    throw err;
  });
}

/** Igual a as(), mas captura o erro SQL para asserções negativas. */
async function attempt(db, identity, sql, params = []) {
  try {
    const result = await as(db, identity, (tx) => tx.query(sql, params));
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error };
  }
}

async function createUser(db, { id, email, role = 'jovem', company = null, name = 'Pessoa', meta = {} }) {
  await db.query(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)`, [id, email, JSON.stringify({ full_name: name, ...meta })]);
  await db.query(`UPDATE public.profiles SET role = $2::user_role, company_id = $3 WHERE id = $1`, [id, role, company]);
}

module.exports = { createDatabase, applyMigration, as, attempt, createUser };
