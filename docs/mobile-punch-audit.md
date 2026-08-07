# Auditoria para o piloto de ponto móvel

Data da auditoria: 07/08/2026. Esta proposta preserva o fluxo de relógio físico
existente e introduz uma fonte de marcação independente para o piloto Golden
Shopping.

## Estado atual

- A sessão é do Supabase Auth. O `Profile` associa `authUserId` a um perfil
  interno; atualmente há apenas as funções `RH_ADMIN` e `RH_ANALYST`.
- O acesso ao painel é protegido no servidor por `requireActiveProfile()` e as
  alterações de negócio usam `requireAuditContext()`/`requireRhAdmin()`.
  Não há políticas RLS versionadas neste repositório; o acesso ao PostgreSQL é
  feito exclusivamente no servidor via Prisma.
- O TXT é analisado por `executeImport`, que cria `ImportFile`, mantém o
  arquivo original privado e insere apenas `RawPunch` imutável. O vínculo com
  o empregado é resolvido por `EmployeeDeviceLink` vigente para dispositivo,
  EnNo e data da marcação.
- `runCalculation` seleciona o vínculo, jornada e política vigentes; carrega
  os `RawPunch` do dia, ajustes e cobertura confirmada; e chama
  `calculateDailyWithEngine` (`calculation-engine-v1`). O resultado persiste
  em `DailySummary`, `Inconsistency` e memória de cálculo versionada.

## Relação de acesso proposta

`Supabase Auth User -> Profile (role EMPLOYEE) -> EmployeeMobileAccess -> Employee`.

`EmployeeMobileAccess` será um vínculo um-para-um ativo entre um `Profile` e
um `Employee`. Ele guardará somente o hash do PIN, estado de habilitação e a
unidade autorizada. Isso mantém a autoria dos eventos no `AuditLog` existente
sem expor o PIN, e permite que o portal derive o empregado exclusivamente da
sessão no servidor. Perfis `EMPLOYEE` não entram no layout administrativo.

## Ponto de extensão do cálculo

`RawPunch` não será alterado nem reutilizado. Uma camada de normalização vai
produzir `NormalizedPunch` de `RawPunch` e `MobilePunch`. Para o motor, cada
item continua contendo o identificador, instante, código interpretado e
origem. A fonte mobile salva batidas neutras; na normalização, o código é
derivado deterministicamente da ordem do dia e da jornada efetiva (`S/E/A/F`
quando há intervalo; `S/F` quando não há). Assim o motor continua único, com
suas regras de tolerância, excesso, ajustes e pendências.

## Estruturas que serão reutilizadas

- `Employee`, `Unit`, `EmployeeScheduleAssignment`,
  `EmployeeEmploymentPeriod` e `CalculationPolicy` continuam sendo a fonte
  vigente do contexto da batida.
- `runCalculation`, `DailySummary`, `Inconsistency`, `Adjustment`,
  `ClosingPeriod` e `AuditLog` continuam sendo usados; o novo gatilho apenas
  recalcula o dia afetado.
- `AttendanceTimeline` e a memória do cálculo exibem a origem discretamente
  para RH. Correções continuam criando `Adjustment`, nunca alterando uma
  marcação original.

## Migration aditiva proposta

- Enum `UserRole`: adicionar `EMPLOYEE`; enum `CalculationRunTrigger`:
  adicionar `MOBILE_PUNCH`.
- `AuthorizedLocation`, ligada a `Unit`, com raio, precisão máxima, política
  de exceção e ativação.
- `EmployeeMobileAccess`, ligada a `Profile`, `Employee` e à unidade
  permitida, com hash de PIN, controle de tentativas e aceite de privacidade.
- `MobilePunch`, imutável e idempotente por `requestId`, com instante do
  servidor, metadados mínimos de localização e comprovante verificável.
- `AttendanceCorrectionRequest`, que cria uma pendência para RH sem modificar
  uma batida, e pendências próprias de localização na `Inconsistency`.

Nenhuma migration existente será alterada, e a SQL será revisada antes de
qualquer aplicação. Coordenadas reais, PINs, tokens e dados reais não farão
parte de fixtures ou do repositório.
