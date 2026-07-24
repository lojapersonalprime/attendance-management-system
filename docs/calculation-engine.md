# Motor de cálculo diário

`calculation-engine-v1` é uma função pura em `src/modules/calculations/domain/calculation-engine.ts`. Ela recebe a data de negócio, punches brutos e considerados, ajustes ativos, período de vínculo, política, jornada, cobertura e exceções. Não acessa Prisma, React, Storage ou sessão.

Na sequência regular com intervalo, `S → E → A → F`, o trabalho é `(E - S) + (F - A)` e o intervalo é `A - E`, sempre em minutos inteiros. Jornadas sem intervalo usam `S → F`. Sequência incompleta, ímpar ou anormal permanece em revisão e não gera saldo definitivo.

Entradas antecipadas, saídas tardias e intervalo curto não criam crédito automaticamente. Excedentes seguem como pendentes quando a política exige aprovação. PJ flexível pode apresentar horas realizadas sem saldo; `attendanceOnly` não cria saldo positivo, negativo ou ausência.
