# Etapa 1 — segurança do Nexus

## Entrega e limites

Base auditada: `main` em `532b4494b6e2b24de9c58412425b70a48fd66757`.
A auditoria cobre código e SQL versionados. Não houve conexão ao banco hospedado,
inspeção das políticas efetivamente instaladas, envio de e-mails, deploy ou alteração
no projeto Lovable. Não confundir os testes locais com validação de produção.

As regras em `AGENTS.md` reservam `drizzle/`, `supabase/migrations/` e arquivos
gerados ao Lovable. A proposta transacional está em
`database/proposals/001_security_foundation.sql`: **não é uma migração instalada**.
Solicitar sua importação ao Lovable em homologação. O cliente mantém um contrato
complementar em `src/lib/security.ts`, sem editar os tipos gerenciados.

## Achados e correções

- A migração inicial usa RLS com `owner_id` e `owns_company`, coerente com empresas
  de um único dono; não existe associação de equipes no esquema original.
- Cache de empresas agora separado por identidade autenticada, com verificação de
  usuário antes da consulta. Logout/mudança de identidade cancelam consultas e
  limpam cache e seleção local. A troca de empresa remove consultas anteriores e
  remonta formulários para não reaproveitar estado de outra empresa.
- Consultas de operações/regras propagam cancelamento, paginam em lotes de 500
  (configurar o limite da API para pelo menos 500) e levam erros ao limite de erro
  da aplicação, sem exibir totais parciais como completos. A ordenação é estável por
  data e id; alterações concorrentes entre páginas ainda exigem nova consulta para
  refletir um retrato atualizado, não constituem um snapshot transacional.
- Updates/deletes filtram `id` **e** `company_id`, solicitam retorno de exatamente
  um registro e tratam negação/ausência como erro. A atualização rápida de operação
  aceita somente `priority` e `status`. A autorização definitiva permanece no RLS.
- Recuperação em `/auth?recovery=1`, formulário de senha sem redirecionamento
  automático, validação da sessão antes da atualização e logout após sucesso.
  Cadastro e nova senha exigem 12 caracteres; login aceita senhas antigas.
- Equipes ficam atrás de `VITE_NEXUS_TEAMS_ENABLED=true`, desativado por padrão.
  Sem o sinalizador, o app continua compatível com o esquema original.

## Contrato de permissões da proposta SQL

| Ação | owner | admin | member |
|---|---|---|---|
| Ler empresa, equipe, operações e regras | sim | sim | sim |
| Criar e atualizar operações | sim | sim | sim |
| Excluir operações e gerenciar regras | sim | sim | não |
| Atualizar dados da empresa | sim | sim | não |
| Convidar membros | sim | sim | não |
| Convidar administradores e alterar/remover membros | sim | não | não |
| Consultar auditoria | sim | sim | não |

A proposta inclui backfill dos donos, um owner por empresa, vínculo ao usuário de
Auth e criação automática do owner de novas empresas. Não há escrita direta de
membros pelo navegador. Funções privilegiadas usam `search_path` vazio e autorização
interna, com execução anônima revogada. IDs, empresa e proprietário são imutáveis;
transferência de propriedade e exclusão de empresa ficam indisponíveis até haver
fluxo próprio de retenção e exportação. Exclusão de conta do owner é bloqueada pela
FK até que a propriedade seja resolvida.

Convites usam um código UUID aleatório, vencem em sete dias e exigem o e-mail
confirmado do destinatário em `auth.users`. O aceite bloqueia a linha, impede replay,
revalida a autoridade de quem convidou e preserva o papel de um membro existente.
O formulário permite criar, compartilhar manualmente, aceitar e revogar o código
recém-criado. Nenhum e-mail de convite é enviado automaticamente. Listagem de
convites pendentes e entrega automática dependem de uma próxima integração de e-mail;
o RPC de revogação também aceita um código conhecido.

Auditoria via triggers registra ator, empresa, ação, tabela, identificador e horário
para empresas, operações, regras, membros e convites. Não armazena conteúdo de
registros, senhas, e-mails ou tokens de convite; não permite alterações pelo cliente.
Não é um histórico completo de valores anteriores/posteriores, nem substitui os logs
de autenticação do provedor. Definir retenção e exportação antes de produção.

## Homologação e implantação (pendentes)

1. Criar ambiente separado no Lovable/Supabase com dados sintéticos e confirmar a
   branch ligada ao Lovable. Este PR não deve ser mesclado/publicado automaticamente.
2. Inspecionar no ambiente o catálogo (`pg_policies`, privilégios de tabelas/funções,
   funções `SECURITY DEFINER`, triggers, índices, migrações e schema exposto). Comparar
   com `0000_migration.sql`; a proposta assume exatamente essa base e falha diante de
   nomes divergentes. Verificar owners inexistentes, nomes vazios e integridade dos dados.
