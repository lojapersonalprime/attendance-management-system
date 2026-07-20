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
- Nome não identifica funcionário. Matrícula e CPF são opcionais, mas únicos quando preenchidos; homônimos são permitidos.
- Cadastro provisório só é concluído com nome, vínculo, status, unidade e admissão. Sem jornada, a pendência `MISSING_SCHEDULE` permanece.
- EnNo pertence ao vínculo de dispositivo e período. Dois vínculos ativos iguais não podem se sobrepor; encerrar vínculo preserva seu histórico.
- Unidades, setores, cargos e tags usados por funcionários são inativados, não excluídos. Tags organizam e filtram, mas não controlam cálculo.
- Mesclagem é manual, exige justificativa e bloqueia conflitos de CPF, matrícula, vínculos, jornadas e apurações. O cadastro secundário vira `MERGED` e permanece auditável.
- Jornada válida é definida por dia da semana e vigência. Alteração de modelo já usado cria uma versão, evitando alteração silenciosa do passado.
- Recálculo lê `RawPunch` sem alterá-lo, processa somente dias afetados em lotes, ignora competências fechadas e grava solicitação e resultado em auditoria.
