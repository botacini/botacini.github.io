# Supabase — configuração e aplicação controlada

## Estado de release

As migrations e a adaptação do frontend estão prontas no repositório, porém ainda não foram aplicadas nem validadas em um banco Supabase real. A validação local cobriu apenas contrato estático e smoke visual. Aplicar as migrations e executar os testes integrados e de RLS deste documento é obrigatório antes de produção.

Nenhum comando remoto foi executado neste ambiente. O Supabase CLI, Node.js, Docker e PostgreSQL local não estavam disponíveis; também não havia project-ref, vínculo local ou credenciais de banco configurados.

## O que obter no painel

Obtenha no painel Supabase, sem registrar segredos no Git ou no chat:

1. Project ref em Project Settings > General.
2. Project URL e chave publishable ou anon em Project Settings > API.
3. Senha do banco somente quando o CLI pedir uma conexão administrativa.
4. Confirmação do ambiente correto e permissão para aplicar migrations.

Não é necessário criar GitHub Actions nem secrets de GitHub. O padrão deste repositório é Git para versionar migrations e aplicação remota por comando manual controlado.

## Configuração local do frontend

Crie um arquivo não versionado a partir do exemplo:

~~~powershell
Copy-Item js\supabase-config.example.js js\supabase-config.js
~~~

Preencha somente a URL do projeto e a chave pública. Não use service_role no navegador.

## Instalar e autenticar o Supabase CLI

Instale o CLI pelo método oficial adequado ao sistema operacional. Depois confirme a instalação e autentique no navegador:

~~~powershell
supabase --version
supabase login
~~~

O login armazena a sessão localmente. Não copie o token para arquivos do projeto.

## Verificar e vincular o projeto correto

Na raiz do repositório, confirme primeiro que não existe um vínculo inesperado e que o project-ref corresponde ao painel:

~~~powershell
Get-ChildItem -Force supabase
supabase link --project-ref SEU_PROJECT_REF
supabase status
~~~

Se o CLI solicitar a senha do banco, informe-a somente no prompt. Interrompa se o nome, referência ou ambiente exibido não for o projeto esperado.

## Revisar o schema remoto antes de aplicar

As migrations locais foram criadas para esta refatoração. Para auditar o estado remoto sem misturar um pull no histórico destas migrations, use uma cópia limpa de trabalho ou um branch de auditoria:

~~~powershell
supabase db pull
git diff -- supabase/migrations
~~~

Não execute db reset no projeto remoto. Não remova family_config nem dados legados sem uma migration reversível aprovada.

## Aplicar as migrations

Após confirmar projeto, backup e permissões, aplique as migrations versionadas:

~~~powershell
git status --short
supabase migration list
supabase db push
supabase migration list
~~~

Verifique no painel ou com o CLI que todas as migrations de 202607230001 até 202607230006 foram aplicadas. A agenda antiga não será migrada; o aplicativo passará a usar as tabelas novas.

## Validar após a aplicação

Execute primeiro as verificações disponíveis no repositório:

~~~powershell
python -m unittest -v tests\static_contract_test.py
git diff --check
python -m http.server 4173
~~~

Depois, em um ambiente Supabase real ou banco local limpo, valide obrigatoriamente:

1. família sem tarefas;
2. tarefa única, recorrência semanal e vários responsáveis;
3. edição de ocorrência, série e esta e as próximas;
4. exclusão de ocorrência e de série;
5. conclusão em datas distintas, mudança de domingo, mês e ano e ausência de deslocamento UTC;
6. recarga sem duplicação e repetidas gravações de série sem criar tarefas extras;
7. duas famílias isoladas por RLS, inclusive tentativa de forjar family_id;
8. duas abas alterando registros distintos;
9. exportação e importação do novo backup;
10. aplicação em banco limpo.

Também confirme no SQL que family_config não é consultada pelo frontend e que as políticas usam family_access associado a auth.uid().

## Geração de tipos

O projeto não usa tipos gerados hoje. Se TypeScript for introduzido futuramente, gere-os somente após aplicar o schema:

~~~powershell
supabase gen types typescript --linked > database.types.ts
~~~

Não adicione essa etapa nem uma automação de deploy sem necessidade explícita.

## Rollback

Não há rollback automático de dados de agenda porque a agenda antiga não é migrada. Antes de db push, gere o backup operacional habitual do projeto remoto.

Para reverter código, volte ao commit anterior e publique a versão anterior do frontend. A migration 202607230006 apenas retém family_config e não o remove. Para reverter tabelas ou funções novas, crie uma nova migration reversível após avaliar dependências e dados produzidos; não use db reset em ambiente remoto.

Se a aplicação das migrations falhar, pare, preserve a saída do CLI, execute supabase migration list e compare o schema antes de tentar uma correção. Não force a execução em um projeto cuja identidade não tenha sido confirmada.