3. Obter backup e concluir restauração em banco descartável antes de aplicar a proposta.
4. Pedir ao Lovable a importação da proposta como migração gerenciada. Não executar
   `drizzle push`: `drizzle/schema.ts` não representa o esquema completo. Regenerar os
   tipos do cliente no Lovable e comparar com o contrato complementar.
5. Confirmar RLS e grants reais: nenhum grant amplo herdado pode permitir escrita em
   membros, convites ou auditoria. Repetir os testes com contas reais de duas empresas
   via API de homologação, incluindo criação de empresa com `INSERT RETURNING`.
6. Configurar URLs permitidas de Auth com o domínio exato e `/auth?recovery=1`, remetente
   e SMTP, confirmação de e-mail, expiração de links, política de senha (mínimo 12),
   proteção de senhas vazadas e limites de login/recuperação. Validar Google/Lovable.
7. Ativar `VITE_NEXUS_TEAMS_ENABLED=true` **somente** após aplicar/validar o esquema e
   refazer o build em homologação. Testar convite, revogação, expiração, aceite único,
   sessão expirada, recuperação por e-mail e troca de conta/empresa no navegador.
8. Revisar PR e obter confirmação explícita antes de migração/deploy de produção.
   O merge pode sincronizar o código com o Lovable; não foi realizado nesta entrega.

Rollback da aplicação: desativar o sinalizador e republicar a versão anterior de
homologação. Isso não reverte RLS nem apaga membros/auditoria. Preferir correção
incremental no banco; não remover tabelas nem reintroduzir políticas amplas para
resolver falhas. Restauração de produção exige decisão explícita e janela planejada.

## Backups e recuperação

`scripts/backup-staging.sh` é manual, usa variáveis `PGHOST`, `PGDATABASE`, `PGUSER`
e autenticação por arquivo/ambiente; não aceita conexão como argumento nem imprime
segredos. Exige `NEXUS_BACKUP_TARGET=staging` e destino inexistente. Esse marcador
é uma declaração do operador, não uma prova técnica de que o host é homologação.
Verificar o host antes de executar. O script não foi executado contra nenhum banco.

Com utilitários PostgreSQL compatíveis instalados e destino protegido:

```sh
NEXUS_BACKUP_TARGET=staging scripts/backup-staging.sh /secure/nexus-staging.dump
pg_restore --list /secure/nexus-staging.dump
# Somente com PG* apontando para um banco descartável recém-criado:
pg_restore --exit-on-error --no-owner --no-acl --dbname="$PGDATABASE" /secure/nexus-staging.dump
```

A restauração deve ocorrer em instância de homologação com os papéis e serviços
Supabase necessários. Validar contagens por empresa, RLS/grants e os fluxos de Auth
após restaurar. O dump não preserva ACLs/ownership: reaplicar e verificar privilégios
gerenciados antes de aceitar o teste. Backups de objetos Storage, segredos, SMTP,
configuração de Auth e provedores externos precisam de procedimento separado.
Criptografar arquivos, restringir acesso, definir retenção/RPO/RTO e verificar a
cobertura de backups/PITR no plano do provedor. Não há rotina agendada nem backup
real validado nesta entrega.

## Validação reproduzível

Node 24 e pnpm 11.25.0; `pnpm-lock.yaml` fixa a resolução usada no CI. O `bun.lock`
original foi preservado como histórico; para esta branch utilizar pnpm. Scripts de
instalação autorizados somente para esbuild em `pnpm-workspace.yaml`.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run typecheck
pnpm run lint:security
pnpm build
```

O workflow não recebe segredos, usa valores fictícios de Supabase e não faz deploy.
Os testes SQL aplicam a migração inicial e a proposta em PostgreSQL embarcado
(PGlite) com papéis não privilegiados, duas empresas e usuários distintos. Isso
verifica políticas reais no motor PostgreSQL, mas não serviços Supabase/Auth,
PostgREST, SMTP, concorrência de múltiplas conexões ou configurações hospedadas.

Referências: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[recuperação de senha](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).

## Resultado da validação local

- 19 testes passaram em 6 arquivos, incluindo 7 cenários SQL de isolamento e papéis.
- TypeScript e lint de todos os arquivos de aplicação alterados passaram.
- Build completo passou; também foi verificado com equipes habilitadas e credenciais
  fictícias, sem conexão aos serviços hospedados. Há avisos de tamanho de bundle e
  configuração do empacotador, sem impedir o build.
- O lint geral continua falhando por formatação preexistente: a base original tinha
  470 erros e 6 avisos; após formatar os arquivos alterados restam 355 erros e 6 avisos
  em arquivos fora desta mudança, inclusive gerenciados. Não foram reformatados.
- O script de backup passou por validação de sintaxe; backup e restauração reais
  continuam pendentes. O workflow remoto depende da execução no GitHub após o PR.
