# Pulso — vídeos animados de 15, 20 ou 30 s para empresas

O cliente preenche os dados da empresa, a IA escreve o roteiro e ele assiste à prévia animada, com música, na hora. Quando gostar, paga por vídeo e o servidor gera o MP4 final em alta, sem a marca "PRÉVIA".

- **Três idiomas:** português (`/`), inglês (`/en`) e espanhol (`/es`): site, editor, roteiro da IA e os textos dentro do vídeo.
- **Duas moedas:** em português cobra em **reais** pelo Mercado Pago (Pix e cartão); em inglês e espanhol cobra em **dólar** pelo Stripe (cartão, Apple Pay, Google Pay).
- **Sem versão grátis:** a prévia é só para ver (marca "PRÉVIA", resolução reduzida). O arquivo em alta só sai do servidor depois do pagamento confirmado.
- **Preço por vídeo**, sem assinatura (padrão R$ 29,90 / R$ 34,90 / R$ 44,90 e US$ 9.90 / US$ 12.90 / US$ 16.90 para 15 / 20 / 30 s). Inclui 1 correção de texto grátis.
- **Três durações:**
  - **15 s:** oito cenas rápidas (gancho, problema, busca, revelação, vantagens, prova, contato, marca).
  - **20 s:** as mesmas cenas, com mais tempo para ler e trilha mais calma.
  - **30 s:** as oito cenas e mais quatro, ligadas no compasso da música:
    - até 3 fotos ou prints do cliente (cardápio, site, app, Instagram), quebrados em peças que se montam, com zoom e um toque na parte principal;
    - um passo a passo de 3 etapas com ícones que se desenham;
    - um depoimento real (sem depoimento, a oferta ou a principal vantagem);
    - uma frase final grande, no estilo Apple.

    A trilha acompanha: a batida recua no depoimento e volta com uma subida antes do contato.
- **Storyboard no editor:** uma miniatura por cena, tirada do próprio vídeo; tocar numa cena leva até ela.
- **Duas animações:**
  - **Dinâmico:** cortes rápidos, brilho e impacto (promoções, comida).
  - **Premium:** estilo "filme de produto" da Apple. As palavras pousam uma a uma na batida (desfoque → nítido), as cenas se ligam por movimentos mágicos (o campo de busca vira a etiqueta da marca, o último ícone vira o cartão da prova), a câmera respira sem tremer, um cursor clica de verdade e os efeitos sonoros são poucos e baixos. Sem brilhos, partículas nem flashes.
- **A marca do cliente manda:**
  - as cores saem do próprio logo (automático, com opção de trocar);
  - cada conta tem "minha marca" salva (logo, cores, estilo, contatos), então o próximo vídeo já começa igual.
- **Vídeo final:** MP4 H.264 + AAC, 1080×1920, 60 fps, 15, 20 ou 30 s, trilha original gerada pelo próprio Pulso. Cada arquivo passa por uma conferência automática antes de ser entregue: duração, vídeo e áudio, e um quadro do MP4 é decodificado e comparado com o que foi desenhado (pega cor errada e quadro fora de ordem). Vem com uma **capa JPG** em 1080×1920 para o Reels. Fica 30 dias em "Meus vídeos".
- **Painel `/admin`:**
  - vendas em reais e em dólar, pedidos e alertas;
  - refazer vídeo, reembolso (inclusive de cobrança em dobro), link de nova senha e backup do banco.
- **Zero dependências npm:** Node 22 puro (`node:http`, `node:sqlite`). No servidor, o Chromium desenha os quadros e o ffmpeg monta o MP4.

---

## O que só você pode fazer (contas no seu nome)

