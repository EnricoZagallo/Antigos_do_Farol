"use strict";
// Cliente mínimo para falar com o Supabase (login e banco), sem bibliotecas de terceiros.
// Usa só a chave PÚBLICA; a proteção real está nas regras do banco (RLS).
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CONFIG;

let sessao = null; // { token, expira, refresh }. O token de acesso fica só na memória da página.

const guardar = (d) => {
  sessao = {
    token: d.access_token,
    expira: Date.now() + d.expires_in * 1000,
    refresh: d.refresh_token,
  };
  sessionStorage.setItem("refresh", d.refresh_token); // some quando a aba é fechada
};
const limpar = () => {
  sessao = null;
  sessionStorage.removeItem("refresh");
};

async function autenticacao(caminho, corpo, token) {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/${caminho}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(corpo),
    });
    return {
      ok: r.ok,
      status: r.status,
      dados: await r.json().catch(() => ({})),
    };
  } catch {
    return { ok: false, status: 0, dados: {} };
  }
}

async function entrar(email, senha) {
  const r = await autenticacao("token?grant_type=password", {
    email,
    password: senha,
  });
  if (r.ok) guardar(r.dados);
  return r;
}

async function renovar() {
  const refresh = sessao?.refresh || sessionStorage.getItem("refresh");
  if (!refresh) return false;
  const r = await autenticacao("token?grant_type=refresh_token", {
    refresh_token: refresh,
  });
  if (r.ok) guardar(r.dados);
  else if (r.status >= 400 && r.status < 500) limpar();
  return r.ok;
}

async function tokenAtual() {
  if (sessao && sessao.expira - Date.now() > 60000) return sessao.token;
  return (await renovar()) ? sessao.token : null;
}

async function sair() {
  if (sessao) await autenticacao("logout?scope=local", {}, sessao.token);
  limpar();
}

// Fala com as tabelas. Com logado:true usa o login do presidente; sem isso, é um visitante comum.
async function rest(caminho, { metodo = "GET", corpo, logado = false } = {}) {
  const cabecalhos = { apikey: SUPABASE_ANON_KEY };
  if (logado) {
    const token = await tokenAtual();
    if (!token) return { ok: false, status: 401, dados: null };
    cabecalhos.Authorization = `Bearer ${token}`;
  }
  if (corpo) cabecalhos["Content-Type"] = "application/json";
  if (metodo !== "GET") cabecalhos.Prefer = "return=minimal";
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo && JSON.stringify(corpo),
    });
    return {
      ok: r.ok,
      status: r.status,
      dados: r.ok && metodo === "GET" ? await r.json() : null,
    };
  } catch {
    return { ok: false, status: 0, dados: null };
  }
}

// A conta logada está na lista de presidentes? (o banco só devolve a própria linha)
async function souPresidente() {
  const r = await rest("presidentes?select=user_id", { logado: true });
  return r.ok && r.dados.length === 1;
}

// O formulário de inscrição passa pela Edge Function "cadastro" (captcha, limite de pedidos e validação)
async function enviarCadastro(corpo) {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/cadastro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    return {
      ok: r.ok,
      status: r.status,
      ...(await r.json().catch(() => ({}))),
    };
  } catch {
    return { ok: false, status: 0, erro: "Sem conexão com o servidor." };
  }
}
