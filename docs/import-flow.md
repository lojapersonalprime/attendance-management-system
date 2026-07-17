# Fluxo de importação

1. RH escolhe um TXT no navegador.
2. O Route Handler Node valida extensão e limite (10 MB), sanitiza nome e calcula SHA-256.
3. O parser detecta a codificação, lê metadados/cabeçalho, valida linhas e apresenta prévia.
4. Ao confirmar, o dispositivo é localizado/criado e um `ImportFile` é criado com estado `PROCESSING` antes da mutação principal.
5. O arquivo original é enviado para `attendance-imports/{deviceUid}/{year}/{fileHash}-{safeFilename}` no bucket privado com `upsert: false` e tipo `text/plain`.
6. Uma transação curta cria/identifica funcionários provisórios, vínculos por EnNo, `RawPunch`, erros de linha e inconsistências de importação. Ela não mantém chamada de rede ao Storage aberta.
7. `RawPunch.fingerprint` e `createMany(skipDuplicates)` fazem o arquivo cumulativo gravar apenas marcações novas; nenhuma operação normal atualiza ou remove `RawPunch`.
8. Um recálculo em lote consulta marcações, jornadas, ajustes e resumos por período, grava `DailySummary` e inconsistências e evita milhares de consultas sequenciais por dia.
9. Ao final, `ImportFile` recebe estado `COMPLETED` e a auditoria é registrada. Em erro, recebe `FAILED` com código, etapa, mensagem segura e `requestId`.
10. Um arquivo `COMPLETED` retorna como duplicado sem novo upload. Uma tentativa `FAILED` pode ser retomada de forma idempotente e reutiliza o objeto privado já existente quando disponível.

Os erros retornados ao navegador contêm somente código, mensagem amigável e identificador de tentativa. Detalhes de Prisma ou Supabase ficam apenas no log seguro do servidor.
