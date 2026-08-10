# Deploy

O destino é Vercel com Supabase PostgreSQL/Auth/Storage. Configure as variáveis listadas em `.env.example` nos ambientes Preview e Production, sem copiar a service role para variáveis públicas.

## Pesquisa de locais autorizados

O piloto usa Photon/OpenStreetMap no backend por padrão. Em **Preview** e **Production**, configure `PLACE_SEARCH_PROVIDER=photon`; `PHOTON_BASE_URL` é opcional e assume `https://photon.komoot.io`. Photon não requer `GOOGLE_MAPS_API_KEY`, portanto o Preview funciona com `MOBILE_PUNCH_ENABLED=true` sem Google Cloud Billing.

O endpoint público Photon é somente para piloto e baixo volume: o formulário aplica debounce, cancela buscas anteriores, limita resultados, cacheia consultas recentes no servidor e usa timeout. Não o use para processamento em lote, em segundo plano ou durante a batida. Para produção com maior volume, configure `PHOTON_BASE_URL` para uma instância própria de Photon/OpenStreetMap ou adote um provider comercial.

`GOOGLE_MAPS_API_KEY` continua opcional para o futuro. Se `PLACE_SEARCH_PROVIDER=google`, cadastre-a somente no servidor, habilite apenas **Places API (New)** e aplique restrições/quota compatíveis com tráfego server-to-server. Não use o prefixo `NEXT_PUBLIC_`, não a coloque em commits nem em logs.

O backend normaliza somente identificador do provider, nome, endereço e coordenadas. As coordenadas selecionadas são gravadas na `AuthorizedLocation`; a batida mobile usa exclusivamente esse dado local e Haversine, sem consultar Photon ou Google.

Antes de promover:

1. Execute `npm install` (ou `npm ci` depois de gerar e versionar o lockfile), `npm run prisma:generate`, `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
2. Revise e aplique migrations com `DIRECT_URL` para o projeto Supabase correto.
3. Crie o bucket privado definido em `SUPABASE_STORAGE_BUCKET` e não habilite acesso público.
4. Crie os perfis internos de RH e valide o login individual.
5. Execute Playwright em banco/usuário de teste, não em dados de produção.
