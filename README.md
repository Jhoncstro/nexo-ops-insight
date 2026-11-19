# Nexo Ops Insight

Criar o projeto Nexus Workspace (Nexo Empresarial) como uma aplicação completa no Lovable com Lovable Cloud (autenticação e banco de dados).

O projeto é baseado no sistema Nexo Empresarial (gestão operacional e inteligência para PMEs):

1. Autenticação e Multi-empresa:
- Login e cadastro de usuários com Lovable Cloud Auth (email/senha)
- Gestão de múltiplos workspaces/empresas por usuário
- Seletor de empresa ativa na barra lateral com opção de cadastrar nova empresa (nome, setor, localização)

2. Visão Geral (Dashboard):
- Cartões de indicadores: Operações em aberto, Em andamento, Fora do prazo, Prioridade alta
- Atividade recente com status e responsável
- Recomendações explicáveis geradas com base nas regras internas ativas
- Barra de ritmo de entrega (% de conclusão)

3. Operações:
- Tabela de operações com busca em tempo real e filtro por status (Abertas, Em andamento, Concluídas)
- Edição rápida de status e prioridade (Baixa, Média, Alta)
- Modal de criação de operação (Título, Categoria, Responsável, Impacto esperado, Prioridade, Status, Prazo)
- Remoção de operações com confirmação

4. Inteligência Operacional:
- Gráficos de fluxo mensal (operações abertas vs. concluídas)
- Distribuição de volume por categoria
- Composição percentual por status
- Painel de sinais e insights explicáveis para revisão humana
- Exportação de relatório em CSV

5. Regras Internas:
- Configuração de critérios de atenção (métricas: operações fora do prazo, prioridade alta, operações em aberto)
- Condições (> , ≥ , < , ≤) e limites customizáveis
- Orientação descritiva para revisão humana
- Ativação/pausa, edição e exclusão de regras

Identidade visual e layout:
- Tema profissional e elegante em tons de ardósia, verde escuro suave (#275b4f / #326754), detalhes em dourado/âmbar (#e9bd63 / #d9aa52) e fundo limpo.
- Sidebar de navegação responsiva com suporte a desktop e mobile.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://nexo-ops-insight.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1cb314e5-3bc0-4e63-84e1-42fb709cc4b5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Etapa 1 — segurança e equipes

Consulte [implementação, validação e pendências](docs/security-foundation.md).
Os recursos de equipe exigem a proposta SQL aplicada pelo Lovable em homologação
e `VITE_NEXUS_TEAMS_ENABLED=true`. Permanecem desativados por padrão.
Nesta branch, instale e valide com pnpm usando `pnpm-lock.yaml`.
