// Valores PÚBLICOS: podem ficar no repositório, porque quem protege os dados são as regras do banco (RLS).
// NUNCA coloque aqui a chave secreta do Supabase, a senha do banco nem a chave secreta do Turnstile.
window.CONFIG = {
  SUPABASE_URL: "https://omqtawgpnwpplsxnjghj.supabase.co", // Supabase > Project Settings > API
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tcXRhd2dwbndwcGxzeG5qZ2hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NjE3NjcsImV4cCI6MjEwNzMzNzc2N30.kHsKhxs77OwAgedsd-1uxR1a4InRomaSkVP_BmPrQxg", // a chave PÚBLICA, nunca a secreta
  TURNSTILE_SITE_KEY: "0x4AAAAAAFUNFB5kzQAJSRHE", // Cloudflare Turnstile > chave do site (pública)
};
