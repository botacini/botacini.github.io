# Supabase — ambientes, migrations e validação

## Ambientes

- Produção original: preservada; não aplicar alterações durante o desenvolvimento.
- Desenvolvimento: projeto separado `GP da Família - Desenvolvimento`, região `sa-east-1`.

O branch `codex/refactor-supabase-tests-20260724` deve usar somente o ambiente de desenvolvimento até a promoção planejada.

## Configuração do frontend

`js/supabase-config.js` é versionado porque o GitHub Pages precisa receber a configuração no navegador. Ele contém apenas:

- URL do projeto de desenvolvimento;
- chave pública `publishable` ou `anon`.

Nunca use `service_role` no navegador. A chave `publishable`/`anon` é pública por definição; a proteção de dados depende exclusivamente de RLS.

## Migrations

Migrations atuais:

1. `202607230001_extensions.sql`
2. `202607230002_relational_core.sql`
3. `202607230003_constraints_and_indices.sql`
4. `202607230004_functions.sql`
5. `202607230005_rls.sql`
6. `202607230006_legacy_family_config_retained.sql`
7. `202607240001_member_family_integrity.sql`

Elas foram aplicadas no projeto de desenvolvimento. Novas mudanças de schema devem ser adicionadas como migrations versionadas; nunca editar retroativamente uma migration já aplicada.

## Fluxo controlado

No repositório:

~~~powershell
supabase --version
supabase login
supabase link --project-ref PROJECT_REF_DE_DESENVOLVIMENTO
supabase migration list
supabase db push
supabase migration list
~~~

Confirme o nome e o `project-ref` antes de qualquer `db push`. Nunca use `db reset` em projeto remoto.

## Validação obrigatória

1. Criar conta, confirmar sessão, sair e entrar novamente.
2. Criar duas famílias com usuários distintos.
3. Tentar ler e escrever dados da outra família.
4. Criar tarefa única e recorrente com vários responsáveis.
5. Editar ocorrência, série e ocorrência atual e futuras.
6. Excluir ocorrência e série.
7. Concluir tarefas em datas distintas e limites de semana, mês e ano.
8. Confirmar ausência de deslocamento UTC nas chaves locais.
9. Recarregar sem duplicar tarefas.
10. Alterar registros distintos em duas abas.
11. Exportar e importar backup lógico.
12. Executar `tests/static_contract_test.py` e `git diff --check`.
13. Regressão da navegação semanal, animações e fechamento dos pop-ups.

## Segurança

Confirmar:

- políticas baseadas em `family_access` e `auth.uid()`;
- ausência de autorização por `user_metadata`;
- rejeição de membros, metas e eventos de outra família;
- operações compostas executadas por RPC transacional;
- nenhuma referência a `service_role` no frontend.

## Promoção para produção

Quando o ambiente de desenvolvimento estiver maduro:

1. congelar o schema aprovado;
2. gerar backup do ambiente escolhido para produção;
3. aplicar as mesmas migrations em ordem;
4. configurar URL e chave pública no deploy de produção;
5. executar o checklist integrado;
6. manter o frontend anterior disponível para rollback.

Não copiar segredos, usuários de teste ou dados fictícios para produção.

## Rollback

- Código: republicar a versão anterior.
- Banco: criar migration reversível após avaliar os dados produzidos.
- Não remover tabelas nem usar `db reset`.
- `family_config` permanece temporariamente disponível apenas para rollback da versão antiga.
