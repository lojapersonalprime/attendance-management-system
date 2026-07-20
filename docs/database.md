# Banco de dados

O schema Prisma está em `prisma/schema.prisma`. PostgreSQL aplica unicidade em `Device.deviceUid`, `ImportFile.fileHash`, `RawPunch.fingerprint` e `(DailySummary.employeeId, DailySummary.date)`.

Índices apoiam consultas por empregado/data, dispositivo/data, importação e status. A migration inicial inclui uma exclusão PostgreSQL para impedir sobreposição de `EmployeeScheduleAssignment`; a validação em domínio complementa essa garantia.

A migration `20260717_employee_management_and_schedules` adiciona `EmploymentType`, `Unit`, `Department`, `Position`, `EmployeeTag` e `EmployeeTagAssignment`. Ela também adiciona relações estruturadas e `mergedIntoId` ao funcionário, campos de auditoria e tolerância à jornada, e histórico de `EmployeeDeviceLink`. O antigo índice único de `(deviceId, externalEmployeeNumber)` foi substituído por uma exclusão PostgreSQL de períodos ativos sobrepostos; nenhuma linha foi removida. `RawPunch`, `ImportFile`, `DailySummary`, `Inconsistency`, `AuditLog` e migrations anteriores são preservados.

`ImportFile` também mantém `failureCode`, `failureStage`, `failureMessage` e `requestId` para falhas recuperáveis e auditáveis, sem armazenar detalhes sensíveis de provedores. `DATABASE_URL` é a conexão de runtime (pooler quando aplicável); `DIRECT_URL` é a conexão direta para migrations. O arquivo original não fica no banco: apenas caminho privado, hash e metadados são armazenados.
