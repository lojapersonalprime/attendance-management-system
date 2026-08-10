# Deploy

O destino é Vercel com Supabase PostgreSQL/Auth/Storage. Configure as variáveis listadas em `.env.example` nos ambientes Preview e Production, sem copiar a service role para variáveis públicas.

## Convites de acesso mobile e URLs públicas

O convite de acesso do funcionário usa sempre a origem pública resolvida no servidor e a rota fixa `/auth/callback`; essa rota consome a sessão do convite e entra em `/meu-ponto`. Ela não confia em `Host`, `Origin` ou outros headers da requisição.

- Em **Production**, configure `NEXT_PUBLIC_SITE_URL=https://ponto.seu-dominio.com` somente para o ambiente Production.
- Em **Preview**, não defina `NEXT_PUBLIC_SITE_URL` com a URL de Production. Habilite as System Environment Variables da Vercel para disponibilizar `VERCEL_URL` (ou `NEXT_PUBLIC_VERCEL_URL`); o convite usará `https://<deployment>.vercel.app/auth/callback`.
- Em desenvolvimento local, a origem é `http://localhost:3000`.

No Supabase, abra **Authentication → URL Configuration** e configure a Site URL de Production. Em **Redirect URLs**, adicione pelo menos:

```
https://ponto.seu-dominio.com/auth/callback
http://localhost:3000/**
https://*-<team-or-account-slug>.vercel.app/**
```

Substitua o domínio e o slug pelos valores do projeto. O último padrão cobre os previews Vercel sem liberar domínios externos. Se os modelos de e-mail foram personalizados, use `{{ .RedirectTo }}` no link de convite para que o `redirectTo` seja respeitado.

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
