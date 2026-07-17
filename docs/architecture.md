# Arquitetura

O sistema é um monólito modular. O navegador do RH usa o App Router do Next.js; Route Handlers executam operações críticas no runtime Node.js; os módulos de domínio não dependem de React; Prisma acessa PostgreSQL no Supabase.

```text
Navegador RH → Next.js (rotas/telas) → serviços de módulos → Prisma → Supabase PostgreSQL
                                          ↘ Storage privado (arquivo TXT original)
Supabase Auth → sessão → Profile interno → autorização por papel
```

- `imports`: leitura, validação, hash, deduplicação e persistência do AttendLog.
- `calculations`: funções puras para agrupar, validar e calcular minutos.
- `schedules`: vigência e escolha de jornada.
- `auth`, `employees`, `adjustments`, `audit`, `reports` e `closing`: módulos previstos para as fases seguintes.

Os objetos no Storage não são públicos. `RawPunch` é imutável por regra de domínio; efeitos do RH entram em `Adjustment` e `AuditLog`.
