# BotaCini

Aplicação web estática para organizar agenda, pontos, metas e membros de uma família. O frontend permanece em HTML, CSS e JavaScript sem framework. A agenda foi refatorada para persistência relacional no Supabase.

## Estado de implantação

O código e as migrations desta refatoração estão versionados localmente, mas ainda não foram aplicados nem validados em um projeto Supabase remoto. Antes de uso em produção é obrigatório confirmar o projeto, aplicar as migrations, configurar a chave pública do frontend e realizar os testes integrados de schema, RLS, agenda e backup.

Credenciais, vínculo local e segredos não fazem parte do repositório. O procedimento controlado está em [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Modelo de persistência

A agenda não usa mais um documento JSONB monolítico. As responsabilidades foram separadas:

- famílias e acessos: families, family_access e family_members;
- configurações e metas: family_settings, family_custom_goals e family_badges;
- tarefas e responsáveis: tasks e task_assignees;
- regras, exceções e estados: task_schedules, task_schedule_overrides e task_occurrence_status;
- histórico e resumos: manual_star_events, daily_summaries e weekly_summaries.

Uma tarefa contém sua definição. Uma regra de agenda define uma ocorrência única por data ou uma recorrência semanal. Ocorrências futuras não são materializadas: a aplicação resolve as tarefas da data selecionada, aplica exceções e carrega somente os estados concretos já gravados.

As edições suportam esta ocorrência, toda a série e esta e as próximas. Datas são tratadas localmente como YYYY-MM-DD, sem toISOString para construir chaves de dia.

## Segurança

O acesso é autorizado por family_access, ligado a auth.uid(). As políticas RLS não usam user_metadata nem raw_user_meta_data como fonte de autorização. Operações com várias alterações usam RPCs transacionais para proteger o isolamento da família e evitar séries parcialmente alteradas.

family_config foi mantida apenas como estrutura legada temporária para rollback; o aplicativo novo não a lê nem grava. A agenda e o histórico antigos não são migrados.

## Estrutura relevante

- index.html: interface.
- js/auth.js: sessão e inicialização segura da família.
- js/storage.js: API relacional do frontend.
- js/state.js: composição da agenda por data.
- js/quick-actions.js e js/missions.js: alterações de agenda e estados.
- js/parent-panel.js: configurações, membros, metas e backup.
- supabase/migrations: schema, funções e RLS versionados.
- tests/static_contract_test.py: verificações estáticas.
- SUPABASE_SETUP.md: instalação, vínculo, aplicação, testes e rollback.

## Migrations

As migrations em supabase/migrations são ordenadas por extensões, tabelas, constraints e índices, funções, RLS e retenção reversível do legado. supabase/config.toml e supabase/seed.sql fazem parte da estrutura local do Supabase CLI.

js/supabase-config.js é ignorado pelo Git. Crie-o a partir de js/supabase-config.example.js somente no ambiente local, com URL e chave pública válidas.

## Backup

O backup exporta um formato lógico versionado com família, membros, configurações, tarefas, responsáveis, regras, exceções, estados e eventos manuais. Não é um dump bruto. A importação aceita somente esse formato novo; backups do modelo JSONB não são compatíveis.

## Validação atual

Foram aprovados testes estáticos em tests/static_contract_test.py, verificação de whitespace e um smoke visual estático servido por Python. Ainda faltam todos os testes contra PostgreSQL/Supabase real: banco limpo, RLS entre famílias, recorrência, concorrência, datas locais, sessão e importação/exportação.

Não trate esta refatoração como pronta para produção antes dessas validações. Consulte [SUPABASE_SETUP.md](SUPABASE_SETUP.md) para os comandos e a sequência controlada.
