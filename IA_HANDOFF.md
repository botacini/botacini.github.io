# IA_HANDOFF — estado técnico

Atualizado em 2026-07-24.

## Situação atual

A persistência da agenda foi refatorada localmente de family_config JSONB para schema relacional versionado em supabase/migrations. O frontend usa exclusivamente esse novo modelo. Nenhuma migration foi aplicada em um projeto remoto nesta estação: não há project-ref, vínculo local ou credencial registrada. O Supabase CLI pôde ser executado temporariamente, mas o stack local não iniciou porque o socket do Docker não está acessível neste sandbox.

O trabalho não deve ser considerado liberado para produção até aplicar o banco correto e executar os testes integrados descritos em SUPABASE_SETUP.md.

## Fonte de verdade e autorização

- family_access é a associação confiável entre usuário e família, por auth.uid().
- RLS não consulta user_metadata nem raw_user_meta_data.
- bootstrap_current_family cria a família inicial e o acesso owner para uma sessão autenticada.
- auth.js não deriva familyId de metadados de usuário; usa o bootstrap RPC.
- family_config é legado retido apenas para rollback e não possui mais leitura ou escrita no aplicativo.

## Modelo relacional

- Núcleo: families, family_access e family_members.
- Configuração: family_settings, family_custom_goals e family_badges.
- Agenda: tasks, task_assignees, task_schedules, task_schedule_overrides e task_occurrence_status.
- Histórico e resumos: manual_star_events, daily_summaries e weekly_summaries.

tasks guarda a definição; task_schedules guarda regras once ou weekly; task_schedule_overrides representa skip ou patch por data; task_occurrence_status é único por schedule_id e occurrence_date. Ocorrências futuras não são pré-geradas.

## Fluxos do frontend

- storage.js é a camada relacional. Criação, edição, divisão de série, overrides, conclusão, exclusão, totais e restauração chamam RPCs transacionais.
- state.js chama get_occurrences_for_date e compõe o dia selecionado com datas locais YYYY-MM-DD.
- quick-actions.js expõe tarefa única ou semanal e os escopos ocorrência, série e esta e próximas.
- missions.js grava status por ocorrência sem regravar a agenda.
- parent-panel.js opera membros, settings, metas, bônus e backup lógico.
- render.js e main.js encaminham exclusão de ocorrência e série como ações distintas.

## Migrations

1. 202607230001_extensions.sql
2. 202607230002_relational_core.sql
3. 202607230003_constraints_and_indices.sql
4. 202607230004_functions.sql
5. 202607230005_rls.sql
6. 202607230006_legacy_family_config_retained.sql
7. 202607240001_member_family_integrity.sql

SUPABASE_SETUP.md contém pré-requisitos, checagem do vínculo, aplicação controlada, testes e rollback. Nunca usar db reset no projeto remoto.

## Validação realizada

- python -m unittest -v tests\static_contract_test.py: 7 testes estáticos aprovados.
- git diff --check: aprovado.
- Smoke visual por python -m http.server e navegador headless: tela de login carregou.
- Todas as migrations foram aplicadas em PostgreSQL embarcado com schemas/usuários fictícios; referências cruzadas de membro foram rejeitadas para tarefa, meta e evento manual.

## Pendências bloqueantes

1. Disponibilizar Docker com daemon acessível e iniciar o Supabase local, ou usar PostgreSQL/Supabase de desenvolvimento confirmado.
2. Identificar o project-ref correto e executar link e aplicação das migrations manualmente, sem reset.
3. Criar js/supabase-config.js local a partir do exemplo com URL e chave pública do projeto.
4. Validar schema em banco limpo e as políticas com duas famílias e usuários.
5. Executar cenários de recorrência, concorrência, importação/exportação e transições de data.
6. Registrar os resultados antes de promover a mudança.

## Riscos conhecidos

- A agenda legada não será preservada por decisão de escopo.
- O backup novo não aceita o formato JSONB antigo.
- A restauração e as RPCs ainda exigem validação em PostgreSQL real; os testes atuais não executam SQL.
- Os escopos de edição essenciais estão implementados, mas a ergonomia precisa de revisão após uso integrado.
- A migration 202607240001 protege referências a membros contra cruzamento entre famílias; ainda deve ser exercitada com RLS em banco local ou Supabase de desenvolvimento.
