# TXT como fonte primária das marcações

> O TXT é a fonte primária das marcações. Dados de RH são contexto complementar com vigência. Resultados são derivados e reproduzíveis.

O arquivo `AttendLog` original é armazenado sem alteração no Storage privado. Sua identidade é o hash do arquivo e ele é ligado ao dispositivo que o produziu. O arquivo não é uma fonte fiscal oficial, mas é a evidência física a partir da qual esta aplicação reproduz a apuração interna do RH.

## Hierarquia de dados

1. **Fonte física:** o TXT original no Storage privado.
2. **Fonte bruta:** `RawPunch`, com arquivo, dispositivo/DeviceUID, EnNo, nome e código/hora/linha originais, além do fingerprint.
3. **Identidade organizacional:** `Employee` e `EmployeeDeviceLink`, selecionado pela vigência na data da marcação.
4. **Contexto histórico:** período de vínculo, política de cálculo, jornada e exceção de calendário vigentes naquela data.
5. **Tratamentos:** `Adjustment` auditável. Uma inclusão manual é identificada como `MANUAL_ADJUSTMENT`; ela não se passa por marcação do relógio.
6. **Dados derivados:** marcações consideradas, `DailySummary`, inconsistências, memória do cálculo e agregações mensais, todos com versão do motor e instante do processamento.

`RawPunch` nunca é atualizado ou apagado pelo sistema. Não se muda a hora, os segundos, a linha, o código `S`/`E`/`A`/`F` ou o fingerprint de uma marcação já importada. O cálculo somente lê essas fontes e grava resultados derivados.

## Cobertura de importação

As datas mínima e máxima das marcações sugerem a cobertura de um arquivo, mas não confirmam que o período inteiro foi entregue pelo relógio. Por isso, uma ausência somente pode ser derivada se o RH tiver confirmado a cobertura (`coverageFrom` e `coverageTo`) do respectivo `ImportFile`.

Antes da confirmação, o motor registra `IMPORT_COVERAGE_UNCONFIRMED` e não cria falta, ausência completa ou "dia sem registro". Mesmo após a confirmação, datas anteriores a `coverageFrom`, posteriores a `coverageTo` e competências não cobertas continuam fora da regra de ausência.

## Reprodutibilidade

Cada memória de cálculo registra a data de negócio, os arquivos e punches lidos, o vínculo, a política, a jornada, a cobertura, ajustes, períodos formados, tolerâncias, minutos e inconsistências. Recalcular a mesma entrada com a mesma versão do motor produz o mesmo resultado derivado; nenhuma alteração de cadastro atual reinterpreta silenciosamente o passado.

## Privacidade

O TXT real e as memórias contendo pessoas reais não pertencem ao repositório. Testes públicos usam exclusivamente `tests/fixtures/attendlog-synthetic.txt`; a conferência local do TXT operacional produz somente contagens anonimizadas.
