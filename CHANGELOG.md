# Changelog

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

## [0.3.0 RC2] - 2026-07-22

### Changed

- navegação reorganizada para os fluxos principais do RH: importação, funcionários, jornadas, apuração mensal e pendências;
- dashboard de competência com indicadores reais, recomendações e gráficos acessíveis;
- filtros e ações em lote de funcionários simplificados, com ações exibidas somente após a seleção;
- apuração mensal e diária priorizam horas, saldo e pendências, mantendo detalhes técnicos recolhidos;
- erros de Server Actions são convertidos em códigos seguros e mensagens humanas, sem serializar erros de validação na URL.

### Added

- gráficos Recharts para horas por dia, pendências por categoria e evolução de saldo, com resumo textual alternativo;
- formulário de ajustes orientado pela ação escolhida, com duração em horas e minutos.

## [0.3.0 RC] - 2026-07-22

### Changed

- criação de jornada simplificada com aplicação de horário em lote, resumo semanal e carga derivada dos horários;
- duração apresentada em horas e minutos em jornadas, apuração e conferência;
- erros de confirmação de cobertura sanitizados, sem JSON de validação na URL;
- auditoria, inconsistências e apuração com rótulos de apresentação em pt-BR;
- etapas da importação mais claras e sem identificadores técnicos na interface principal.

### Added

- validação pura da duração diária de jornada e matriz documentada de cenários do motor para conferência do RH.

## [0.3.0] - 2026-07-22

### Added

- motor puro e versionado `calculation-engine-v1`, memória de cálculo e marcações consideradas;
- períodos históricos de vínculo, políticas configuráveis, cobertura confirmável do TXT e `CalculationRun` em lotes;
- reconciliação determinística de inconsistências, ajustes auditáveis e segmentação mensal por contexto;
- apuração detalhada com fontes, cobertura, vínculo, política, jornada, memória e validação pendente do RH;
- bloqueio auditável de mudanças de contexto em competência fechada, revisão manual de inconsistências e segmentação mensal visível na apuração;

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
