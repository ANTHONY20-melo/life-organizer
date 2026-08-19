# Life Organizer

Plataforma completa de organização pessoal — agenda, tarefas, hábitos, finanças, metas e relatórios — 100% offline-first, rodando direto no navegador, no celular (PWA) e pronta para APK Android.

## ✨ Funcionalidades

- **🏠 Meu Dia** — saudação, linha do tempo de hoje, resumo financeiro, próximas contas e hábitos do dia
- **📅 Agenda** — eventos com categoria, prioridade, horário, local, repetição (diária/semanal/mensal/anual/dias específicos) e notificação; visualizações Dia/Semana/Mês/Lista
- **✅ Tarefas** — lista com prioridade, vencimento, subtarefas, filtros por status/prioridade
- **🔄 Hábitos** — acompanhamento diário, sequência (streak), histórico, tela de hoje com progresso
- **💰 Finanças** — dashboard com gráficos, contas, cartões, orçamento, metas, dívidas, patrimônio, previsão, insights e planilha
- **🔔 Notificações** — lembrete de eventos (minutos antes), contas a pagar (N dias antes), resumo matinal; via Service Worker + TimestampTrigger
- **🔍 Busca global** — Ctrl+K
- **🌗 Temas** — dark/light/system
- **💾 Backup** — exportar/importar JSON completo

## 🧱 Arquitetura

Vanilla JS offline-first (zero dependências, zero build). Módulos IIFE em camadas:

```
Storage (localStorage) → DB (CRUD + regras) → Insights (relatórios) → Notifications (planejamento) → Export (backup) → App (UI)
```

- `js/storage.js` — wrapper localStorage com prefixo `lo_`
- `js/db.js` — CRUD de todas as coleções + validação zero-trust
- `js/insights.js` — resumo do mês, top categorias, receita×despesa
- `js/notifications.js` — planejadores de lembretes (funções puras)
- `js/export.js` — backup/restore com sanitização
- `js/app.js` — UI, navegação, modais, ações, service worker
- `service-worker.js` — cache offline + agendamento de notificações (TimestampTrigger)
- `tests/` — suíte Node.js (61 testes)

## 🚀 Como rodar

```bash
python server.py          # http://localhost:3337
# ou
run.bat
```

Testes:

```bash
node --test tests/db.test.js tests/agenda.test.js tests/financas.test.js tests/habits.test.js tests/insights.test.js tests/notifications.test.js tests/export.test.js
```

## 📱 Instalação como app (PWA)

- **Android/Chrome/Edge:** abra o site → menu → "Instalar app"
- **iPhone/Safari:** Compartilhar → "Adicionar à Tela de Início"
- **APK Android:** gerado via Bubblewrap TWA (Fase 2 do roadmap)

## 🗺️ Roadmap

- [x] Fase 1 — Núcleo completo (agenda, tarefas, hábitos, finanças, notificações, busca, temas, backup)
- [ ] Fase 2 — PWA instalável + APK Android (Bubblewrap TWA) + desktop Electron
- [ ] Fase 3 — Sync nuvem (Supabase) com auth JWT e criptografia client-side