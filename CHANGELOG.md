# Changelog

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

## [Unreleased]

### Added

- gestão de funcionários, incluindo cadastros provisórios, filtros e paginação no servidor;
- tipos de vínculo, unidades, setores, cargos e tags inativáveis;
- vínculos de EnNo por dispositivo e vigência, com histórico e auditoria;
- modelos de jornada por dia da semana, versionamento operacional e atribuições com vigência;
- ações em lote, mesclagem manual auditável e recálculo limitado a competências abertas;
- validações de formulário para campos opcionais, jornada sem intervalo e dias não trabalhados;
- rotas internas tipadas e testes E2E públicos sem credenciais.

## [0.1.1]

### Fixed

- corrected an overly broad gitignore rule;
- included public import modules required by the application;
- restored successful typecheck and build in clean CI environments.

## [0.1.0]

- Autenticação Supabase.
- Schema Prisma inicial.
- Storage privado.
- Parser UTF-16.
- Importação idempotente.
- Funcionários provisórios por EnNo.
- Apuração inicial.
- Inconsistências.
- Auditoria.
- Testes e build.

O motor definitivo de cálculo e os CRUDs completos ainda estão em desenvolvimento.
