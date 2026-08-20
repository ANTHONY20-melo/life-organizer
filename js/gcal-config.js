/* LIFE ORGANIZER — Configuração do Google Agenda
 * Cole aqui o Client ID do OAuth 2.0 criado no Google Cloud Console.
 * Como criar (1 min): console.cloud.google.com → criar projeto →
 * APIS & Services → Habilitar "Google Calendar API" → Credentials →
 * Create Credentials → OAuth client ID → Web application →
 * Authorized JavaScript origins: https://life-organizer-ashen.vercel.app e http://localhost:3337 →
 * Authorized redirect URIs: https://life-organizer-ashen.vercel.app/ e http://localhost:3337/ →
 * copie o "Client ID" (termina em .apps.googleusercontent.com) e cole abaixo.
 */
window.GCAL_CONFIG = window.GCAL_CONFIG || {
  clientId: '42294742439-1frcr4kvm54ltkotogr2uhifqsr42p0k.apps.googleusercontent.com' // ex.: '1234567890-abc123.apps.googleusercontent.com'
}