# Validação do RH

O motor é uma arquitetura funcional sujeita à validação do RH; ele não está homologado nem produz efeitos financeiros. `HrCalculationValidation` armazena caso, dia, cálculo esperado, snapshot, diferença, status (`PENDING`, `APPROVED`, `REJECTED`, `NEEDS_ADJUSTMENT`), observação e validador.

Durante a validação, compare o TXT original, vínculo, política, jornada e a memória do cálculo. Use somente registros sintéticos controlados para testes de escrita; a base operacional deve receber apenas conferências autorizadas do RH.
