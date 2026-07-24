# Cobertura do TXT

`ImportFile` conserva `earliestPunchAt` e `latestPunchAt` e passa a guardar `coverageFrom`, `coverageTo`, `coverageStatus`, autor e data de confirmação. A importação apenas sugere a cobertura com a menor e a maior marcação.

O RH confirma ou corrige esse intervalo na tela de importações. A confirmação cria um `CalculationRun` restrito aos funcionários presentes naquele arquivo e às datas da cobertura. Ausência só pode ser derivada dentro de cobertura confirmada; cobertura sugerida ou ausente gera `IMPORT_COVERAGE_UNCONFIRMED` e nunca falta automática.
