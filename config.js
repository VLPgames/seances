// Configuration du serveur de comptes (Supabase).
// La clé « anon / publishable » est publique par conception : les données sont protégées
// par les règles de sécurité (RLS) définies dans supabase/schema.sql.
// Laisser vide = mode local (pas de compte).
window.SEANCES_CONFIG = {
  supabaseUrl: '',
  supabaseKey: '',
};
