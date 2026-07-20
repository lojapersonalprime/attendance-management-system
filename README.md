# Sistema de Gestão de Ponto

Sistema web open-source para o RH importar, preservar e analisar relatórios `AttendLog` de relógios de ponto compatíveis. É uma fundação técnica para tratamento de marcações: não registra o ponto no relógio, não é um REP-P, não gera AFD oficial e não substitui a validação do RH ou orientação jurídica.

> **Alpha / MVP:** a linha `0.2.0` amplia a gestão operacional de RH. O motor definitivo de cálculo continua planejado para a v0.3.0.

## Funcionalidades atuais

- Autenticação por e-mail e senha com Supabase Auth e perfil interno de RH.
- Parser para relatórios `AttendLog` tabulados, incluindo UTF-16 LE com BOM.
- Prévia, validação de metadados e importação de TXT no servidor.
- Preservação do original em bucket privado e deduplicação por hash do arquivo e fingerprint da marcação.
- Criação de cadastros provisórios a partir de `EnNo`.
- CRUD de funcionários, unidades, setores, cargos e tags, com auditoria.
- Vínculos de relógio por EnNo com vigência e histórico preservado.
- Modelos de jornada por dia da semana e associação histórica ao funcionário.
- Mesclagem manual e auditável de cadastros, sem alterar `RawPunch`.
- Filtros, paginação no servidor, ações em lote e recálculo controlado de períodos abertos.
- Apuração diária inicial, inconsistências e trilha de auditoria de importação.
- Scripts seguros de configuração e verificações locais.

## Ainda não concluído

- Motor definitivo de cálculo, memória de cálculo e recálculo operacional completo.
- Fluxo completo de ajustes, fechamento mensal e relatórios CSV pela interface.
- Suite end-to-end isolada de ponta a ponta para todos os fluxos de RH.

## Arquitetura

```text
Navegador RH → Next.js (App Router) → módulos/Route Handlers → Prisma → PostgreSQL (Supabase)
                                                       ↘ Supabase Storage privado
Supabase Auth → sessão → Profile interno → autorização por papel
```

O projeto é um monólito modular. Regras de domínio ficam em `src/modules`, separadas dos componentes React. Mais detalhes em [docs/architecture.md](docs/architecture.md).

## Stack

- Next.js 16, React 19 e TypeScript strict
- Tailwind CSS
- Prisma 7 e PostgreSQL no Supabase
- Supabase Auth e Storage privado
- Zod, React Hook Form, date-fns
- Vitest e Playwright

## Pré-requisitos

- Node.js 22.13 ou superior
- npm
- Projeto Supabase com PostgreSQL, Auth e Storage

## Instalação

```bash
git clone <URL_DO_REPOSITORIO>
cd attendance-management-system
npm ci
```

## Configuração do Supabase

Crie um projeto Supabase e configure PostgreSQL, Auth por e-mail/senha e um bucket privado. Não cole chaves em issues, commits, capturas de tela ou chats públicos.

1. Copie `.env.example` para `.env.local`.
2. Preencha os valores diretamente no editor local.
3. Mantenha `SUPABASE_SERVICE_ROLE_KEY` exclusivamente no servidor.

```bash
cp .env.example .env.local
```

Consulte [docs/supabase-setup.md](docs/supabase-setup.md) para a origem de cada variável. `.env.local` é ignorado pelo Git e nunca deve ser versionado.

## Banco, bucket e administrador

Após preencher `.env.local`, execute os comandos abaixo contra o projeto Supabase correto:

```bash
npm run db:migrate
npm run setup:storage
npm run setup:admin
npm run setup:check
```

`db:migrate` usa `prisma migrate deploy`; não use `db push`, `migrate reset` ou migrations destrutivas em bases com dados. O bucket padrão é `attendance-imports` e deve permanecer privado.

## Execução local

```bash
npm run dev
```

A aplicação fica disponível normalmente em `http://localhost:3000`.

## Testes e build

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run verify
```

`npm run verify` executa typecheck, lint, testes unitários e build. Os testes unitários usam apenas dados sintéticos. Os testes E2E requerem uma base Supabase isolada e credenciais de teste locais.

## Estrutura do TXT

O parser processa o relatório proprietário `AttendLog`, com metadados iniciados por `#`, cabeçalho tabulado e códigos de marcação `S`, `E`, `A` e `F`. A codificação esperada é UTF-16 LE com BOM. O layout não deve ser tratado como AFD fiscal oficial. Consulte [docs/txt-format.md](docs/txt-format.md).

## Proteção de dados

Arquivos de relógio, dados pessoais, dumps, relatórios, sessões de testes e arquivos `.env*` são ignorados pelo Git. O repositório contém somente o fixture fictício `tests/fixtures/attendlog-synthetic.txt` para testes. Nunca envie dados reais em commits, issues ou pull requests.

## Limitações

Esta versão não está homologada, não calcula folha de pagamento, não aprova horas extras automaticamente e não garante conformidade trabalhista. Qualquer apuração deve ser conferida pelo RH antes de ter efeito administrativo ou financeiro.

## Roadmap

- Motor de cálculo auditável, memória de cálculo e regras definitivas de tolerância.
- Ajustes, fechamento mensal e exportações CSV completas.
- Exportações CSV completas e cenários E2E isolados.

## Como contribuir

Leia [CONTRIBUTING.md](CONTRIBUTING.md), execute `npm run verify` antes de abrir um pull request e use somente fixtures sintéticos. Para convivência na comunidade, veja [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Segurança e suporte

Vulnerabilidades não devem ser reportadas em issues públicas. Consulte [SECURITY.md](SECURITY.md). Para dúvidas de uso e comunidade, consulte [SUPPORT.md](SUPPORT.md).

## Licença

Distribuído sob a [MIT License](LICENSE).
