# Gestão de jornadas

Um modelo de jornada possui sete configurações de dia, com horários, minutos previstos, intervalo, tolerâncias e indicação de aprovação de excedente. Dias não trabalhados não carregam horários, minutos ou tolerâncias; jornada sem intervalo exige intervalo previsto igual a zero. A validação garante ordem cronológica, intervalo não negativo e coerência entre horários e minutos.

`EmployeeScheduleAssignment` registra a jornada, vigência, motivo e criador. Sobreposições são bloqueadas por validação e exclusão PostgreSQL. Atribuições retroativas exigem confirmação explícita. Quando uma jornada já tem histórico, a edição oferece a criação de nova versão para que o passado não seja alterado silenciosamente.

O recálculo da v0.2.0 é preliminar e limitado aos dias afetados. Ele ignora competências fechadas, usa transações curtas em lotes e não altera `RawPunch`.
