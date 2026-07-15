# 🏎️ GP da Família

Aplicativo web progressivo para organizar a rotina familiar com mecânicas de gamificação inspiradas na Fórmula 1.

Cada membro da família recebe tarefas diárias e pode ganhar estrelas de bônus ao concluí-las com capricho, pontualidade e sem reclamar. O progresso é acompanhado em um quadro visual por membro, com resumos diários, histórico semanal e conquistas desbloqueáveis.

---

## Público-alvo

Famílias com crianças que queiram tornar a rotina doméstica mais engajante por meio de metas claras, recompensas simbólicas e acompanhamento compartilhado.

---

## Funcionalidades

### Missões diárias

Cada dia da semana possui uma lista de tarefas configurável. As tarefas são exibidas em um quadro kanban com uma coluna por membro. Cada tarefa mostra horário de início e fim, emoji, título e descrição.

Ao marcar uma tarefa como concluída, um checklist de bônus permite registrar até três critérios adicionais:

- **Caprichou** — fez com cuidado e atenção
- **Na hora certa** — cumpriu no horário definido
- **Sem reclamar** — completou sem resistência

Cada critério marcado concede uma estrela extra ao time.

Tarefas podem ser atribuídas a um membro específico ou compartilhadas entre todos. Uma tarefa compartilhada aparece na coluna de cada membro envolvido.

### Sistema de estrelas

As estrelas são a unidade de pontuação do app. São ganhas pelos critérios de bônus ao concluir tarefas, e por bônus manuais concedidos pelos pais fora da agenda.

O cabeçalho exibe o total de estrelas do time no dia atual. Cada coluna do quadro de missões mostra as estrelas individuais de cada membro.

### Aba Estrelas

Exibe o total de estrelas do time comparado à meta semanal configurada, e um cartão individual para cada membro com sua pontuação do dia.

### Aba Time

Lista todos os membros da família com avatar, papel (Pai, Mãe, Criança), estrelas do dia e número de tarefas concluídas.

### Aba Conquistas

Exibe quatro conquistas fixas desbloqueáveis automaticamente pelo sistema:

| Conquista | Critério |
|---|---|
| 🏁 Primeira Corrida | Completar o primeiro dia |
| 💯 Sem Erros | Terminar um dia sem nenhuma falha |
| ✨ Capricho Total | Acumular 10 estrelas de bônus no total |
| 🏆 Semana Completa | Finalizar todos os 7 dias da semana |

Além disso, os pais podem criar conquistas personalizadas com nome, ícone e meta de estrelas, resgatáveis manualmente no Painel dos Pais.

### Resumo diário

Ao finalizar o dia, um popup exibe o percentual de tarefas concluídas, número de falhas, total de estrelas ganhas e o desempenho individual de cada membro.

### Resumo semanal

A aba Semana exibe uma barra de progresso para cada dia da semana com o percentual concluído. Ao final da semana, exibe a média geral e permite finalizar a semana para desbloquear conquistas relacionadas.

### Navegação por data

O quadro de missões permite navegar pelos dias da semana atual. Dias que não são hoje ficam em modo somente leitura — os botões de ação são desabilitados.

### Configuração inicial da família

Na primeira abertura do app, um popup solicita o nome da família. O nome é convertido internamente em um identificador único (`slug`) usado como chave no banco de dados. Esse identificador fica salvo no `localStorage` e é recuperado automaticamente nas visitas seguintes.

### Painel dos Pais

Acessível pelo botão ⚙️ no cabeçalho (mobile) ou no rodapé da barra lateral (desktop). Protegido por um PIN numérico de 4 a 8 dígitos (padrão: `1234`).

O painel é dividido em cinco subabas:

**Membros** — adicionar, editar e remover membros da família. Cada membro tem avatar (emoji), nome e papel (Pai, Mãe ou Criança). As cores das colunas são atribuídas automaticamente.

**Tarefas** — criar, editar e remover tarefas por dia da semana. É possível copiar as tarefas de um dia para outros dias selecionados. Os campos editáveis são: horário de início, horário de fim, emoji, título, descrição e responsável.

**Extras** — criar e remover conquistas personalizadas com nome, ícone e meta de estrelas. Cada conquista pode ser resgatada ou cancelada manualmente.

**Bônus** — conceder estrelas extras a membros individuais por comportamentos não agendados, com registro de motivo. Exibe o histórico de bônus do dia atual.

**Ajustes** — alterar o PIN dos pais, ativar ou desativar a exigência de PIN para finalizar o dia, ativar ou desativar a exigência de PIN para abrir o painel, exportar todos os dados como arquivo `.json` e importar um backup. Há também a opção de zerar todos os dados.

### Persistência dos dados

Todos os dados da família são armazenados no Supabase. A chave primária é o `family_id` (slug do nome da família). Todos os dados ficam em um único campo JSONB na tabela `family_config`, com sub-chaves por tipo:

