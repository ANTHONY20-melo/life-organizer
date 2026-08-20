# Life Organizer

Plataforma completa de organização pessoal — agenda, tarefas, hábitos, finanças, metas e relatórios — 100% offline-first, rodando direto no navegador, no celular (PWA/APK), e no desktop (Electron).

**🔗 Produção:** [https://life-organizer-ashen.vercel.app](https://life-organizer-ashen.vercel.app)

**📦 Downloads:**
- **Android (APK):** [GitHub Releases](https://github.com/ANTHONY20-melo/life-organizer/releases/tag/v1.0.0)
- **Desktop (Windows):** instale via `desktop/run.bat` ou gere o instalador NSIS com `cd desktop && npm run dist`
- **iPhone/PC:** abra no Safari/Chrome → Compartilhar → "Adicionar à Tela de Início" (PWA)

## ✨ Funcionalidades

- **🏠 Meu Dia** — saudação, linha do tempo de hoje, resumo financeiro, próximas contas e hábitos do dia
- **📅 Agenda** — eventos com categoria, prioridade, horário, local, repetição (diária/semanal/mensal/anual/dias específicos) e notificação; visualizações Dia/Semana/Mês/Lista
- **✅ Tarefas** — lista com prioridade, vencimento, subtarefas, filtros por status/prioridade
- **🔄 Hábitos** — acompanhamento diário, sequência (streak), histórico, tela de hoje com progresso
- **💰 Finanças** — dashboard com gráficos, contas, cartões, orçamento, metas, dívidas, patrimônio, previsão, insights e planilha
- **🔔 Notificações** — lembrete de eventos (minutos antes), contas a pagar (N dias antes), resumo matinal; via Service Worker + TimestampTrigger (Android/Chrome)
- **🔍 Busca global** — Ctrl+K
- **🌗 Temas** — dark/light/system
- **💾 Backup** — exportar/importar JSON completo

## 🧱 Arquitetura

Vanilla JS offline-first (zero dependências, zero build). Módulos IIFE em camadas:

```
Storage (localStorage) → DB (CRUD + regras) → Insights (relatórios) → Notifications (planejamento) → Export (backup) → App (UI)
```

| Arquivo | Responsabilidade |
|---------|-----------------|
| `js/storage.js` | Wrapper localStorage com prefixo `lifeorganizer_` |
| `js/db.js` | CRUD de todas as coleções + validação zero-trust |
| `js/insights.js` | Resumo do mês, top categorias, receita×despesa, previsão |
| `js/notifications.js` | Planejadores de lembretes (funções puras, testáveis em Node) |
| `js/export.js` | Backup/restore com sanitização |
| `js/app.js` | UI, navegação, modais, ações, service worker |
| `service-worker.js` | Cache offline + agendamento de notificações (TimestampTrigger) |
| `tests/` | Suíte Node.js (62 testes) |

## 🚀 Como rodar

### Local (servidor)
```bash
python server.py          # http://localhost:3337
# ou
run.bat
```

### Desktop (Electron)
```bash
cd desktop
run.bat                   # roda direto
# ou
npm install && npm start  # instala deps e abre
npm run dist              # gera instalador NSIS (~78 MB)
npm run smoke             # valida load e sai (CI)
```

### Testes
```bash
node --test tests/db.test.js tests/agenda.test.js tests/financas.test.js tests/habits.test.js tests/insights.test.js tests/notifications.test.js tests/export.test.js
```

## 📱 Instalação como app

| Plataforma | Como instalar |
|------------|--------------|
| **Android (APK)** | Baixe o `.apk` do [GitHub Releases](https://github.com/ANTHONY20-melo/life-organizer/releases/tag/v1.0.0) → instale (ativar "Fontes desconhecidas" se necessário) |
| **Android (PWA)** | Chrome → menu ⋮ → "Instalar app" |
| **iPhone** | Safari → Compartilhar → "Adicionar à Tela de Início" |
| **Windows (PWA)** | Edge/Chrome → menu ⋮ → "Instalar como app" |
| **Windows (Desktop)** | `cd desktop && run.bat` ou gere NSIS com `npm run dist` |

## 🗂️ Estrutura do projeto

```
life-organizer/
├── index.html              # SPA principal
├── manifest.json           # PWA manifest
├── service-worker.js       # SW: cache offline + notificações
├── vercel.json             # Headers para assetlinks.json
├── server.py               # Servidor local (porta 3337)
├── run.bat                 # Atalho para server.py
├── css/style.css           # Estilos (dark/light/system themes)
├── js/
│   ├── storage.js          # Persistência (localStorage)
│   ├── db.js               # CRUD + regras de negócio
│   ├── insights.js         # Relatórios e forecast
│   ├── notifications.js    # Planejadores de lembretes
│   ├── export.js           # Backup/restore
│   └── app.js              # UI + orquestração
├── icons/                  # Ícones PWA (192, 512, maskable)
├── tests/                  # Suíte de testes (62 testes)
│   └── helpers/load-app.js # Helper VM sandbox para Node
├── desktop/                # App desktop Electron
│   ├── main.js             # Janela Electron (contextIsolation ON)
│   ├── preload.js          # Bridge mínima
│   ├── package.json        # Electron + electron-builder
│   └── run.bat             # Atalho
├── twa-manifest.json       # Configuração do TWA (Bubblewrap)
├── twa/                    # Projeto Android Gradle (gerado)
├── .well-known/assetlinks.json  # Digital Asset Links (SHA256)
└── README.md
```

## 🔧 Stack

- **Frontend:** Vanilla JS, CSS3, HTML5 (zero frameworks, zero build)
- **Backend:** Nenhum (100% client-side)
- **Persistência:** localStorage (offline-first)
- **PWA:** Service Worker + Web App Manifest
- **Desktop:** Electron 33 (contextIsolation, sandbox)
- **Mobile APK:** Bubblewrap TWA (com `POST_NOTIFICATIONS`)
- **Deploy:** Vercel (alias `life-organizer-ashen.vercel.app`)
- **Testes:** Node.js native test runner (62 testes)

## 📋 Roadmap

- [x] Fase 1 — Núcleo completo (agenda, tarefas, hábitos, finanças, notificações, busca, temas, backup)
- [x] Fase 2 — PWA instalável + APK Android (Bubblewrap TWA) + desktop Electron
- [ ] Fase 3 — Sync nuvem (Supabase) com auth JWT e criptografia client-side