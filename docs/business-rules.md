# Regras de negócio do MVP

- O fuso de negócio é `America/Fortaleza`; timestamps persistidos usam UTC.
- Durações são minutos inteiros truncados para baixo a partir do tempo decorrido. Segundos são preservados na marcação original.
- A sequência automática regular é `S → E → A → F`. O total é `(E-S) + (F-A)`.
- Contagem ímpar, sequência diferente, códigos repetidos ou dados ausentes exigem revisão e não fecham o dia definitivamente.
- Sem jornada válida, o sistema não inventa minutos previstos e registra `MISSING_SCHEDULE`.
- Saldo acima do previsto vira `pendingExcessMinutes`; nunca aprova hora extra ou pagamento automaticamente.
- Uma marcação possível duplicada é sinalizada, nunca removida automaticamente.
- Tratamentos exigem justificativa, não alteram `RawPunch` e podem apenas ser cancelados por novo evento auditável.
- Competência fechada bloqueia alterações normais; reabertura requer motivo e auditoria.
