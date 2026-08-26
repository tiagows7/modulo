import { createClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const ALLOWED_ROLES = new Set([
  "super_admin",
  "admin",
  "gerente",
  "pdv",
  "operador",
]);

async function verifyAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Não autorizado. Token não informado." };
  }
  const token = authHeader.substring(7);
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { error: "Supabase não configurado." };
  
  const tempClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  
  const { data: { user }, error } = await tempClient.auth.getUser(token);
  if (error || !user) return { error: "Token inválido ou expirado." };
  
  const role = user.user_metadata?.role;
  if (role !== "super_admin" && role !== "admin" && role !== "gerente") {
    return { error: "Proibido. Privilégios insuficientes." };
  }
  
  return { user };
}

function normalizeLogin(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/@modulo\.com$/i, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function emailFromLogin(login: string) {
  return `${login}@modulo.com`;
}

function mapUser(user: User) {
  const meta = user.user_metadata ?? {};
  const email = user.email ?? "";
  const login =
    String(meta.username || meta.login || "").trim() ||
    (email.includes("@") ? email.split("@")[0] : email);
  return {
    id: user.id,
    email,
    usuario: login,
    nome: String(meta.name || meta.full_name || login || "—"),
    role: String(meta.role || "pdv"),
    filial_id: meta.filial ? String(meta.filial) : null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    banned: Boolean(user.banned_until),
    status: user.banned_until ? "inativo" : "ativo",
    email_confirmed: Boolean(user.email_confirmed_at),
  };
}

async function assertFilial(
  supabase: NonNullable<ReturnType<typeof adminClient>>,
  filial_id: string | null,
) {
  if (!filial_id) return;
  const { data: filial, error } = await supabase
    .from("filial")
    .select("id")
    .eq("id", filial_id)
    .maybeSingle();
  if (error || !filial) {
    throw new Error("Filial inválida.");
  }
}

export async function GET(req: Request) {
  const auth = await verifyAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.error.includes("Proibido") ? 403 : 401 });
  }

  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase não configurado no servidor." },
      { status: 500 },
    );
  }

  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = (data.users ?? [])
    .map(mapUser)
    .sort((a, b) => a.usuario.localeCompare(b.usuario, "pt-BR"));

  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const auth = await verifyAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.error.includes("Proibido") ? 403 : 401 });
  }

  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase não configurado no servidor." },
      { status: 500 },
    );
  }

  let body: {
    usuario?: string;
    nome?: string;
    role?: string;
    filial_id?: string | null;
    password?: string;
    status?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const login = normalizeLogin(String(body.usuario || ""));
  const nome = String(body.nome || "").trim();
  const role = String(body.role || "pdv").trim().toLowerCase();
  const password = String(body.password || "");
  const filial_id = body.filial_id ? String(body.filial_id) : null;
  const ativo = String(body.status || "ativo").toLowerCase() !== "inativo";

  if (!login) {
    return NextResponse.json({ error: "Informe o usuário." }, { status: 400 });
  }
  if (!nome) {
    return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  }
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Senha deve ter pelo menos 6 caracteres." },
      { status: 400 },
    );
  }

  try {
    await assertFilial(supabase, filial_id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Filial inválida." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: emailFromLogin(login),
    password,
    email_confirm: true,
    user_metadata: {
      username: login,
      name: nome,
      role,
      filial: filial_id,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!ativo && data.user) {
    const { error: banErr } = await supabase.auth.admin.updateUserById(
      data.user.id,
      { ban_duration: "876000h" },
    );
    if (banErr) {
      return NextResponse.json({ error: banErr.message }, { status: 500 });
    }
    const refreshed = await supabase.auth.admin.getUserById(data.user.id);
    if (refreshed.data.user) {
      return NextResponse.json(
        { user: mapUser(refreshed.data.user) },
        { status: 201 },
      );
    }
  }

  return NextResponse.json({ user: mapUser(data.user) }, { status: 201 });
}

export async function PATCH(req: Request) {
  const auth = await verifyAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.error.includes("Proibido") ? 403 : 401 });
  }

  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase não configurado no servidor." },
      { status: 500 },
    );
  }

  let body: {
    id?: string;
    usuario?: string;
    nome?: string;
    role?: string;
    filial_id?: string | null;
    password?: string;
    status?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const id = String(body.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  }

  const { data: existing, error: getErr } =
    await supabase.auth.admin.getUserById(id);
  if (getErr || !existing.user) {
    return NextResponse.json(
      { error: getErr?.message || "Usuário não encontrado." },
      { status: 404 },
    );
  }

  const meta = { ...(existing.user.user_metadata || {}) };

  if (body.nome !== undefined) {
    const nome = String(body.nome || "").trim();
    if (!nome) {
      return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
    }
    meta.name = nome;
  }

  if (body.role !== undefined) {
    const role = String(body.role || "").trim().toLowerCase();
    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
    }
    meta.role = role;
  }

  if (body.filial_id !== undefined) {
    const filial_id = body.filial_id ? String(body.filial_id) : null;
    try {
      await assertFilial(supabase, filial_id);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Filial inválida." },
        { status: 400 },
      );
    }
    meta.filial = filial_id;
  }

  if (body.usuario !== undefined) {
    const login = normalizeLogin(String(body.usuario || ""));
    if (!login) {
      return NextResponse.json({ error: "Informe o usuário." }, { status: 400 });
    }
    meta.username = login;
  }

  const patch: {
    user_metadata: Record<string, unknown>;
    password?: string;
    email?: string;
    ban_duration?: string;
  } = { user_metadata: meta };

  if (body.usuario !== undefined) {
    patch.email = emailFromLogin(normalizeLogin(String(body.usuario)));
  }

  if (body.password !== undefined && String(body.password).trim()) {
    const password = String(body.password);
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Senha deve ter pelo menos 6 caracteres." },
        { status: 400 },
      );
    }
    patch.password = password;
  }

  if (body.status !== undefined) {
    const ativo = String(body.status).toLowerCase() !== "inativo";
    patch.ban_duration = ativo ? "none" : "876000h";
  }

  const { data, error } = await supabase.auth.admin.updateUserById(id, patch);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: mapUser(data.user) });
}

export async function DELETE(req: Request) {
  const auth = await verifyAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.error.includes("Proibido") ? 403 : 401 });
  }

  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase não configurado no servidor." },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const id =
    url.searchParams.get("id") ||
    String((await req.json().catch(() => ({}))).id || "").trim();

  if (!id) {
    return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  }

  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
