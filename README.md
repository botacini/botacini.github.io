# GP da Família

Aplicação web em HTML, CSS e JavaScript para organizar agenda, tarefas, pontos, metas e membros de uma família. O frontend não usa framework e a persistência principal foi refatorada para um modelo relacional no Supabase.

O objetivo funcional atual é levar toda a família à linha de chegada do dia. Progresso mede conclusão da rotina; estrelas medem somente a qualidade da execução.

## Estado atual

O branch `codex/refactor-supabase-tests-20260724` reúne:

- agenda baseada em datas concretas;
- tarefas únicas e recorrentes;
- edição de ocorrência, série ou ocorrência atual e futuras;
- múltiplos responsáveis;
- autenticação e isolamento por família;
- estrelas, bônus, penalidades, metas, conquistas e resumos;
- backup lógico relacional;
- navegação entre semanas com datas, setas e animação direcional;
- fechamento padronizado dos pop-ups;
- projeto Supabase separado para desenvolvimento.
- tarefas compartilhadas criadas e editadas com múltiplos participantes;
- agenda temporal comum, de `06:00` em diante, com passos de 5 minutos e altura proporcional à duração;
- progresso individual por percentual e progresso familiar pela média dos membros com tarefas;
- pista com carrinho e linha de chegada como indicador principal;
- estrelas concedidas somente por pontualidade, capricho e realização sem reclamar;
- carteira coletiva de estrelas e razão reservado para compras, desbloqueios, personalizações e campanhas;
- regressão Playwright versionada para Chromium desktop e Pixel 7.

O ambiente de desenvolvimento foi provisionado separadamente do projeto original. O núcleo dos testes integrados foi concluído; os cenários restantes estão descritos em [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Persistência

A aplicação não usa mais o documento JSONB monolítico de `family_config`.

- Famílias e acessos: `families`, `family_access`, `family_members`.
- Configurações e metas: `family_settings`, `family_custom_goals`, `family_badges`.
- Tarefas e responsáveis: `tasks`, `task_assignees`.
- Agenda: `task_schedules`, `task_schedule_overrides`, `task_occurrence_status`.
- Histórico: `manual_star_events`, `daily_summaries`, `weekly_summaries`.

Uma tarefa contém sua definição. A agenda contém regras únicas ou semanais. Ocorrências futuras são resolvidas sob demanda; somente exceções e estados concretos são persistidos.

`family_config` permanece apenas como estrutura legada temporária de rollback. O frontend novo não deve lê-la nem gravá-la.

## Segurança

- Autorização por `family_access` e `auth.uid()`.
- RLS sem uso de `user_metadata` ou `raw_user_meta_data`.
- RPCs transacionais para operações que modificam várias tabelas, indisponíveis para `anon`.
- Constraints impedem referências entre membros e famílias diferentes.
- O frontend utiliza somente URL e chave pública do Supabase; `service_role` nunca deve ser exposta.

## Temas e gamificação

A próxima evolução estrutural separará a mecânica do tema visual. O tema de corrida continuará como padrão, mas a mesma agenda poderá ser apresentada por temas como espaço, dinossauros ou reino encantado.

Trocar ou testar um tema não poderá alterar tarefas, conclusões, estrelas, saldo, conquistas, compras ou inventário.

Também está planejada uma economia interna:

- total histórico conquistado;
- saldo disponível para compras;
- loja de itens cosméticos;
- inventário por membro;
- acessórios de avatar, veículo ou personagem;
- campanhas e capítulos opcionais inspirados no Family Journey.

O plano e os critérios de aceite estão em [ROADMAP.md](ROADMAP.md).

## Estrutura relevante

- `index.html`: interface.
- `js/auth.js`: sessão e bootstrap da família.
- `js/storage.js`: API relacional do frontend.
- `js/state.js`: composição da agenda por data.
- `js/quick-actions.js`: criação e edição.
- `js/missions.js`: conclusão, bônus e penalidades.
- `js/render.js`: renderização.
- `js/parent-panel.js`: membros, configurações, metas e backup.
- `supabase/migrations`: schema, funções e RLS.
- `tests/static_contract_test.py`: contratos estáticos.
- `tests/e2e/timeline.spec.js`: regressão visual e funcional do grid, compartilhamento e progresso.
- `SUPABASE_SETUP.md`: configuração e validação do Supabase.
- `IA_HANDOFF.md`: estado técnico para continuidade.
- `ROADMAP.md`: evolução planejada.

## Validação

Já foram executados testes estáticos, verificação de whitespace, migrations no projeto de Desenvolvimento e validação integrada via Auth/Data API: login, RLS entre famílias, recorrência, edição, exceções, backup/restauração e persistência após nova sessão.

Execute `npm install` e `npm test` para rodar contratos estáticos e Playwright.

Antes de produção ainda são obrigatórios:

1. recorrências em limites de calendário;
2. concorrência;
3. regressão automatizada da navegação semanal e dos pop-ups.

## Invariantes de agenda

- Um membro não pode ter duas tarefas na mesma data e horário inicial.
- Criação e todas as modalidades de edição validam conflitos no frontend e em RPC transacional.
- Excluir uma ocorrência cria uma exceção `skip` e preserva a identidade da série.
- Encerrar o dia apenas avança a data exibida; estados das tarefas não são alterados.
