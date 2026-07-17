# Banco de dados

O schema Prisma está em `prisma/schema.prisma`. PostgreSQL aplica unicidade em `Device.deviceUid`, `ImportFile.fileHash`, `RawPunch.fingerprint` e `(DailySummary.employeeId, DailySummary.date)`.

Índices apoiam consultas por empregado/data, dispositivo/data, importação e status. A migration inicial inclui uma exclusão PostgreSQL para impedir sobreposição de `EmployeeScheduleAssignment`; a validação em domínio complementa essa garantia.

`ImportFile` também mantém `failureCode`, `failureStage`, `failureMessage` e `requestId` para falhas recuperáveis e auditáveis, sem armazenar detalhes sensíveis de provedores. `DATABASE_URL` é a conexão de runtime (pooler quando aplicável); `DIRECT_URL` é a conexão direta para migrations. O arquivo original não fica no banco: apenas caminho privado, hash e metadados são armazenados.
