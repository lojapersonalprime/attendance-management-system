# Configuração segura do Supabase

O projeto usa um único projeto Supabase para PostgreSQL, Auth e Storage. Nenhuma credencial deve ser enviada em chats, registrada em logs ou versionada.

## Variáveis locais

Copie `.env.example` para `.env.local` e preencha os valores do painel do Supabase diretamente no VS Code. `.env.local` é ignorado pelo Git e nunca deve conter placeholders em ambiente configurado.

| Variável | Origem no Supabase | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Database > Connect, conexão de runtime com pooler | Prisma em execução no Next.js |
| `DIRECT_URL` | Database > Connect, conexão direta | Prisma CLI e migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings > API > Project URL | cliente público/Supabase SSR |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings > API > chave pública/anon | navegador e Supabase SSR |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings > API > service_role | somente scripts e backend |
| `SUPABASE_STORAGE_BUCKET` | nome do bucket | padrão `attendance-imports` |
| `NEXT_PUBLIC_APP_URL` | URL do ambiente | `http://localhost:3000` localmente |
| `MOBILE_PUNCH_ENABLED` | configuração do ambiente | inicia como `false`; habilite somente no piloto preparado |
| `MOBILE_PUNCH_RECEIPT_SECRET` | segredo aleatório do ambiente | HMAC dos comprovantes internos; somente servidor |

Nunca versione `.env.local`, chaves `service_role`, URIs de banco ou senhas. A service role não pode ser exposta ao navegador.

## Verificação e preparação

Depois de configurar as variáveis, execute nesta ordem:

```bash
npm run db:migrate
npm run setup:storage
npm run setup:admin
npm run setup:check
```

`db:migrate` usa apenas `prisma migrate deploy`; não usa `db push`, `migrate dev` ou `migrate reset`. `setup:storage` é idempotente e garante que o bucket seja privado. `setup:admin` pede a senha no terminal sem exibi-la ou armazená-la em arquivo.

Quando já houver exatamente um usuário no Supabase Auth, `npm run setup:link-admin` cria ou atualiza seu `Profile` como `RH_ADMIN` sem pedir ou alterar a senha.