```
config           → membros, tarefas, PIN, configurações gerais
day:YYYY-MM-DD   → progresso do dia (status das tarefas, estrelas)
week:YYYY-MM-DD  → resumo da semana (chave = segunda-feira da semana)
totals           → soma histórica de estrelas por membro
badges           → ids das conquistas desbloqueadas
bonusLog         → histórico de bônus manuais
```

---

## Estrutura do projeto

```
/
├── index.html          # Estrutura HTML, popups, tab-bar, script de inicialização
├── css/
│   └── style.css       # Estilos completos — mobile-first, responsivo ≥ 768px
└── js/
    ├── auth.js         # Sessão atual — única fonte de verdade sobre família/usuário
    ├── storage.js      # Acesso ao Supabase — única camada que conhece o banco
    ├── state.js        # Estado global em memória — lido por todos, escrito só aqui
    ├── main.js         # Ponto de entrada — inicializa e conecta eventos à lógica
    ├── render.js       # Renderização — lê state, desenha o DOM, sem efeitos colaterais
    ├── missions.js     # Regras de negócio — marcar tarefas, bônus, finalizar dia/semana
    ├── effects.js      # Efeitos de interface — som (Web Audio API), vibração, toast, confete
    └── parent-panel.js # Painel dos pais — PIN, membros, tarefas, bônus, ajustes
```

### Responsabilidade de cada módulo

**`auth.js`** — centraliza toda a informação sobre a sessão atual: qual família está ativa, nome amigável, se há sessão válida. Nenhum outro módulo acessa `localStorage` para dados de identidade. É o único arquivo que precisará ser alterado quando vier autenticação real.

**`storage.js`** — único arquivo que conhece o Supabase. Expõe uma API assíncrona para carregar e salvar cada tipo de dado. Obtém o `family_id` de `auth.js` — não sabe de onde esse valor vem.

**`state.js`** — objeto `state` compartilhado em memória. Carregado uma vez na inicialização a partir do Supabase (via `storage.js`). Todos os outros módulos leem e mutam `state`; nenhum deles acessa o banco diretamente.

**`main.js`** — ponto de entrada exportado como `init()`. Inicializa o estado, dispara o primeiro render, registra todos os event listeners. Faz a ponte entre módulos que não devem se conhecer (ex: `missions.js` pede PIN via evento; `parent-panel.js` responde via outro evento; `main.js` conecta os dois).

**`render.js`** — renderiza a interface a partir do `state`. Não persiste nada, não altera estrelas, não toma decisões de negócio. Exporta funções como `renderMissions()`, `renderDashboard()`, `switchTab()`.

**`missions.js`** — lógica de negócio do dia: marcar tarefa como feita ou falhada, checklist de bônus, conceder e revogar estrelas, finalizar o dia, finalizar a semana, verificar e desbloquear conquistas.

**`effects.js`** — efeitos puramente visuais e sensoriais: sons sintetizados via Web Audio API (sem arquivos externos), vibração, toast de notificação, popup de conquista desbloqueada, confete animado.

**`parent-panel.js`** — toda a lógica do painel de administração: teclado de PIN, edição de membros e tarefas, bônus manuais, metas personalizadas, backup e reset.

---

## Arquitetura

### Separação de responsabilidades

O projeto segue uma separação rígida em três camadas:

- **Renderização** (`render.js`) — lê o estado e desenha o DOM. Não decide nada.
- **Negócio** (`missions.js`, `parent-panel.js`) — altera o estado e persiste via `state.js`.
- **Persistência** (`storage.js`) — única camada que fala com o Supabase.

Essa divisão permite alterar qualquer camada sem impactar as outras.

### Sessão e identidade

`auth.js` é a única fonte de verdade sobre a sessão atual. Nenhum outro módulo:

- acessa `localStorage` para ler ou gravar `family_id`
- conhece as chaves `gp_family_id` ou `gp_family_name`
- chama `slugify` ou qualquer função de identidade diretamente

`storage.js` obtém o `family_id` chamando `getCurrentFamilyId()` de `auth.js`. Ele não sabe se esse valor veio do `localStorage`, de um cookie ou de um token JWT — e não precisa saber.

A implementação atual usa `localStorage`. A estrutura foi projetada para que a migração para Supabase Auth no futuro exija alterações **apenas em `auth.js`**.

---

## Fluxo de inicialização

```
index.html (script inline)
  │
  ├─ import { initialize, hasSession, setCurrentFamily } from auth.js
  │
  ├─ await initialize()          # restaura sessão do localStorage
  │
  ├─ hasSession() ?
  │     │
  │     ├─ sim → import main.js → await init()
  │     │                              │
  │     │                    loadState() via storage.js
  │     │                              │
  │     │                    renderDashboard()
  │     │                              │
  │     │                    registra event listeners
  │     │
  │     └─ não → exibe popup "nome da família"
  │                    │
  │               setCurrentFamily(nome)
  │                    │
  │               import main.js → await init()
```

---

## API de sessão — `auth.js`

```js
await initialize()
```
Restaura a sessão. Deve ser chamado antes de qualquer outra função do módulo. Hoje lê o `localStorage`; no futuro fará `supabase.auth.getSession()`. Retorna `true` se houver sessão ativa.

