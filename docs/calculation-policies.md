# Políticas de cálculo

Uma política é escolhida no período de vínculo; o sistema nunca deduz uma política somente pelo tipo EMPLOYEE, INTERN ou CONTRACTOR.

As políticas sintéticas iniciais são: CLT padrão, Estágio com jornada, PJ com jornada, PJ flexível, Prestador por horas e Somente presença. Elas são idempotentemente disponibilizadas por `npm run setup:calculation-policies` e auditadas.

Campos da política controlam necessidade de jornada, atrasos, saídas antecipadas, ausência, saldo negativo, excedente, aprovação, intervalo, presença, flexibilidade, janela de duplicidade e tolerâncias. `EXCESS_ONLY` desconta a tolerância do evento; `FULL_EVENT` e `IGNORE_WITHIN_TOLERANCE` ignoram o evento dentro da tolerância e contam o evento inteiro quando ele a excede. Nenhuma configuração aprova pagamento ou hora extra automaticamente.
