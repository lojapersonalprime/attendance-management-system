# Períodos de vínculo

`Employee.employmentType` é informação cadastral atual; ele não escolhe o contexto histórico. `EmployeeEmploymentPeriod` é a fonte do vínculo na data da apuração e guarda tipo, política, vigência, motivo, notas e autor.

Não há sobreposição entre períodos não cancelados. Ao iniciar uma mudança como CLT para PJ em 16/07, o formulário exige política e permite encerrar explicitamente o período anterior em 15/07. Datas retroativas exigem confirmação e alterações em competência fechada exigem reabertura.

O relatório mensal segmenta somatórios por período e política. Portanto, saldos CLT e PJ não são misturados automaticamente.
