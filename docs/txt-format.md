# Formato TXT AttendLog

O parser é destinado ao relatório próprio `AttendLog` observado em relógio Knup, não a um AFD fiscal oficial. O arquivo de referência real deve permanecer fora do Git.

- Codificação esperada: UTF-16 LE com BOM; UTF-16 BE e UTF-8 são detectados para falha controlada/compatibilidade.
- Linhas iniciadas em `#` são metadados (`DeviceModel`, `DeviceUID`, `DataType`, `StartPos`, `LogCount`, `LimitPos`).
- Dados são separados por tabulação; colunas vazias são preservadas para não deslocar o cabeçalho.
- A chave externa do funcionário é `EnNo`; o nome é apenas referência.
- `DateTime` aceita espaços múltiplos entre data e hora e deve conter segundos.
- Códigos aceitos: `S` entrada, `E` saída de intervalo, `A` retorno de intervalo, `F` saída final.

O parser guarda a linha íntegra, a data/hora textual original, a data/hora normalizada e o fingerprint SHA-256. Uma divergência entre `LogCount` e linhas de dados vira `IMPORT_COUNT_MISMATCH` e não é inventada.
