# Memória de cálculo

`DailySummary.calculationMemory` é JSONB serializável e versionado. Ele registra IDs de `ImportFile` e `RawPunch`, cobertura, vínculo, política, jornada, punches originais/manuais/desconsiderados/considerados, ajustes, períodos, minutos, tolerâncias e inconsistências.

Na tela de detalhe de apuração, a memória é exibida ao RH juntamente com os valores principais. Essa estrutura é derivada e pode ser substituída por um novo recálculo; não contém nem altera o TXT original.
