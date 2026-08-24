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
    role: String(meta.role || "user"),
    filial_id: meta.filial ? String(meta.filial) : null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    banned: Boolean(user.banned_until),
    email_confirmed: Boolean(user.email_confirmed_at),
  };
}

export async function GET() {
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

  const users = (data.users ?? []).map(mapUser).sort((a, b) =>
    a.usuario.localeCompare(b.usuario, "pt-BR"),
  );

  return NextResponse.json({ users });
}

export async function PATCH(req: Request) {
  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase não configurado no servidor." },
      { status: 500 },
    );
  }

  let body: { id?: string; filial_id?: string | null };
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

  const filial_id =
    body.filial_id === undefined
      ? existing.user.user_metadata?.filial ?? null
      : body.filial_id
        ? String(body.filial_id)
        : null;

  if (filial_id) {
    const { data: filial, error: filErr } = await supabase
      .from("filial")
      .select("id")
      .eq("id", filial_id)
      .maybeSingle();
    if (filErr || !filial) {
      return NextResponse.json(
        { error: "Filial inválida." },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabase.auth.admin.updateUserById(id, {
    user_metadata: {
      ...(existing.user.user_metadata || {}),
      filial: filial_id,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: mapUser(data.user) });
}
