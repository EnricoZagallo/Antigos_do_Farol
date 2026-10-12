-- ============================================================================
-- Antigos do Farol: tabelas e regras de acesso (RLS)
-- Cole este arquivo inteiro no "SQL Editor" do Supabase e clique em Run.
-- Pode rodar de novo sem problemas (ele só cria o que ainda não existe).
-- ============================================================================

-- ---------- Presidentes (quem pode administrar o site) ----------
create table if not exists public.presidentes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome    text not null default ''
);

-- Função usada pelas regras abaixo: "o usuário logado é presidente?"
create or replace function public.eh_presidente()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.presidentes where user_id = auth.uid());
$$;

-- ---------- Eventos ----------
create table if not exists public.eventos (
  id        uuid primary key default gen_random_uuid(),
  titulo    text not null check (char_length(titulo) between 3 and 80),
  data      date not null,
  hora      text not null check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  local     text not null check (char_length(local) between 2 and 80),
  descricao text not null default '' check (char_length(descricao) <= 500),
  criado_em timestamptz not null default now()
);

-- ---------- Cadastros de novos associados (dados pessoais: acesso restrito) ----------
create table if not exists public.cadastros (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(nome) between 3 and 100),
  cpf        text not null unique check (cpf ~ '^[0-9]{11}$'),
  nascimento date not null,
  email      text not null unique check (char_length(email) <= 120),
  tel        text not null check (tel ~ '^[0-9]{10,13}$'),
  carro      text not null check (char_length(carro) between 2 and 60),
  ano        int  not null check (ano between 1886 and 2100),
  status     text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  criado_em  timestamptz not null default now()
);

-- ---------- Limite de tentativas (usado só pela Edge Function) ----------
create table if not exists public.limites (
  chave text primary key,
  n     int not null,
  fim   timestamptz not null
);

create or replace function public.limitar(p_chave text, p_max int, p_janela_seg int)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_n int;
begin
  insert into public.limites (chave, n, fim)
  values (p_chave, 1, now() + make_interval(secs => p_janela_seg))
  on conflict (chave) do update
    set n   = case when public.limites.fim < now() then 1 else public.limites.n + 1 end,
        fim = case when public.limites.fim < now() then now() + make_interval(secs => p_janela_seg) else public.limites.fim end
  returning n into v_n;
  return v_n > p_max;   -- true = passou do limite
end;
$$;

-- ============================================================================
-- SEGURANÇA. Primeiro ligamos o RLS em todas as tabelas...
-- ============================================================================
alter table public.presidentes enable row level security;
alter table public.eventos     enable row level security;
alter table public.cadastros   enable row level security;
alter table public.limites     enable row level security;

-- ...depois tiramos TODAS as permissões e devolvemos só o mínimo necessário
-- (duas camadas de proteção: permissão da tabela + regra de linha).
revoke all on public.presidentes from anon, authenticated;
revoke all on public.eventos     from anon, authenticated;
revoke all on public.cadastros   from anon, authenticated;
revoke all on public.limites     from anon, authenticated;

revoke all on function public.eh_presidente() from public, anon, authenticated;
revoke all on function public.limitar(text, int, int) from public, anon, authenticated;
grant execute on function public.eh_presidente() to authenticated;
grant execute on function public.limitar(text, int, int) to service_role;

grant select on public.presidentes to authenticated;
grant select on public.eventos to anon, authenticated;
grant insert, update, delete on public.eventos to authenticated;
grant select, delete on public.cadastros to authenticated;
grant update (status) on public.cadastros to authenticated;   -- presidentes só podem mudar o status

-- Presidentes: cada um enxerga apenas a si mesmo (serve para o site saber se o login é de presidente)
drop policy if exists presidentes_ver_proprio on public.presidentes;
create policy presidentes_ver_proprio on public.presidentes
  for select to authenticated using (user_id = auth.uid());

-- Eventos: qualquer pessoa lê; só presidente cria, edita e apaga
drop policy if exists eventos_leitura on public.eventos;
create policy eventos_leitura on public.eventos
  for select to anon, authenticated using (true);

drop policy if exists eventos_inserir on public.eventos;
create policy eventos_inserir on public.eventos
  for insert to authenticated with check (public.eh_presidente());

drop policy if exists eventos_atualizar on public.eventos;
create policy eventos_atualizar on public.eventos
  for update to authenticated using (public.eh_presidente()) with check (public.eh_presidente());

drop policy if exists eventos_excluir on public.eventos;
create policy eventos_excluir on public.eventos
  for delete to authenticated using (public.eh_presidente());

-- Cadastros: só presidente lê, muda o status e apaga.
-- NÃO existe regra de inserção: quem grava é a Edge Function "cadastro" (chave de serviço),
-- depois de conferir o captcha, o limite de pedidos e os dados.
drop policy if exists cadastros_ler on public.cadastros;
create policy cadastros_ler on public.cadastros
  for select to authenticated using (public.eh_presidente());

drop policy if exists cadastros_atualizar on public.cadastros;
create policy cadastros_atualizar on public.cadastros
  for update to authenticated using (public.eh_presidente()) with check (public.eh_presidente());

drop policy if exists cadastros_excluir on public.cadastros;
create policy cadastros_excluir on public.cadastros
  for delete to authenticated using (public.eh_presidente());

-- Limites: nenhuma regra = ninguém acessa pela API (só a função, via chave de serviço).