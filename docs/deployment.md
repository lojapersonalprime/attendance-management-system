# Deploy

O destino é Vercel com Supabase PostgreSQL/Auth/Storage. Configure as variáveis listadas em `.env.example` nos ambientes Preview e Production, sem copiar a service role para variáveis públicas.

## Pesquisa de locais autorizados

Configure `GOOGLE_MAPS_API_KEY` somente no servidor da Vercel, tanto em **Preview** quanto em **Production**. A chave é usada pelo backend para a Places API (New); não use o prefixo `NEXT_PUBLIC_` e não a coloque no browser, em commits ou em logs.

No Google Cloud, habilite somente **Places API (New)** para esta chave. Aplique também uma restrição de aplicação compatível com o tráfego server-to-server (endereços IP/CIDR de saída disponíveis para o ambiente) e limites/quota de uso. Use chaves distintas para Preview e Production quando possível. O Preview deve receber sua própria chave restrita antes de testar a busca; sem ela, o formulário mantém os fallbacks e informa que o serviço ainda não foi configurado.

O backend solicita somente sugestões, nome, endereço e coordenadas. Não solicita fotos, avaliações, telefone, horários ou outros campos de Places. As coordenadas selecionadas são gravadas no banco e a batida mobile continua usando apenas a `AuthorizedLocation` local, sem consultar o Google.

Antes de promover:

1. Execute `npm install` (ou `npm ci` depois de gerar e versionar o lockfile), `npm run prisma:generate`, `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
2. Revise e aplique migrations com `DIRECT_URL` para o projeto Supabase correto.
3. Crie o bucket privado definido em `SUPABASE_STORAGE_BUCKET` e não habilite acesso público.
4. Crie os perfis internos de RH e valide o login individual.
5. Execute Playwright em banco/usuário de teste, não em dados de produção.
