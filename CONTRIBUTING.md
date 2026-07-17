# Como contribuir

Obrigado por contribuir. Este projeto processa dados de ponto, portanto privacidade e rastreabilidade são requisitos essenciais.

## Antes de começar

- Abra uma issue antes de mudanças grandes para alinhar escopo.
- Crie uma branch de feature a partir de `main`.
- Não implemente funcionalidades fora do escopo acordado do MVP.
- Nunca envie TXT real, dados de funcionários, credenciais, sessões, dumps, relatórios ou capturas com informações sensíveis.

## Desenvolvimento

1. Configure seu próprio Supabase de desenvolvimento e mantenha `.env.local` fora do Git.
2. Use fixtures sintéticos em `tests/fixtures`.
3. Mantenha `RawPunch` imutável; tratamentos devem ser eventos auditáveis.
4. Escreva ou atualize testes para qualquer mudança de comportamento.
5. Execute antes de abrir o pull request:

```bash
npm run verify
```

## Pull requests

Explique o problema, a solução e os testes realizados. Mantenha mudanças pequenas e focadas. O template de pull request inclui a confirmação de que nenhum dado real ou segredo foi anexado.
