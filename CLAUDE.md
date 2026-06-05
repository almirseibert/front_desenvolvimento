# MAK Frotas — Frontend

## Diretrizes de Comportamento do Assistente

You are not my assistant. You are my advisor who happens to be smarter than me. Follow these rules in every reply:

1. Never start with agreement. Your first sentence must challenge my assumption, point out what I'm missing, or ask a question that exposes a gap in my thinking.
2. Rate your confidence. Before any claim, tag it:
   - [Certain] if you have hard evidence.
   - [Likely] if it's a strong inference.
   - [Guessing] if you are filling gaps.
   If most of your reply is guessing, say so first.
3. Never use these phrases: "Great question", "You're absolutely right", "That makes a lot of sense", "Absolutely", "Definitely". If you catch yourself writing one, delete it and rewrite.
4. Disagree with structure. When I'm wrong, say: "I disagree because [reason]. Here's what I'd do instead [alternative]. The risk in your approach is [specific downside]."
5. Give me the uncomfortable answer first. If there's a truth I probably don't want to hear, lead with it. Put it in the first line, not buried later.
6. No warm-up paragraphs. Skip introductions like "There are several ways to look at this.", "It depends.", or any other filler opening. Start with the most useful thing you can say.
7. If I push back, don't fold. Hold your position unless I provide genuinely new information. "But I really think…" is not new information.

Sistema de gestão de frotas de veículos para MAK Serviços. Controla veículos, obras, manutenções, abastecimento, faturamento, funcionários e mais.

## Stack

- **React 18** com JavaScript (arquivos `.js` / `.jsx`, não TypeScript)
- **Create React App** (`react-scripts 5`) como build tool
- **Tailwind CSS 3** para estilização (utility-first)
- **Socket.io Client 4** para eventos em tempo real do backend
- **Lucide React** para ícones
- **Leaflet + react-leaflet** para mapas
- **jsPDF + jspdf-autotable** para exportação de PDF
- **react-big-calendar + moment** para agendas e calendários
- **PapaParse** para importação de CSV

## Comandos

```bash
npm start        # Servidor de desenvolvimento em http://localhost:3000
npm run build    # Build de produção em /build
npm test         # Testes (react-scripts test)
```

### Build Docker (produção)

```bash
docker build --build-arg REACT_APP_API_URL=<url> -t frotas-frontend .
```

O Dockerfile usa multi-stage build: Node 18 Alpine para build, Nginx 1.25 Alpine para servir. O `nginx.conf` faz fallback para `index.html` para suportar SPA.

## Variáveis de Ambiente

| Variável | Uso |
|----------|-----|
| `REACT_APP_API_URL` | URL base da API (usada em produção e no build Docker) |

Em desenvolvimento, o `.env` aponta para o backend no Easypanel. Em produção, a variável é injetada como `ARG` no build Docker.

## Arquitetura

### Roteamento

**Não usa React Router.** O roteamento é feito via estado `currentPage` no `App.js`. O componente `Sidebar` chama `setCurrentPage()` e `App.js` renderiza o componente correspondente com `renderPage()`. Consequência: não há URLs por página nem suporte a bookmarks.

### Autenticação

`src/contexts/AuthContext.js` — Context API com JWT:
- Token armazenado em `localStorage` como `authToken`
- `login()` → POST `/auth/login` → armazena token → GET `/auth/me`
- `logout()` → remove token do localStorage
- Hook: `useAuth()` expõe `user`, `login`, `logout` e flags de permissão

### Permissões (roles)

Lidas de `user.user_type` e normalizadas em flags booleanas:

| Flag | Role |
|------|------|
| `isAdmin` | `admin` |
| `isEditor` | `editor` ou `admin` |
| `isOperator` | `operador` |
| `isViewer` | `viewer` ou `visualizador` |
| `canAccessRefueling` | `podeAcessarAbastecimento === true` ou admin |

Operadores são redirecionados diretamente para `SolicitacaoAbastecimentoPage` sem acesso ao restante do app.

### API Client

`src/services/apiClient.js` — wrapper sobre `fetch()` nativo:
- Base URL: `process.env.REACT_APP_API_URL || 'http://localhost:3001/api'`
- Injeta `Authorization: Bearer <token>` automaticamente em todas as requisições
- Para uploads com `FormData`, remove o header `Content-Type` automaticamente
- Lança `Error` com a mensagem do backend em caso de resposta não-ok

### Carregamento de dados (refatorado — DataContext)

`src/contexts/DataContext.js` — Context API com **lazy loading + cache**.

**Comportamento:**

1. **Bootstrap (essencial):** após login, carrega apenas `vehicles`, `obras`, `employees`, `partners`. Isso libera a tela em ~1 fetch round-trip (vs. 12 antes).
2. **Lazy (sob demanda):** `revisions`, `expenses`, `refuelings`, `comboioTransactions`, `fines`, `diarioDeBordoLogs`, `dailyWorkLogs`, `orders` são carregados quando uma página que precise deles for aberta. O resultado fica em cache durante a sessão — abrir a página de novo é instantâneo.
3. **Pré-fetch por página:** o `App.js` mantém um mapa `PAGE_RESOURCE_REQUIREMENTS` que dispara `ensureAll([...])` ao navegar. As páginas continuam recebendo os dados via props normalmente — não precisam ser alteradas.
4. **Socket.io seletivo:** `server:sync` invalida apenas os recursos que JÁ ESTÃO em cache. Se ninguém abriu a página de multas, mudanças em `fines` não disparam fetch.
5. **Deduplicação:** dois `ensure('vehicles')` simultâneos compartilham a mesma promise via `inFlightRef`.

**Hook principal: `useData()`**

