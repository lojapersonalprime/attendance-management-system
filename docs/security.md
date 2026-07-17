# Segurança

- Supabase Auth é a fonte da sessão; `Profile.active` e `Profile.role` são a autorização interna.
- Rotas internas usam proxy de sessão e devem conferir perfil/papel no servidor antes de mutar dados.
- `SUPABASE_SERVICE_ROLE_KEY` só é lida por módulos `server-only`; nunca chega ao browser.
- O bucket de originais é privado, sem URL pública persistida.
- Logs e mensagens de erro não devem publicar linhas do relógio, nomes, hashes de sessão ou URLs de conexão.
- Arquivos são validados por extensão, tamanho e conteúdo antes de persistência.
- Não há deleção silenciosa de marcações nem de tratamentos; o histórico é preservado por ajustes e auditoria.
