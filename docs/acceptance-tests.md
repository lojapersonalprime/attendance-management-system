# Testes de aceitação

## Disponíveis localmente

- Parser UTF-16/BOM, metadados, tabulações, códigos, datas inválidas e LogCount.
- Hash/fingerprint e prévia de deduplicação.
- Cálculo S-E-A-F, minutos inteiros, sequência anormal, duplicidade e ajustes não mutáveis.
- Seleção e sobreposição de vigência de jornada.

## Dependentes de ambiente

Playwright exige um projeto Supabase configurado, migration aplicada, bucket privado e `E2E_AUTH_EMAIL`/`E2E_AUTH_PASSWORD` no ambiente. O teste de interface cobre login e a navegação inicial; os cenários de confirmação de importação, cadastro, tratamento e CSV devem ser habilitados quando houver uma base de testes isolada.

Checklist final: login, importação e idempotência reais, cadastro de jornada, apuração, ajuste auditável, fechamento, CSV, lint, tipos, Vitest, Playwright e build.
