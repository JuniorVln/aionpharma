# CRM Admin — Aion Pharma

Painel em `/admin` para gerenciar influencers e cupons.

## Setup rápido

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode o arquivo `../supabase/schema.sql`.
3. Em **Authentication → Users**, crie um usuário (e-mail/senha) para o admin.
4. Em **Settings → API**, copie:
   - Project URL → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon` `public` → `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (só no backend / Vercel)
5. Preencha `admin/.env` a partir de `.env.example`.
6. Na raiz do repo e na Vercel, configure as 3 variáveis `SUPABASE_*`.

## Desenvolvimento local

```bash
# terminal 1 — loja + APIs
vercel dev

# terminal 2 — painel
cd admin && npm install && npm run dev
```

Admin em http://localhost:5174/admin/ (proxy de `/api` para a porta do `vercel dev`).

## Deploy

O `vercel.json` na raiz já faz `npm install` + build do admin e reescreve `/admin` → `admin/dist`.
