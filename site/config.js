// Valores PÚBLICOS: podem ficar no repositório, porque quem protege os dados são as regras do banco (RLS).
// NUNCA coloque aqui a chave secreta do Supabase, a senha do banco nem a chave secreta do Turnstile.
window.CONFIG = {
  SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',                 // Supabase > Project Settings > API
  SUPABASE_ANON_KEY: 'COLE-AQUI-A-CHAVE-PUBLICA (anon ou publishable)', // a chave PÚBLICA, nunca a secreta
  TURNSTILE_SITE_KEY: 'COLE-AQUI-A-CHAVE-DO-SITE-TURNSTILE',      // Cloudflare Turnstile > chave do site (pública)
};