| # | O quê | Onde | Para quê |
|---|-------|------|----------|
| 1 | Conta e aplicação no **Mercado Pago** (de preferência na conta da empresa) | [mercadopago.com.br/developers/panel/app](https://www.mercadopago.com.br/developers/panel/app) | receber Pix e cartão em reais |
| 2 | Conta no **Stripe** da empresa | [dashboard.stripe.com/register](https://dashboard.stripe.com/register) | receber em dólar (EN/ES) |
| 3 | Chave da **Anthropic** (pode ser a do Fluxo) | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) | roteiro com IA |
| 4 | Conta no **Railway**, plano Hobby | [railway.com](https://railway.com) | hospedar o site 24 h |
| 5 | Repositório **privado** no GitHub (já criado: `rubbo170-lab/pulse`, com o código) | [github.com/rubbo170-lab/pulse](https://github.com/rubbo170-lab/pulse) | o Railway publica a partir dele |
| 6 | Registros **DNS** do subdomínio | onde o DNS de mgrservicosdigitais.com.br é gerenciado (Registro.br ou outro) | `pulso.mgrservicosdigitais.com.br` |

Nenhuma delas exige código: é só copiar as chaves para as variáveis do Railway.

---

## Publicar no Railway (passo a passo)

1. **Novo projeto:** no Railway, *New Project* → *Deploy from GitHub repo* → escolha `pulse`. Ele encontra o `Dockerfile` e o `railway.json` sozinho.
2. **Disco permanente:** no serviço, adicione um **Volume** com *mount path* `/data`. É onde ficam o banco, as imagens, as marcas salvas e os vídeos. Sem isso, tudo some a cada nova publicação.
3. **Endereço provisório:** *Settings* → *Networking* → *Generate Domain* (porta 3000). Copie o endereço `…up.railway.app`.
4. **Variáveis:** em *Variables*, cadastre as do arquivo `.env.example`. O mínimo para vender:
   - `APP_URL`: o endereço do passo 3 (depois você troca pelo domínio)
   - `ADMIN_EMAILS` e `ADMIN_TOKEN`: seu e-mail e um código secreto longo que você inventa
   - `MP_ACCESS_TOKEN`: Access Token **de produção** do Mercado Pago (começa com `APP_USR-`)
   - `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`: veja a seção do Stripe
   - `ANTHROPIC_API_KEY`
   - `COMPANY_NAME`, `COMPANY_DOC` (CNPJ), `SUPPORT_EMAIL`, `SUPPORT_WHATSAPP`: aparecem no rodapé, nos Termos e no botão de suporte
5. **Entrar no painel:** abra o site, crie sua conta com o e-mail de `ADMIN_EMAILS` e entre em `/admin`. Na primeira vez ele pede o `ADMIN_TOKEN`. Assim ninguém vira admin só por criar antes uma conta com o seu e-mail. Os selos no topo mostram o que está ligado: reais, dólar, avisos assinados e IA.
6. **Compra de verdade (recomendado):**
   - Mude `PRICE_BRL` para `1.00` e compre um vídeo com Pix.
   - Veja o vídeo ficar pronto e devolva o valor em `/admin` → pedido → *Reembolsar o pedido*.
   - Volte o preço para `29.90`.
   - Faça o mesmo em `/en` com o Stripe, primeiro com as chaves de teste (`sk_test_…`) e o cartão 4242 4242 4242 4242.

> Mantenha **1 réplica** do serviço: o banco é um arquivo SQLite no volume e a fila de render é do próprio processo.

### Domínio `pulso.mgrservicosdigitais.com.br`

1. No Railway, abra *Settings* → *Networking* → *Custom Domain* e informe `pulso.mgrservicosdigitais.com.br` (porta 3000). Ele mostra **dois registros**, um `CNAME` e um `TXT`, e os dois são obrigatórios.
2. No painel do DNS do domínio (no Registro.br: domínio → *DNS* → editar zona), crie:
   - o `CNAME` com nome `pulso`, apontando para o valor que o Railway mostrou (algo como `xxxx.up.railway.app`);
   - o `TXT` exatamente com o nome e o valor que o Railway mostrou.
3. Espere a propagação (de minutos a algumas horas). O Railway emite o HTTPS sozinho.
4. Troque `APP_URL` para `https://pulso.mgrservicosdigitais.com.br` e publique de novo. O endereço provisório passa a redirecionar para o domínio.

---

## Mercado Pago (reais)

- **Credenciais:** *Suas integrações* → sua aplicação (produto Checkout Pro) → *Credenciais de produção* → **Access Token**. O Mercado Pago pode pedir alguns dados do negócio para ativar as credenciais de produção.
- **Como o pagamento é confirmado:** o Pulso nunca confia no navegador. Ele consulta o pagamento direto na API do Mercado Pago (valor, moeda, referência do pedido e se é de produção) quando:
  - o cliente volta do checkout;
  - chega o aviso automático (webhook);
  - a página do pedido está aberta;
  - roda a conferência a cada 3 minutos para pagamentos recentes.
- **Aviso automático (webhook):** já vai configurado em cada pagamento quando `APP_URL` é `https://`. Para mais segurança:
  - em *Webhooks*, cadastre `https://pulso.mgrservicosdigitais.com.br/api/webhooks/mercadopago` (evento *Pagamentos*);
  - copie a *assinatura secreta* para `MP_WEBHOOK_SECRET`;
  - depois ligue `MP_WEBHOOK_REQUIRE_SIGNATURE=1`.
- **Meios aceitos:** Pix e cartão de crédito (à vista). Boleto está desligado porque demora dias para compensar.

## Stripe (dólar)

- **Chaves:** *Developers* → *API keys* → **Secret key** em `STRIPE_SECRET_KEY`. Use primeiro a de teste (`sk_test_…`), depois a de produção (`sk_live_…`).
- **Webhook (obrigatório):** *Developers* → *Webhooks* → *Add endpoint*:
  - URL: `https://pulso.mgrservicosdigitais.com.br/api/webhooks/stripe`
  - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded` e `charge.refunded`
  - Copie o *Signing secret* (`whsec_…`) para `STRIPE_WEBHOOK_SECRET`. Avisos sem essa assinatura são recusados.
- **Como o pagamento é confirmado:** o aviso só dispara a conferência. O Pulso relê a sessão na API do Stripe e só libera se ela estiver paga, em dólar, com o valor certo e do mesmo modo (teste ou produção) da chave.
- **Meios:** o checkout do Stripe mostra os meios ligados no seu painel (*Settings* → *Payment methods*): cartão, Apple Pay, Google Pay, Link.
- **Recebimento:** a conta brasileira do Stripe cobra o cliente em dólar e deposita em reais. Segundo o próprio Stripe, cartões emitidos no Brasil só podem ser cobrados em reais. Por isso a versão em inglês e espanhol avisa: quem tem cartão brasileiro paga com Pix na versão em português. Confira no painel do Stripe as taxas e o prazo de repasse para contas no Brasil.

## IA do roteiro (Anthropic)

- O botão "Escrever roteiro com IA" chama o servidor, que usa `ANTHROPIC_API_KEY` com o modelo `ANTHROPIC_MODEL` (padrão `claude-sonnet-5`), escrevendo no idioma da página. Custa alguns centavos por roteiro.
- Limites contra abuso (ajustáveis): 400 roteiros por dia no site todo, 25 por conta e 6 por visitante sem conta.
- Sem chave, ou se a IA falhar, o site usa um gerador automático por segmento e o cliente segue normalmente.
- O prompt proíbe inventar números, avaliações, preços ou garantias.

---

## Idiomas e endereços

| | Português | Inglês | Espanhol |
|---|---|---|---|
| Início | `/` | `/en` | `/es` |
| Criar | `/criar` | `/en/create` | `/es/crear` |
| Pedido | `/pedido/…` | `/en/order/…` | `/es/pedido/…` |
| Meus vídeos | `/meus-videos` | `/en/my-videos` | `/es/mis-videos` |
| Termos / Privacidade | `/termos`, `/privacidade` | `/en/terms`, `/en/privacy` | `/es/terminos`, `/es/privacidad` |

As páginas em português (`views/`) são o modelo. Inglês e espanhol saem dos dicionários `i18n/en.json` e `i18n/es.json`, que são gerados por `python3 i18n/build.py`. Para conferir se falta tradução, rode `node test/i18n-extract.mjs en` (ou `es`). Termos e Privacidade têm versões próprias por idioma (`views/termos.en.html` etc.).

## Custos para rodar (estimativa)

- **Railway Hobby:** US$ 5/mês, com US$ 5 de uso incluídos. Parado, o site consome pouco. Cada vídeo usa alguns minutos de CPU.
- **Volume:** o plano Hobby permite até 5 GB. Cada vídeo tem de 6 a 20 MB (o de 30 s chega a uns 45 MB) e fica guardado 30 dias. Isso comporta uns 250 vídeos no mês. Se passar disso, mude para o plano Pro ou reduza `VIDEO_RETENTION_DAYS`.
- **Mercado Pago e Stripe:** taxa por venda. **Anthropic:** centavos por roteiro.

## Tempo de geração

Medido aqui com 2 CPUs: de 3 a 5 minutos por vídeo a 60 fps. O Premium é tão rápido quanto o Dinâmico; o de 20 s leva cerca de um terço a mais, e o de 30 s, quase o dobro (de 6 a 10 minutos). Com mais CPUs fica mais rápido, porque o servidor desenha em paralelo em até 4 abas (`RENDER_PAGES`). Os pedidos entram numa fila, e a página do pedido mostra a posição, a porcentagem e o tempo restante.

---

## Operação do dia a dia (`/admin`)

- **Vendas:** hoje, 7 e 30 dias e total, em reais e em dólar; contas novas; tempo médio de render; disco livre; uso da IA.
- **Alertas:** cobrança em dobro, pagamento diferente do esperado, vídeo que falhou 3 vezes, aviso com assinatura inválida e pouco espaço no disco.
- **Pedido:**
  - refazer o vídeo;
  - reembolsar o pedido (devolve pelo Mercado Pago ou Stripe e bloqueia o download);
  - devolver só uma cobrança extra, quando o cliente pagou duas vezes;
  - marcar como pago manualmente (por exemplo, um brinde).
- **Vídeos de demonstração:** só a conta de admin pode gerar vídeos com a empresa fictícia do exemplo do editor (para divulgar o Pulso nas suas redes). Para os clientes, esses dados nunca vão para o vídeo: o pedido é recusado e contatos do exemplo são apagados.
- **Esqueci a senha:** enquanto o site não manda e-mail, o cliente fala com o suporte e você gera em *Clientes* um link de nova senha. O link vale 24 h, funciona uma vez e abre no idioma do cliente.
- **Backup:** "Baixar backup do banco" gera uma cópia do SQLite. Baixe de vez em quando.
- **Nota fiscal:** as vendas precisam de NFS-e emitida pela empresa. Isso não é automático, combine com seu contador.

---

## Rodar no seu computador

Precisa de Node 22.13+, Chromium (ou Chrome) e ffmpeg.

```bash
cp .env.example .env      # ajuste: APP_URL=http://localhost:3000 e DATA_DIR=./data
npm start                 # http://localhost:3000
```

Sem as chaves de pagamento o site funciona e mostra a prévia, mas não cobra. Pelo `/admin`, você consegue marcar um pedido como pago para testar o render.

**Teste completo:** `npm test` usa um navegador de verdade, Mercado Pago, Stripe e Anthropic falsos e o render real. Ele cobre:
- a compra em reais (Pix) e em dólar (Stripe: 20 s Premium em inglês; 30 s com fotos e depoimento em espanhol), com download e capa;
- o vídeo de 30 s: preço, cenas extras, storyboard, fotos guardadas no pedido, duração do MP4 e a trilha em cada parte;
- a correção grátis e a marca salva;
- o painel, os reembolsos e os avisos assinados;
- os três idiomas e as proteções de segurança.

Precisa do Playwright instalado globalmente. Os vídeos de exemplo da página inicial são gerados com `LANG_EX=pt|en|es node test/render-examples.mjs`.

## Estrutura

```
server.js              rotas da API, páginas e rotinas (limpeza, conferência de pagamentos)
lib/config.js          variáveis de ambiente, preços, idiomas e moedas
lib/db.js              banco SQLite (node:sqlite) e migrações
lib/http.js            mini-framework: rotas, JSON, cookies, arquivos com Range/gzip, cabeçalhos de segurança
lib/auth.js            contas (scrypt), sessão por cookie HttpOnly, admin confirmado por código, links de nova senha
lib/spec.js            validação no servidor de tudo que vira vídeo
lib/ai.js              roteiro com IA (Anthropic) em pt/en/es
lib/mercadopago.js     checkout, consulta, reembolso e assinatura do webhook (reais)
lib/stripe.js          checkout, consulta, reembolso e assinatura do webhook (dólar)
lib/orders.js          ciclo do pedido: criação, pagamento, arquivos
lib/brand.js           "minha marca" de cada conta
lib/i18n.js, paths.js  tradução das páginas e endereços por idioma
lib/render/            fila de render: Chrome sem tela (protocolo DevTools por pipe) + ffmpeg + conferência do MP4
views/                 páginas (modelo em português)
public/                CSS, JS e mídia do site
public/js/engine*.js   motor de animação (Dinâmico e Premium) e trilha: o mesmo na prévia e no servidor
i18n/                  dicionários inglês/espanhol e o gerador
test/                  teste de ponta a ponta, serviços falsos e gerador dos vídeos de exemplo
```

## Pontos de atenção

- **Termos de Uso e Política de Privacidade** são um rascunho sensato, mas precisam da revisão de um advogado, com a razão social e o CNPJ corretos (`COMPANY_NAME`, `COMPANY_DOC`). Vendas em dólar para fora do Brasil também merecem uma conversa com o contador (câmbio e tributos).
- **E-mail:** o site ainda não envia e-mails (confirmação de compra, nova senha). Com o domínio, dá para ligar um serviço como o Resend.
- **Escala:** um servidor com SQLite e arquivos no volume aguenta bem o começo. Com muito volume, o próximo passo é guardar os vídeos num armazenamento de objetos (Cloudflare R2/S3) e rodar o render em máquinas separadas.
