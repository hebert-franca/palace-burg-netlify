# Palace Burg — versão para Netlify + Supabase

Esta versão **não usa Render, Python, SQLite nem Uvicorn**. O site e as 43 fotos são arquivos estáticos; as rotas `/api/*` são atendidas por **Netlify Functions**; produtos, usuários e pedidos ficam em **Supabase PostgreSQL**.

## Estrutura

```
public/
  index.html              -> delivery principal
  delivery.html           -> cliente
  atendente.html          -> PDV + pedidos
  admin.html              -> cadastrar produtos e usuários
  motoboy.html            -> entregas individuais
  pedidos.html            -> página de pedidos
  app.js / style.css / logo-palace-burg.webp
  menu-images/            -> 43 fotos do cardápio
netlify/functions/
  api.mjs                 -> API serverless, autenticação, rotas, pagamentos marcados, catálogo
  catalog.mjs             -> 43 produtos do PDF
schema.sql                 -> estrutura do banco (executar no Supabase)
netlify.toml              -> publicação e rota das funções
```

## Passo a passo de publicação (GitHub -> Netlify)

1. **Crie um repositório novo no GitHub**, por exemplo `palace-burg-netlify`. É mais seguro do que misturar com a versão para Render. Extraia o ZIP e envie todos os arquivos e a pasta `netlify/` **preservando a estrutura**. Não crie branch chamada `menu-images`; ela tem de ser **pasta** dentro de `public/`.
2. Acesse https://supabase.com/dashboard, crie um projeto e abra **SQL Editor -> New query**. Cole o conteúdo de `schema.sql` e clique em **Run**. Este passo é obrigatório antes do primeiro pedido.
3. No Supabase, vá a **Project Settings -> API Keys** e obtenha a URL do projeto e a chave **service_role** (ou equivalente secreto para acesso server-side). **NUNCA coloque a chave no GitHub ou em arquivos da pasta `public/`.**
4. Acesse https://app.netlify.com/ -> **Add new project -> Import an existing project**, selecione o novo repositório GitHub.
5. Configurações: **Base directory** vazio; **Build command** vazio; **Publish directory** `public`; **Functions directory** `netlify/functions` (já indicados em `netlify.toml`). Deploy.
6. No site Netlify em **Project configuration / Environment variables**, configure as variáveis abaixo, com disponibilidade para **Functions**. Depois acione **Trigger deploy / Deploy project**.

| Variável | Finalidade |
|---|---|
| `SUPABASE_URL` | `https://...supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta do Supabase; somente ambiente Functions |
| `PALACE_ADMIN_EMAIL` | Seu e-mail de administrador, em minúsculas |
| `PALACE_ADMIN_PASSWORD` | Senha forte de **pelo menos 12 caracteres** |
| `PALACE_SESSION_SECRET` | Segredo aleatório de **pelo menos 32 caracteres**; alteração invalida sessões |
| `MAPBOX_TOKEN` | Token Mapbox para geocodificação e distância por rota |

7. Primeiro login no `/admin.html` com `PALACE_ADMIN_EMAIL` e `PALACE_ADMIN_PASSWORD` cria o administrador no banco, **somente se não houver outro administrador**. Se já houver um usuário com aquele e-mail, as credenciais do banco prevalecem.
8. No painel administrativo, use **Conferir importação do PDF -> Confirmar importação** para carregar os 43 itens com fotos. Não duplica produtos com nomes idênticos; atualiza preços/descrições dos existentes.
9. Cadastre atendentes/motoboys pelo painel. Teste `/delivery.html`, `/atendente.html`, `/motoboy.html` e o cálculo de frete. A raiz `/` abre o delivery.

### Atalhos do projeto (substitua SEU-SITE)

- Delivery: `https://SEU-SITE.netlify.app/delivery.html`
- Administração: `https://SEU-SITE.netlify.app/admin.html`
- Atendente: `https://SEU-SITE.netlify.app/atendente.html`
- Motoboy: `https://SEU-SITE.netlify.app/motoboy.html`
- Verificação API: `https://SEU-SITE.netlify.app/api/health`

## Limitações e segurança

- O serviço **não migra automaticamente pedidos e usuários do banco SQLite do Render**. Os dados antigos precisam de migração específica; exporte-os antes de desligar Render.
- A seleção Pix/Dinheiro/Crédito/Débito é **registro de forma de pagamento**, não cobrança eletrônica real. Não há PIX QR dinâmico ou gateway de cartão integrado.
- Frete: R$ 2/km de rota de carro desde Passagem São Mateus, 19B, Benguí, Belém-PA. Requer Mapbox funcional, sujeito a cotas e cobrança do provedor.
- Autenticação: senha criptografada via `scrypt` e token assinado com prazo de 8h. As verificações de permissão são feitas nas Functions. Para operação comercial, implemente também limitação de tentativas de login, auditoria, backup, LGPD e monitoramento antes da abertura ao público.
- Supabase e Netlify têm planos gratuitos com **limites e condições próprios**; revise os limites vigentes antes de utilizar comercialmente.
- O catálogo/fotos já estão no ZIP; **não** altere `menu-images` para arquivo, e não envie somente `public` sem `netlify/`.
- A função `pb_place_order` no SQL é uma transação única para pedido + itens, com validação dos preços no banco. Guarde e não divulgue a chave `SUPABASE_SERVICE_ROLE_KEY`.
