/**
 * Copia auth.users (com hash de senha) do projeto origem → destino via Postgres.
 * Também atualiza .env.local para o destino.
 *
 * Env:
 *   SOURCE_DB_PASSWORD / TARGET_DB_PASSWORD
 *   SOURCE_SUPABASE_URL / TARGET_SUPABASE_URL
 *   TARGET_SUPABASE_KEY (service_role)
 *   TARGET_ANON_KEY (publishable/anon)
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

function refFromUrl(url) {
  return new URL(url).hostname.split(".")[0];
}

async function connect(ref, password) {
  const c = new pg.Client({
    host: "aws-0-sa-east-1.pooler.supabase.com",
    port: 5432,
    user: `postgres.${ref}`,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await c.connect();
  return c;
}

async function tryConnect(ref, passwords) {
  for (const password of passwords) {
    try {
      const c = await connect(ref, password);
      return { client: c, password };
    } catch {
      /* try next */
    }
  }
  throw new Error(`Não conectou Postgres em ${ref}`);
}

function updateEnvLocal({ url, anon, service }) {
  const envPath = path.join(root, ".env.local");
  let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const ref = refFromUrl(url);
  const set = (key, value) => {
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(text)) text = text.replace(re, `${key}=${value}`);
    else text = `${text.trimEnd()}\n${key}=${value}\n`;
  };
  text = text.replace(
    /^# Projeto:.*$/m,
    `# Projeto: https://supabase.com/dashboard/project/${ref}`,
  );
  if (!/^# Projeto:/m.test(text)) {
    text = `# Projeto: https://supabase.com/dashboard/project/${ref}\n` + text;
  }
  set("NEXT_PUBLIC_SUPABASE_URL", url);
  set("NEXT_PUBLIC_SUPABASE_ANON_KEY", anon);
  set("SUPABASE_SERVICE_ROLE_KEY", service);
  set("SMARTPOS_SUPABASE_KEY", service);
  fs.writeFileSync(envPath, text.endsWith("\n") ? text : text + "\n", "utf8");
  console.log("Atualizado .env.local →", url);
}

const sourceUrl =
  process.env.SOURCE_SUPABASE_URL ||
  "https://vwzpcvrrjohmudsczwhp.supabase.co";
const targetUrl =
  process.env.TARGET_SUPABASE_URL ||
  "https://rdtnlowhhtsickbgxzyu.supabase.co";
const targetKey = process.env.TARGET_SUPABASE_KEY;
const targetAnon = process.env.TARGET_ANON_KEY;

if (!targetKey) {
  console.error("Defina TARGET_SUPABASE_KEY (service_role)");
  process.exit(1);
}
if (!targetAnon) {
  console.error("Defina TARGET_ANON_KEY (anon/publishable)");
  process.exit(1);
}

const passwords = [
  process.env.TARGET_DB_PASSWORD,
  process.env.SOURCE_DB_PASSWORD,
].filter(Boolean);

if (!passwords.length) {
  console.error("Defina TARGET_DB_PASSWORD e/ou SOURCE_DB_PASSWORD");
  process.exit(1);
}

const sourceRef = refFromUrl(sourceUrl);
const targetRef = refFromUrl(targetUrl);

console.log("Origem:", sourceRef);
console.log("Destino:", targetRef);

const { client: src } = await tryConnect(sourceRef, passwords);
const { client: dst } = await tryConnect(targetRef, passwords);

const { rows: users } = await src.query(`
  select id, instance_id, aud, role, email, encrypted_password,
         email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
         recovery_token, recovery_sent_at, email_change_token_new, email_change,
         email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
         is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
         phone_change, phone_change_token, phone_change_sent_at,
         email_change_token_current, email_change_confirm_status,
         banned_until, reauthentication_token, reauthentication_sent_at,
         is_sso_user, deleted_at, is_anonymous
  from auth.users
`);

console.log(`Usuários origem: ${users.length}`);

