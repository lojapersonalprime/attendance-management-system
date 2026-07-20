# Testes de aceitação

## Disponíveis localmente

- Parser UTF-16/BOM, metadados, tabulações, códigos, datas inválidas e LogCount.
- Hash/fingerprint e prévia de deduplicação.
- Cálculo S-E-A-F, minutos inteiros, sequência anormal, duplicidade e ajustes não mutáveis.
- Seleção e sobreposição de vigência de jornada.
- Validação de funcionário, vínculo, CPF/matrícula, cadastro provisório e tags sintéticas.
- Jornada por dia, jornada sem intervalo, minutos coerentes, vigência e confirmação retroativa.
- Conflitos de mesclagem, vínculo de EnNo e recálculo que ignora competência fechada.

## Dependentes de ambiente

Os testes Playwright públicos carregam o login, verificam a proteção de rota e falhas de console sem credenciais. O roteiro autenticado de leitura exige Supabase configurado e `E2E_AUTH_EMAIL`/`E2E_AUTH_PASSWORD` locais. Cenários de escrita permanecem ignorados até haver seed sintético e ambiente isolado marcado explicitamente com `E2E_ISOLATED=true` e `E2E_WRITE_ENABLED=true`; nunca podem apontar para a base operacional.

Checklist final: login, filtro de provisórios, criação sintética, conclusão de provisório, tags, unidades, setores, cargos, jornada, atribuição, histórico, paginação, logout, lint, tipos, Vitest, Playwright e build. As ações de escrita requerem dados sintéticos identificáveis e limpeza limitada a esses IDs.
