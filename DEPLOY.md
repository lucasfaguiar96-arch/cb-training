# CB Training Futevôlei — Guia de Deploy

Siga os passos abaixo para colocar o site no ar em ~15 minutos.
Tudo gratuito.

---

## PASSO 1 — Criar banco de dados no Supabase (5 min)

1. Acesse https://supabase.com e crie uma conta gratuita
2. Clique em **New Project**
   - Nome: `cb-training`
   - Senha: crie uma senha forte (guarde ela)
   - Região: escolha `South America (São Paulo)`
3. Aguarde o projeto criar (~1 min)
4. No menu lateral, clique em **SQL Editor**
5. Clique em **New query**
6. Abra o arquivo `supabase_schema.sql` deste projeto, copie todo o conteúdo e cole no editor
7. Clique em **Run** (ícone de play)
8. Deve aparecer "Success" — as tabelas foram criadas

### Pegando suas chaves do Supabase:
1. No menu lateral, clique em **Project Settings** → **API**
2. Copie:
   - **Project URL** → será o `VITE_SUPABASE_URL`
   - **anon public** (em Project API keys) → será o `VITE_SUPABASE_ANON_KEY`

---

## PASSO 2 — Subir o código no GitHub (5 min)

1. Acesse https://github.com e crie uma conta (se não tiver)
2. Clique em **New repository**
   - Nome: `cb-training-futevolei`
   - Deixe como **Public**
   - Clique em **Create repository**
3. Na página do repositório, clique em **uploading an existing file**
4. Arraste todos os arquivos desta pasta para o GitHub
   - Suba a pasta `src/` completa (App.jsx, main.jsx, supabase.js)
   - Suba `package.json`, `vite.config.js`, `index.html`
   - Suba a pasta `public/` com o favicon
   - **NÃO suba** o arquivo `.env` (se criou um)
5. Clique em **Commit changes**

---

## PASSO 3 — Deploy na Vercel (3 min)

1. Acesse https://vercel.com e crie uma conta com seu GitHub
2. Clique em **Add New → Project**
3. Selecione o repositório `cb-training-futevolei`
4. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` → cole a Project URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` → cole a chave anon do Supabase
5. Clique em **Deploy**
6. Aguarde ~1 min — o site vai estar no ar!

A Vercel vai te dar um link tipo:
`https://cb-training-futevolei.vercel.app`

---

## PASSO 4 — (Opcional) Domínio personalizado

Se quiser um endereço como `cbtraining.com.br`:
1. Compre o domínio em registro.br (~R$40/ano)
2. Na Vercel, vá em **Settings → Domains**
3. Adicione seu domínio e siga as instruções de DNS

---

## Como compartilhar

Basta enviar o link da Vercel para seus alunos.
- Qualquer pessoa com o link pode **ver o ranking**
- Você registra partidas e sorteios pelo mesmo link
- Tudo atualiza em tempo real para todo mundo

---

## Dúvidas comuns

**Os dados somem se eu fechar o app?**
Não. Agora os dados ficam no Supabase (nuvem), não no celular.

**Meus alunos podem editar o ranking?**
Por enquanto o app não tem login — qualquer pessoa com o link pode registrar partidas. Se quiser proteger com senha, me avise.

**É realmente gratuito?**
Sim. Supabase free tier suporta até 500MB de dados e 50.000 requests/mês — mais que suficiente para a escolinha.
