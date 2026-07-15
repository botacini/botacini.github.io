# Changelog — GP da Família

---

## v2.1 (2026-07-15) — UI, layout e painel dos pais

### Implementado

**Visual e conteúdo**
- Botão de logout trocado de 🔓 para 🚪 (header e painel)
- Nome da família exibido no cabeçalho: `GP DA FAMÍLIA · <nome>`
- `updateFamilyName()` exportada de `render.js`, chamada em `main.js`

**Layout responsivo (CSS only)**
- Colunas do kanban expandem para preencher a largura disponível em telas ≥ 480px (`flex: 1 1 160px`)
- Sidebar desktop: abas no topo, botões ⚙️ e 🚪 fixos no rodapé separados por linha divisória
- `tab-bar` reestruturada com `tab-bar-tabs` + `tab-bar-bottom` no `index.html`

**Menu ⋯ nos cards de tarefa**
- Cada tarefa não-compartilhada exibe botão ⋯ que abre dropdown com "✏️ Editar" e "✕ Excluir"
- Dropdown fecha ao clicar fora ou ao abrir outro
- Visível em todos os dias (inclusive modo leitura)

**Painel dos pais**
- `skipParentPanelPin` default alterado para `true` (painel abre sem PIN por padrão)
- Toggle renomeado para "SOLICITAR PIN PARA ABRIR O PAINEL DOS PAIS" com lógica invertida (`= !e.target.checked`)
- Seção "CONTA" adicionada à aba Ajustes com e-mail da conta logada (somente leitura)
- `getSession()` importado de `auth.js` em `parent-panel.js`

**Arquivos modificados:** `index.html`, `css/style.css`, `js/render.js`, `js/main.js`, `js/parent-panel.js`, `js/state.js`

### Bugs conhecidos (pendentes de correção)

**Bug 1 — Edição cria duplicatas**
Ao editar uma tarefa recorrente e selecionar dias onde ela já existe, o sistema adiciona nova entrada em vez de atualizar a existente.

**Bug 2 — Checkboxes de dias incorretos no popup de edição**
Os checkboxes não são pré-marcados com os dias onde a tarefa realmente existe em `missionsByDay`.

**Bug 3 — Exclusão remove apenas uma ocorrência**
`deleteTask` remove somente o `dow` atual; deveria remover todas as ocorrências do mesmo `id` nos 7 dias.

Os três bugs estão em `quick-actions.js`.

---

## v2.0 (2026-07-05) — Kanban, metas personalizadas, bônus manual

- Dashboard kanban com 1 coluna por membro
- Cores por membro (paleta automática estilo F1)
- `assigneeIds()` em `state.js` normaliza os 3 formatos de `assignee` (retrocompat total)
- Metas personalizadas (aba Extras no painel dos pais)
- Bônus manual com histórico do dia (aba Bônus no painel dos pais)
- `checkAndUnlockBadges()` exportada para uso externo
- Supabase Auth com e-mail/senha; `family_id` = UUID separado do `user.id`
- Auto-cura de configs antigas (cores ausentes, campos novos)

**Arquivos modificados:** `state.js`, `storage.js`, `render.js`, `missions.js`, `parent-panel.js`, `quick-actions.js`, `style.css`, `index.html`

---

## v1.0 — Base

- Lista de tarefas por dia da semana com horários
- Checklist de bônus (capricho, pontualidade, sem reclamar)
- Finalização de dia e semana com relatório
- 4 conquistas fixas desbloqueáveis
- Painel dos pais com PIN (membros, tarefas, ajustes)
- Persistência localStorage → migrado para Supabase
