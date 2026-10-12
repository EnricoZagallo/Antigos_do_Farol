-- ============================================================================
-- Limpeza automática (LGPD): apaga cadastros recusados há mais de 30 dias
-- e registros vencidos do limite de tentativas. Roda todo dia às 03:00 (UTC).
--
-- ANTES: no painel do Supabase, abra Database > Extensions, procure "pg_cron" e ative.
-- Depois cole este arquivo no SQL Editor e clique em Run.
-- ============================================================================
create or replace function public.limpar_expirados()
returns void
language sql security definer
set search_path = public
as $$
  delete from public.cadastros where status = 'recusado' and criado_em < now() - interval '30 days';
  delete from public.limites where fim < now();
$$;

revoke all on function public.limpar_expirados() from public, anon, authenticated;

select cron.schedule('limpeza-diaria', '0 3 * * *', 'select public.limpar_expirados()');