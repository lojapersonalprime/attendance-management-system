# Validação manual do motor — v0.3.0 RC

O motor `calculation-engine-v1` recebe apenas marcações normalizadas, contexto vigente e ajustes auditáveis. Os casos abaixo usam `tests/fixtures/attendlog-synthetic.txt` e dados sintéticos; nenhuma marcação de produção é usada como fixture.

| Caso | Contexto e marcações | Resultado esperado |
| --- | --- | --- |
| Jornada exata | 08–12 / 13–18; S, E, A, F nos mesmos horários | 9h trabalhadas, 1h de intervalo, saldo 0h |
| Atraso dentro da tolerância | Entrada 5min após o previsto | Aplicar somente o comportamento definido pela política |
| Atraso além da tolerância | Entrada após a tolerância | Atraso e inconsistência `LATE_ARRIVAL` |
| Saída antecipada | Saída antes do horário esperado | Débito e `EARLY_DEPARTURE` quando a política calcular saída antecipada |
| Intervalo longo | Intervalo 10min maior | `INTERVAL_TOO_LONG` quando aplicável; não altera a linha TXT |
| Intervalo curto | Intervalo menor que o mínimo | `INTERVAL_TOO_SHORT`; crédito somente se a política permitir |
| Saída tardia | Saída após o previsto | Excedente pendente quando exigir aprovação |
| Três marcações | Sequência incompleta | Dia sem saldo definitivo e `INCOMPLETE_DAY` |
| Apenas entrada e saída | Política/jornada exige intervalo | Dia pendente ou sequência tratada pela política; nunca inventar intervalo |
| Duplicidade | Duas marcações no intervalo configurado | RawPunch preservado e `POSSIBLE_DUPLICATE` reconciliável |
| Dia sem marcação coberto | Jornada e cobertura confirmada | `NO_PUNCHES_ON_SCHEDULED_DAY`; ausência apenas dentro da cobertura |
| Dia fora da cobertura | Jornada sem marcações, cobertura ausente | Não gera falta; gera pendência de cobertura quando necessário |
| CLT para PJ | Vigências distintas no mês | Cada dia usa o período histórico vigente; segmentos mensais separados |
| Mudança de jornada | Nova atribuição retroativa autorizada | Recálculo somente de dias afetados e abertos |
| PJ flexível | Política flexível | Exibe horas registradas sem saldo automático não autorizado |
| Somente presença | Política `attendanceOnly` | Presença e marcações visíveis, sem saldo definitivo |

Os testes automatizados cobrem o motor, a reconciliação e os cálculos de duração da jornada. A validação de regras contratuais e de política permanece responsabilidade do RH.
