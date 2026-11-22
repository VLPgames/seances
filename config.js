// Configuration du serveur de comptes (Supabase).
// La clé « publishable » est publique par conception : les données sont protégées
// par les règles de sécurité (RLS) définies dans supabase/schema.sql.
// Laisser vide = mode local (pas de compte).
window.SEANCES_CONFIG = {
  supabaseUrl: 'https://iyvhqlelkpcydfjmmpdp.supabase.co',
  supabaseKey: 'sb_publishable_Bas5M3gfAh5z15EvjvNozg_OHOV6Jld',
};
