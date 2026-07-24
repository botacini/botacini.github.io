# Changelog — GP da Família

## v3.0 (2026-07-23) — Persistência relacional versionada [PENDENTE DE APLICAÇÃO NO SUPABASE]

### Alterado

- A agenda deixou de ser armazenada como um documento JSONB único em family_config.
- Foram adicionadas migrations versionadas para famílias, acessos, membros, configurações, tarefas, responsáveis, regras, exceções, estados de ocorrência, eventos manuais e resumos.
- Tarefas suportam regra única por data e recorrência semanal sem materializar ocorrências futuras.
- Edições distinguem ocorrência, série e esta e as próximas; a divisão de série é transacional.
- Conclusões, bônus e exclusões de ocorrência persistem por data concreta, sem regravar o estado integral da família.
- Backup e importação foram atualizados para um formato lógico versionado; backups JSONB antigos não são compatíveis.

### Segurança

- A autorização foi movida para family_access e auth.uid().
- As políticas RLS não usam user_metadata nem raw_user_meta_data.
- Índices foram incluídos nas relações e colunas usadas para isolamento de família.

### Infraestrutura e documentação

- Adicionada estrutura supabase/config.toml, supabase/migrations e supabase/seed.sql.
- Adicionado js/supabase-config.example.js; a configuração local real é ignorada pelo Git.
- Adicionado SUPABASE_SETUP.md com instalação, vínculo seguro, aplicação manual, validação e rollback.
- README e IA_HANDOFF refletem a arquitetura relacional e o estado de implantação.

### Validação local realizada

- tests/static_contract_test.py: 6 verificações estáticas aprovadas.
- git diff --check: aprovado.
- Smoke visual estático com python -m http.server: tela de login carregou.

### Pendências de release

- As migrations ainda não foram aplicadas no Supabase remoto.
- Ainda é obrigatório confirmar project-ref, vínculo, permissões e ambiente antes de db push.
- Ainda devem ser realizados testes com PostgreSQL/Supabase real: migrations em banco limpo, RLS entre famílias, recorrência, concorrência, datas locais, exportação/importação e recuperação de sessão.
- Não promover esta mudança para produção antes dessas validações.

### Compatibilidade

- A agenda e o histórico JSONB antigos não são migrados.
- family_config é retida temporariamente somente para rollback e não é usada pelo aplicativo novo.

## v2.1 (2026-07-15) — UI, layout e painel dos pais

- Evolução visual do kanban, responsividade e painel dos pais.
- Inclusão de menu de tarefas e ajustes de conta.
- O modelo JSONB desta versão foi substituído pela refatoração v3.0.

## v2.0 (2026-07-05) — Kanban, metas personalizadas e bônus manual

- Dashboard por membro, metas personalizadas, bônus manual e integração inicial com Supabase Auth.

## v1.0 — Base

- Agenda semanal, bônus, relatórios, conquistas e painel dos pais.