for (const u of users) {
  const exists = await dst.query(`select 1 from auth.users where id = $1 or email = $2`, [
    u.id,
    u.email,
  ]);
  if (exists.rowCount) {
    await dst.query(
      `update auth.users set
         encrypted_password = $2,
         email_confirmed_at = coalesce($3, now()),
         raw_user_meta_data = $4,
         raw_app_meta_data = $5,
         banned_until = $6,
         updated_at = now()
       where id = $1 or email = $7`,
      [
        u.id,
        u.encrypted_password,
        u.email_confirmed_at,
        u.raw_user_meta_data,
        u.raw_app_meta_data,
        u.banned_until,
        u.email,
      ],
    );
    console.log("UPDATE", u.email);
    continue;
  }

  await dst.query(
    `insert into auth.users (
       id, instance_id, aud, role, email, encrypted_password,
       email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
       recovery_token, recovery_sent_at, email_change_token_new, email_change,
       email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
       is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
       phone_change, phone_change_token, phone_change_sent_at,
       email_change_token_current, email_change_confirm_status,
       banned_until, reauthentication_token, reauthentication_sent_at,
       is_sso_user, deleted_at, is_anonymous
     ) values (
       $1,$2,coalesce($3,'authenticated'),coalesce($4,'authenticated'),$5,$6,
       coalesce($7, now()),$8,coalesce($9,''),$10,
       coalesce($11,''),$12,coalesce($13,''),coalesce($14,''),
       $15,$16,$17,$18,
       $19,coalesce($20, now()),coalesce($21, now()),$22,$23,
       coalesce($24,''),coalesce($25,''),$26,
       coalesce($27,''),coalesce($28,0),
       $29,coalesce($30,''),$31,
       coalesce($32,false),$33,coalesce($34,false)
     )`,
    [
      u.id,
      u.instance_id,
      u.aud,
      u.role,
      u.email,
      u.encrypted_password,
      u.email_confirmed_at,
      u.invited_at,
      u.confirmation_token,
      u.confirmation_sent_at,
      u.recovery_token,
      u.recovery_sent_at,
      u.email_change_token_new,
      u.email_change,
      u.email_change_sent_at,
      u.last_sign_in_at,
      u.raw_app_meta_data,
      u.raw_user_meta_data,
      u.is_super_admin,
      u.created_at,
      u.updated_at,
      u.phone,
      u.phone_confirmed_at,
      u.phone_change,
      u.phone_change_token,
      u.phone_change_sent_at,
      u.email_change_token_current,
      u.email_change_confirm_status,
      u.banned_until,
      u.reauthentication_token,
      u.reauthentication_sent_at,
      u.is_sso_user,
      u.deleted_at,
      u.is_anonymous,
    ],
  );
  console.log("INSERT", u.email);
}

// identities (email provider) — necessário para login
const { rows: identities } = await src.query(`
  select id, user_id, identity_data, provider, provider_id, last_sign_in_at,
         created_at, updated_at, email
  from auth.identities
`);

for (const i of identities) {
  const exists = await dst.query(`select 1 from auth.identities where id = $1`, [i.id]);
  if (exists.rowCount) {
    console.log("identity exists", i.email || i.user_id);
    continue;
  }
  try {
    await dst.query(
      `insert into auth.identities (
         id, user_id, identity_data, provider, provider_id,
         last_sign_in_at, created_at, updated_at, email
       ) values ($1,$2,$3,$4,$5,$6,coalesce($7,now()),coalesce($8,now()),$9)`,
      [
        i.id,
        i.user_id,
        i.identity_data,
        i.provider,
        i.provider_id,
        i.last_sign_in_at,
        i.created_at,
        i.updated_at,
        i.email,
      ],
    );
    console.log("identity INSERT", i.email || i.user_id);
  } catch (e) {
    console.log("identity FAIL", i.email, e.message.split("\n")[0]);
  }
}

await src.end();
await dst.end();

updateEnvLocal({ url: targetUrl, anon: targetAnon, service: targetKey });

// smoke: list users + try admin login with known password
const admin = createClient(targetUrl, targetKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: listed, error: le } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 50,
});
if (le) console.error("listUsers:", le.message);
else console.log(
  "Destino auth users:",
  listed.users.map((u) => `${u.email} (${u.user_metadata?.role})`).join(", "),
);

const anonClient = createClient(targetUrl, targetAnon);
for (const [email, pass] of [
  ["admin@modulo.com", "admin"],
  ["pdv_andino@modulo.com", "pdv"],
  ["pdv_andino@modulo.com", "pdv123"],
]) {
  const { error } = await anonClient.auth.signInWithPassword({ email, password: pass });
  console.log(`login ${email} / ${pass}:`, error ? `FAIL ${error.message}` : "OK");
  await anonClient.auth.signOut();
}

console.log("Auth migrate done.");
