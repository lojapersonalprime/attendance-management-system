# Guia para agentes — Personal Prime Ponto

## Objetivo e prazo

Construir até **24 de julho de 2026** o MVP interno do RH para importar e tratar relatórios `AttendLog` de relógio Knup. Não é REP-P, AFD fiscal ou sistema homologado. O escopo não inclui folha, acesso de funcionários, integração direta ao relógio, IA ou microserviços.

## Stack e comandos

Next.js App Router, TypeScript strict, React, Tailwind/shadcn, Prisma 7/PostgreSQL Supabase, Supabase Auth e Storage privado, Zod, React Hook Form, date-fns, Vitest e Playwright. Use npm neste repositório salvo a criação futura de lockfile diferente.

`npm run dev`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run prisma:format`, `npm run prisma:validate`, `npm run prisma:generate`, `npm run build`, `npm run verify`.

Depois de preencher `.env.local`, use `npm run db:migrate` (somente `prisma migrate deploy`), `npm run setup:storage`, `npm run setup:admin`, `npm run setup:link-admin` (quando houver exatamente um usuário Auth) e `npm run setup:check`. Esses comandos não podem imprimir chaves, senhas ou URIs de conexão.

## Organização

- `src/app`: rotas e composição de interface.
- `src/modules`: regras de domínio e serviços por módulo; regras de cálculo não vão em React.
- `src/lib`: integrações de infraestrutura, ambiente, banco, storage, datas e segurança.
- `prisma`: schema, migrations e seed.
- `tests`: fixtures sintéticos, unitários e E2E.

## Regras invioláveis

- Nunca editar ou apagar `RawPunch`; use `Adjustment` e `AuditLog` para todo tratamento.
- Preservar a linha e o arquivo original, com fingerprint único por dispositivo, EnNo, data/hora e código.
- Todos os cálculos usam minutos inteiros; segundos ficam preservados somente na marcação original.
- Nunca aprovar excedente automaticamente como hora extra paga.
- Usar `America/Fortaleza` como fuso de negócio e UTC nos timestamps do banco.
- Não cadastrar jornada com base somente no arquivo; respeitar vigência e não permitir sobreposição silenciosa.
- Não deixar credenciais no código nem expor service role ao navegador.
- Não executar migration destrutiva, nem push remoto, sem autorização explícita.

## Convenções e pronto

Código e tabelas em inglês; interface e mensagens em pt-BR. Valores monetários não fazem parte do MVP. Uma entrega está pronta quando tem validação Zod, testes relevantes, estados de erro/vazio, auditoria quando muda dado de negócio, e passa lint, tipos, testes e build.
