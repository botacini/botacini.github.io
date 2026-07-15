# GP da Família — IA Handoff

## O que é

PWA de gamificação de rotina doméstica com tema de F1. Vanilla JS ES Modules, sem bundler, GitHub Pages + Supabase. Família acessa tudo pela mesma conta; todos veem o mesmo estado em tempo real.

## Arquitetura

```
auth.js      → sessão (Supabase Auth com e-mail/senha)
storage.js   → único acesso ao Supabase (family_config JSONB)
state.js     → estado global em memória; todos os módulos leem/mutam
main.js      → único orquestrador; módulos nunca se importam lateralmente
render.js    → lê state, desenha DOM, sem efeitos colaterais
missions.js  → regras de negócio (marcar tarefa, bônus, finalizar dia/semana)
effects.js   → som (Web Audio API), vibração, toast, confete
parent-panel.js → painel admin (PIN, membros, tarefas, bônus, ajustes)
quick-actions.js → popups rápidos (nova tarefa, conquista, membro sem abrir painel)
```

**Regras arquiteturais:**
- `main.js` é o único orquestrador — módulos não se importam lateralmente
- `auth.js`, `storage.js`, `effects.js`, `missions.js` → nunca tocados salvo indicação explícita
- CSS → apenas adicionar ao final de `style.css`, nunca modificar regras existentes

## Estado atual do app (julho 2026)

### Implementado e funcionando
- Kanban por membro (1 coluna por pessoa)
- Tarefas por dia da semana com horário, emoji, responsável (individual/compartilhada/multi)
- Checklist de bônus (capricho, pontualidade, sem reclamar) → estrelas extras
- Finalização de dia e semana com relatório
- Conquistas fixas + metas personalizadas dos pais
- Painel dos pais com abas: Membros, Tarefas, Extras, Bônus, Ajustes
- Bônus manual (estrelas fora da agenda) com histórico do dia
- Cores por membro (paleta F1 automática)
- Navegação por data (modo leitura em dias passados)
- Backup/restore JSON
- Supabase Auth (e-mail/senha) — `auth.js` completo com `signUp`, `signIn`, `logout`, `onAuthStateChange`
- `family_id` = UUID do `user_metadata` (separado do `user.id`, pronto para multi-usuário)
- Popup de criação/edição de tarefa rápida (`quick-actions.js`) com campo emoji
- Nome da família exibido no cabeçalho via `updateFamilyName()` em `render.js`
- Menu ⋯ nos cards de tarefa (dropdown com Editar / Excluir)
- Botão de logout 🚪 (header mobile + rodapé sidebar desktop)
- Sidebar desktop com abas no topo e ⚙️/🚪 fixos no rodapé
- `skipParentPanelPin` default `true` (sem PIN para abrir painel por padrão)
- Toggle do painel renomeado para "SOLICITAR PIN…" com lógica invertida corretamente
- Email da conta exibido na aba Ajustes do painel

### Pendente de implementação
- Fase 3c completa: botão ➕ em todos os dias (modo leitura incluído), passando `dateKey` correto
- Fase 5b completa: lógica de edição de tarefa (`confirmNewTask` no modo edição)

### Bugs conhecidos (ainda não corrigidos)

**Bug 1 — Edição cria duplicatas em vez de atualizar**
Tarefas recorrentes existem como ocorrências independentes em cada `missionsByDay[dow]`. Ao editar e selecionar dias onde a tarefa já existe, o código atual adiciona uma nova entrada em vez de atualizar a existente. Comportamento esperado: se o dia já tem aquele `id`, atualizar no lugar; só criar nova entrada quando o dia ainda não tiver a tarefa.

**Bug 2 — Checkboxes de dias não refletem ocorrências existentes**
Ao abrir o popup de edição, os checkboxes dos dias da semana não são pré-marcados com base em onde a tarefa realmente existe. Deveriam ser marcados automaticamente todos os dias onde aquele `id` aparece em `missionsByDay`.

**Bug 3 — Exclusão remove apenas uma ocorrência**
`deleteTask` remove a entrada de um único `dow`. Deveria identificar todos os dias onde aquele `id` existe e remover todas as ocorrências, da mesma forma que a edição identificará as ocorrências para atualizar.

Os três bugs estão concentrados em `quick-actions.js` (`openNewTaskPopup`, `openEditTaskPopup`, `confirmNewTask`, `deleteTask`).

## Estrutura de dados relevante

```js
// state.config.missionsByDay[0..6] = array de tarefas do dia (0=Dom)
// Cada tarefa: { id, start, end, emoji, title, desc, assignee }
// assignee: 'compartilhada' | memberId (string) | [memberId, ...] (array)

// Supabase: tabela family_config
// family_id (PK, UUID do user_metadata) | config (JSONB)
// Chaves do JSONB: 'config', 'day:YYYY-MM-DD', 'week:YYYY-MM-DD', 'totals', 'badges', 'bonusLog'
```

## Próximo passo recomendado

Corrigir os 3 bugs em `quick-actions.js`, concentrando a lógica de "encontrar todas as ocorrências de um id nos 7 dias" em uma função auxiliar reutilizada por edição e exclusão.
