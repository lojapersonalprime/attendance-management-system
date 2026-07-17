# Deploy

O destino é Vercel com Supabase PostgreSQL/Auth/Storage. Configure as variáveis listadas em `.env.example` nos ambientes Preview e Production, sem copiar a service role para variáveis públicas.

Antes de promover:

1. Execute `npm install` (ou `npm ci` depois de gerar e versionar o lockfile), `npm run prisma:generate`, `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
2. Revise e aplique migrations com `DIRECT_URL` para o projeto Supabase correto.
3. Crie o bucket privado definido em `SUPABASE_STORAGE_BUCKET` e não habilite acesso público.
4. Crie os perfis internos de RH e valide o login individual.
5. Execute Playwright em banco/usuário de teste, não em dados de produção.