```js
hasSession() → boolean
```
Retorna `true` se existe um `family_id` definido. Seguro para chamar antes de `initialize()`.

```js
getSession() → object
```
Retorna o objeto de sessão completo. Estrutura estável — não muda quando o backend mudar:

```js
{
  authenticated: false,   // true quando vier Supabase Auth
  user: null,             // { id, email } quando autenticado
  familyId: "familia-silva",
  familyName: "Família Silva"
}
```

```js
getCurrentFamilyId() → string
```
Retorna o `family_id` (slug) usado como chave primária no Supabase.

```js
getCurrentFamilyName() → string
```
Retorna o nome amigável digitado pelo usuário na configuração inicial.

```js
setCurrentFamily(rawName) → string | false
```
Converte o nome para slug, persiste no `localStorage` e atualiza o cache de sessão. Retorna o slug gerado, ou `false` se o nome resultar em slug vazio.

```js
clearSession()
```
Remove a sessão do `localStorage` e limpa o cache em memória. Usar para trocar de família.

```js
await logout()
```
Alias semântico de `clearSession()`. No futuro incluirá `supabase.auth.signOut()`.

---

## Camadas de persistência

```
Interface (DOM)
      ↓
main.js / missions.js / parent-panel.js
      ↓  (leem e mutam state)
state.js  (estado em memória)
      ↓  (persist* → storage.js)
storage.js  (única camada que conhece o Supabase)
      ↓  (getCurrentFamilyId → auth.js)
auth.js  (única camada que conhece o localStorage de sessão)
      ↓
Supabase (tabela family_config)
```

O `localStorage` é acessado **somente por `auth.js`**, exclusivamente para dados de identidade da sessão (`gp_family_id`, `gp_family_name`). Todos os dados da família (tarefas, estrelas, conquistas etc.) vivem no Supabase.

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| HTML / CSS / JavaScript | Estrutura, estilos e lógica — sem framework |
| ES Modules (`type="module"`) | Organização do código em módulos nativos do browser |
| Supabase JS SDK v2 | Acesso ao banco de dados via CDN |
| Supabase (PostgreSQL) | Persistência de dados — tabela `family_config` |
| Web Audio API | Sons sintetizados em tempo real, sem arquivos externos |
| Google Fonts | Orbitron (display) e Rajdhani (corpo) |
| CSS Custom Properties | Sistema de design tokens (cores, fontes) |
| CSS Grid / Flexbox | Layout responsivo |

O projeto não usa bundler, transpilador, framework de UI nem dependências npm. Funciona diretamente no browser a partir de arquivos estáticos.

**Compatibilidade:** mobile-first, com layout adaptado para telas ≥ 768px (desktop). No desktop, o título ocupa uma topbar horizontal e a navegação fica em uma sidebar lateral com as abas no topo e o botão de configurações no rodapé.

---

## Banco de dados

**Provedor:** Supabase (PostgreSQL)

**Tabela:** `family_config`

| Campo | Tipo | Descrição |
|---|---|---|
| `family_id` | `text` (PK) | Slug do nome da família (ex: `familia-silva`) |
| `config` | `jsonb` | Todos os dados da família em um único objeto |

O campo `config` é um objeto com sub-chaves:

```json
{
  "config":          { "members": [], "missionsByDay": {}, "pin": "1234", ... },
  "day:2026-07-07":  { "missionStatus": {}, "memberStars": {} },
  "week:2026-06-30": { "weekKey": "...", "days": {}, "finalized": false },
  "totals":          { "mem_abc": 12 },
  "badges":          ["primeira-corrida", "sem-erros"],
  "bonusLog":        [{ "date": "...", "memberId": "...", "stars": 2, "reason": "..." }]
}
```

O acesso ao banco usa upsert com `onConflict: 'family_id'`, garantindo que gravações concorrentes não criem registros duplicados.

---

## Estado atual e bugs conhecidos

### Implementado (v2.1)

- Supabase Auth com e-mail/senha — `family_id` é UUID do `user_metadata`, separado do `user.id`
- Dashboard kanban com cores por membro, menu ⋯ nos cards (Editar / Excluir)
- Nome da família no cabeçalho; sidebar desktop com rodapé fixo (⚙️ / 🚪)
- Painel dos pais abre sem PIN por padrão; e-mail da conta exibido na aba Ajustes

### Bugs conhecidos (pendentes)

Todos concentrados em `quick-actions.js`:

- **Edição cria duplicatas** — ao editar tarefa recorrente e selecionar dias onde ela já existe, cria nova entrada em vez de atualizar
- **Checkboxes de dias incorretos** — popup de edição não pré-marca os dias onde a tarefa realmente existe
- **Exclusão remove só uma ocorrência** — deveria remover o mesmo `id` de todos os dias da semana onde ele aparece

### Próximos passos

- Corrigir os 3 bugs de edição/exclusão de tarefas recorrentes em `quick-actions.js`
- Múltiplos responsáveis por família (roles admin/membro, fase 2 de auth)
- Convites para família via link ou código
