import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function projectRefFromUrl(url: string) {
  try {
    return new URL(url).hostname.split(".")[0] || "modulo";
  } catch {
    return "modulo";
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function loginErrorPage(message: string) {
  const safe = escapeHtml(message);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Login — Módulo Info</title>
  <style>
    body { margin:0; min-height:100vh; display:grid; place-items:center; font-family:Segoe UI,sans-serif; background:#0b1424; color:#e8edf5; }
    .box { width:min(420px,92vw); padding:28px; border-radius:16px; background:#132238; border:1px solid rgba(255,255,255,.12); }
    a { color:#4A9FE8; }
    p { line-height:1.45; color:#b7c3d6; }
  </style>
</head>
<body>
  <div class="box">
    <h1 style="margin:0 0 10px;font-size:1.25rem;">Falha no login</h1>
    <p>${safe}</p>
    <p><a href="/">Voltar ao login</a></p>
  </div>
</body>
</html>`;
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return new NextResponse(
      loginErrorPage("Supabase não configurado no servidor (.env.local)."),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const form = await req.formData();
  const username = String(form.get("username") || "").trim();
  let password = String(form.get("password") || "");

  if (!username || !password) {
    return new NextResponse(loginErrorPage("Preencha usuário e senha."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Operador digita pdv/pdv; Supabase exige senha >= 6 caracteres.
  const userKey = username.toLowerCase();
  if (userKey === "pdv" && password === "pdv") {
    password = "pdvpdv";
  }

  const email = username.includes("@") ? username : `${username}@modulo.com`;
  const supabase = createClient(url, anon);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session || !data.user) {
    return new NextResponse(loginErrorPage("Usuário ou senha incorretos."), {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const role = String(data.user.user_metadata?.role || "").toLowerCase();
  const dest =
    role === "pdv" || userKey === "pdv" || userKey.startsWith("pdv@")
      ? "/pdv#/venda"
      : "/administrativo";
  const storageKey = `sb-${projectRefFromUrl(url)}-auth-token`;
  const sessionJson = JSON.stringify(data.session);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Entrando…</title>
  <style>
    body { margin:0; min-height:100vh; display:grid; place-items:center; font-family:Segoe UI,sans-serif; background:#0b1424; color:#e8edf5; }
  </style>
</head>
<body>
  <p>Entrando no sistema…</p>
  <script>
    (function () {
      try {
        localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(sessionJson)});
      } catch (e) {}
      location.replace(${JSON.stringify(dest)});
    })();
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=${escapeHtml(dest)}" />
    <p><a href="${escapeHtml(dest)}">Continuar</a></p>
  </noscript>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