```javascript
const {
    // Dados (essenciais — sempre disponíveis após bootstrap)
    vehicles, obras, employees, partners,

    // Dados (lazy — vazios até serem requisitados via ensure)
    revisions, expenses, refuelings, comboioTransactions, fines,
    diarioDeBordoLogs, dailyWorkLogs, orders,

    // Status
    bootstrapLoading,  // true durante o boot inicial
    syncing,           // true quando há refetch em background

    // API
    ensure,            // ensure('fines') — carrega se ainda não estiver
    ensureAll,         // ensureAll(['fines','expenses'])
    refresh,           // refresh('vehicles') — força refetch
    invalidate,        // invalidate('fines') — marca como stale
    reload,            // reload() — recarrega tudo que está cacheado

    // Socket.io
    socket,
} = useData();
```

**Hook auxiliar: `useEnsureResources(keys)`**

Para páginas que sabem de cara o que precisam. Equivalente a `useEffect(() => ensureAll(keys), [...])`:

```javascript
import { useEnsureResources } from '../contexts/DataContext';

const FinesPage = () => {
    useEnsureResources(['fines']);
    const { fines } = useData();
    // ...
};
```

> **Padrão de migração de páginas:** as páginas atuais continuam recebendo `vehicles`, `fines`, etc. via props (vindo de `commonProps` no `App.js`). Não é necessário migrar todas de uma vez. Quando for refatorar uma página, prefira ler do `useData()` direto e usar `useEnsureResources` para garantir o load — isso permite remover a página gradualmente do `commonProps`.

### Modais globais

Definidos no `App.js` como componentes memoizados (`React.memo`) e passados como props para as páginas:
- `CustomAlert` — alerta simples com texto pré-formatado
- `ConfirmationModal` — confirmação com botões customizáveis
- `PasswordConfirmationModal` — confirmação com validação de senha via API
- `UpdateMessageModal` / `AdminPendingRequestAlert` — notificações do sistema

### Processamento de alertas de veículos

`src/utils/vehicleAlerts.js` — função `processVehiclesWithAlerts(vehicles, revisions, fines)` que anexa `{ possuiAviso, avisoTexto }` a cada veículo.

Anteriormente vivia no `App.js` e era O(V × R × F). Agora pré-indexa `revisions` e `fines` em `Map`/`Set` e processa em O(V + R + F).

## Estrutura de Pastas

```
src/
├── App.js                       # Raiz: roteamento, modais globais, commonProps memoizado
├── contexts/
│   ├── AuthContext.js           # Autenticação e permissões
│   └── DataContext.js           # Estado global de dados (lazy + cache + socket)
├── services/
│   └── apiClient.js             # Wrapper de fetch com todos os endpoints
├── utils/
│   ├── vehicleRules.js          # Taxonomia de veículos e regras de leitura (Km vs Hr)
│   └── vehicleAlerts.js         # Processamento O(V+R+F) de alertas de veículos
├── pages/                       # Uma página por módulo do sistema
└── components/
    ├── modals/                  # Modais de criação e edição
    ├── dashboard/               # Painéis do dashboard
    ├── reports/                 # Componentes de relatório (PDF)
    ├── revisions/               # Abas de manutenção (revisões, lavagens)
    └── supervisor/              # Visão específica de supervisor de obra
```

## Convenções

### JavaScript / React

- Componentes em `.js`, não `.tsx` — não criar arquivos TypeScript
- Componentes funcionais com hooks (`useState`, `useEffect`, `useMemo`, `useCallback`)
- `useMemo` para listas e cálculos derivados que dependem de estado grande (ex: alertas de veículos, ranking de consumo)
- Nenhum gerenciador de estado externo (sem Redux, Zustand, etc.) — usar Context API
- **Memoizar componentes pesados** com `React.memo` quando recebem props estáveis (modais globais, painéis do dashboard)

### Estilização

- Tailwind CSS exclusivamente — não criar arquivos CSS por componente
- Paleta principal: `yellow-500` (primário/ação), `slate-900` / `slate-800` (sidebar), `gray-50` / `gray-100` (fundo de conteúdo)
- Status visual: `green` = ativo/ok, `red` = alerta/erro, `yellow` = atenção/pendente, `gray` = inativo

### Nomenclatura

- Componentes de página: `NomePage.js` (ex: `VehiclePage.js`, `ObrasPage.js`)
- Componentes de modal: `NomeModal.js` dentro de `components/modals/`
- Funções de API no `apiClient.js`: `verbRecurso` em camelCase (ex: `getVehicles`, `createObra`, `updateEmployee`)
- Texto da UI em português brasileiro

### Regras de leitura de veículos (`vehicleRules.js`)

- Veículos leves e caminhões de trecho → odômetro (Km)
- Caminhões pesados e máquinas → horímetro (Hr)
- Validações: sem regressão de leitura, salto máximo de 1.000 Km ou 50 Hr
- Sempre usar `getAllowedReadingTypes()` e `getVehicleMainReading()` em vez de lógica inline

### Adicionando novos módulos

1. Criar `src/pages/NovoModuloPage.js`
2. Importar em `App.js` (lazy) e adicionar caso em `renderPage()`
3. Adicionar item de navegação em `Sidebar.js` com controle de role se necessário
4. Adicionar endpoints correspondentes em `apiClient.js`
5. Se o módulo tiver recurso próprio, registrar em `DataContext.js` no `RESOURCE_DEFS` (essential ou lazy) e adicionar mapeamento em `TARGET_TO_RESOURCE` para invalidação via socket
6. Adicionar `currentPage` em `PAGE_RESOURCE_REQUIREMENTS` no `App.js` com os recursos que a página precisa
