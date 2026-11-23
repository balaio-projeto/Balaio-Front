# Matriz de telas e dados de teste (PI-257)

Referência para o roteiro E2E real (PI-259) e para a regressão (PI-258). Cada linha liga papel, tela do Next.js, ação, resultado esperado, serviço dono e card. A coluna **E2E** aponta o teste automatizado em `tests/e2e-real/` que cobre a linha; `manual` indica o que ainda é verificado à mão no roteiro de demonstração (`platform/docs/roteiro-demonstracao.md`).

A matriz de rotas HTTP correspondente (método, caminho, serviço, acesso, tela e card) fica em `api-gateway/docs/matriz-rotas.csv` (PI-249).

Fora da aprovação desta entrega: recomendações por IA (PI-223), indicadores administrativos (PI-224) e matéria-prima.

## Visitante (sem sessão)

| Tela | Ação | Resultado esperado | Serviço | Card | E2E |
| --- | --- | --- | --- | --- | --- |
| `/` | Abrir a vitrine | Destaques e peças publicadas vindas do gateway; nenhuma chamada a Fake API ou porta interna | catalog | PI-29, PI-229 | `visitante.spec.ts` › vitrine |
| `/search?q=` | Buscar texto | Lista só peças publicadas que casam com o termo | catalog | PI-30, PI-179 | `visitante.spec.ts` › busca |
| `/search` (filtros) | Aplicar faixa de preço mínimo/máximo | URL com `precoMin`/`precoMax`; peças fora da faixa somem | catalog | PI-31, PI-180 | `visitante.spec.ts` › busca |
| `/search` (filtros) | Filtrar por técnica, território, categoria e tipo | Opções vêm de `GET /referencias` | catalog | PI-215, PI-231 | manual |
| `/pieces/[slug]` | Abrir peça | Nome, preço, foto servida por `/api/v1/arquivos/pecas/*` (storage S3), botão de sacola | catalog | PI-32, PI-26, PI-175 | `visitante.spec.ts` › página da peça |
| `/pieces/[slug]` | Calcular frete por CEP | Opções de `GET /fretes?cep=&itens=`; CEP inválido mostra erro | commerce | PI-212, PI-232 | `seguranca.spec.ts` › frete (API) |
| `/pieces/[slug]` | Ver perguntas públicas | Perguntas e respostas listadas sem sessão | community | PI-36, PI-185 | manual |
| `/artisans/[slug]`, `/collectives/[slug]` | Abrir perfil público | Dados do perfil, peças e reputação | profile, catalog, community | PI-33, PI-34 | manual |
| `/events` | Abrir agenda | Eventos publicados (3 demo da V4 + aprovados no roteiro) com mapa | events | PI-51, PI-240 | `visitante.spec.ts` › agenda |
| `/events/[slug]` | Abrir evento | Detalhe com local e mapa | events | PI-199, PI-240 | `visitante.spec.ts` › agenda |
| `/videos` | Assistir vídeos | Feed público de vídeos publicados | community | PI-52, PI-238 | manual |
| `/account`, `/orders`, `/dashboard`, `/admin` | Abrir sem sessão | Redireciona para `/login?proximo=`; API responde 401 | gateway | PI-169, PI-228 | `seguranca.spec.ts` › 401 |

## Comprador

| Tela | Ação | Resultado esperado | Serviço | Card | E2E |
| --- | --- | --- | --- | --- | --- |
| `/login/register` | Criar conta de comprador | Cookie `balaio_sessao` HttpOnly; vai para `/account` | profile | PI-19, PI-225 | `comprador.spec.ts` › cadastro |
| `/account` → `/login` | Sair e entrar de novo | Logout limpa o cookie; login volta para `/account` | profile | PI-168, PI-225 | `comprador.spec.ts` › cadastro |
| `/login/recover`, `/login/reset` | Recuperar senha | E-mail no Mailpit/SMTP local; nova senha funciona | profile | PI-21, PI-170 | manual |
| `/account/details` | Editar nome/e-mail, trocar senha | `PATCH /usuario`, `POST /auth/alterar-senha` | profile | PI-209, PI-226 | manual |
| `/account/addresses` | Adicionar endereço digitando o CEP | ViaCEP preenche rua, bairro, cidade e UF; endereço persiste após recarregar | profile | PI-40, PI-189, PI-226 | `comprador.spec.ts` › endereço |
| `/pieces/[slug]` → `/cart` | Adicionar à sacola e revisar | Sacola no servidor (`/estado/sacola`), revalidação de preço/disponibilidade | commerce | PI-38, PI-39, PI-187, PI-188 | `comprador.spec.ts` › checkout |
| `/checkout` | Escolher endereço salvo, cotar frete e confirmar | Sem credenciais do Mercado Pago: `503 PAGAMENTO_INDISPONIVEL` exibido na tela e nenhum pedido criado. Com credenciais sandbox: redireciona para `sandbox.mercadopago.com` | commerce | PI-41, PI-54, PI-233, PI-40 | `comprador.spec.ts` › checkout |
| `/orders` | Listar pedidos | Somente os pedidos da própria conta | commerce | PI-44, PI-192 | `seguranca.spec.ts` › isolamento |
| `/orders/[id]` | Acompanhar pedido enviado/entregue | Linha do tempo, código de rastreio e transportadora | commerce | PI-234, PI-191 | `comprador.spec.ts` › pedido entregue |
| `/orders/[id]` | Conversar com o artesão | Mensagens do pedido; outra conta recebe 403/404 | community | PI-222, PI-234 | `seguranca.spec.ts` › isolamento (API) |
| `/orders/[id]` | Cancelar antes da produção | Pedido cancelado e reserva liberada | commerce | PI-45, PI-236 | manual |
| `/orders/[id]/review` | Avaliar pedido entregue | Nota e comentário gravados; botão "Avaliar compra" some | community | PI-46, PI-236 | `comprador.spec.ts` › pedido entregue |
| `/orders/[id]/mediation` | Abrir mediação | `POST /admin/mediacoes` aceito para o comprador do pedido | community | PI-47, PI-239 | manual |
| `/favorites` | Favoritar e listar | Favorito persiste; peça vendida aparece indisponível | community | PI-37, PI-237 | manual |

## Artesão

| Tela | Ação | Resultado esperado | Serviço | Card | E2E |
| --- | --- | --- | --- | --- | --- |
| `/login/register` | Criar conta de artesão | Vai para `/dashboard` | profile | PI-18 | `artesao.spec.ts` (login) |
| `/dashboard/pieces/new` | Cadastrar peça com foto | Foto gravada no storage S3 e servida por `/api/v1/arquivos/pecas/*`; peça aparece em "Minhas peças" | catalog | PI-24, PI-26, PI-175, PI-230 | `artesao.spec.ts` › cadastra peça |
| `/dashboard/pieces` | Inativar e reativar | Inativada some do público (404); reativada volta (200) | catalog | PI-27, PI-230 | `artesao.spec.ts` › inativa e reativa |
| `/dashboard/pieces/[slug]` | Editar peça e disponibilidade | `PATCH /pecas/{slug}`; outro artesão recebe 403/404 | catalog | PI-27, PI-48 | `seguranca.spec.ts` › isolamento (API) |
| `/dashboard` | Aceitar pedido pago | Pedido vai para produção | commerce | PI-43, PI-191 | `artesao.spec.ts` › aceita |
| `/dashboard` | Marcar enviado com rastreio e depois entregue | Estados `enviado` (com código) e `entregue`; comprador vê o rastreio | commerce | PI-43, PI-191, PI-234 | `artesao.spec.ts` › aceita |
| `/dashboard` | Ver resumo do painel | `GET /artesao/painel/resumo` com peças ativas, avisos e faturamento | commerce | PI-50, PI-248 | `artesao.spec.ts` › relatório |
| `/dashboard/sales` | Relatório por período | `GET /artesao/vendas/relatorio?periodo=` com receita, ticket médio e ranking | commerce | PI-49, PI-197, PI-246 | `artesao.spec.ts` › relatório |
| `/dashboard/messages` | Central de conversas | Conversas dos próprios pedidos | community | PI-222 | manual |
| `/dashboard/settings` | Perfil do ateliê, foto e pedido de selo | Foto no storage; selo vai para a fila do admin | profile | PI-22, PI-23, PI-214, PI-227 | `admin.spec.ts` › selo (pedido via API) |
| `/dashboard/videos` | Publicar vídeo | Rascunho, upload e publicação | community | PI-52, PI-238 | manual |

## Organizador

| Tela | Ação | Resultado esperado | Serviço | Card | E2E |
| --- | --- | --- | --- | --- | --- |
| (admin) `PATCH /admin/contas/{id}/papel` | Promover conta a organizador | 204; novo login traz o papel `organizador` | profile | PI-210 | dataset (`preparar-dados.ts`) |
| `/events/new` | Submeter evento com participantes e ponto no mapa | `201`, tela "Evento enviado!"; evento entra `PENDENTE` na fila do admin | events | PI-205, PI-241 | `organizador.spec.ts` › submete |
| `/events/new` | Enviar formulário vazio | Erros por campo, sem chamar a API | events | PI-241 | `organizador.spec.ts` › formulário vazio |
| `POST /eventos` como comprador, artesão ou admin | — | 403 `SEM_PERMISSAO` | gateway, events | PI-210 | `seguranca.spec.ts` › 403 |

## Admin

| Tela | Ação | Resultado esperado | Serviço | Card | E2E |
| --- | --- | --- | --- | --- | --- |
| `/login` | Entrar com o admin de QA | Vai para `/admin` | profile | PI-20 | `admin.spec.ts` (login) |
| `/admin/events` | Ver fila de eventos pendentes | Evento do dataset na fila | events | PI-206, PI-242 | `admin.spec.ts` › fila |
| `/admin/events` | Aprovar e publicar evento | `POST /admin/eventos/{slug}/decisao` 200; evento aparece em `/events` | events | PI-205, PI-206, PI-242 | `admin.spec.ts` › aprova |
| `/admin` | Conceder selo na curadoria | Selo concedido; estado do artesão muda | profile | PI-28, PI-177 | `admin.spec.ts` › selo |
| `/admin/criteria` | Ler critérios de curadoria | Página estática de referência | front | PI-28 | manual |
| `/admin/mediations` | Analisar e decidir mediação | Decisão registrada; commerce aplica reembolso/entrega | community, commerce | PI-47, PI-195 | manual |

## Dados de teste reproduzíveis

O dataset fica versionado em `tests/e2e-real/dados/`:

- `dataset.ts`: contas `@teste.local` (artesão, comprador, comprador concorrente, organizador), três peças (pronta entrega, peça única e sob encomenda, todas com foto), endereço salvo do comprador, dois pedidos pagos (um entregue com rastreio, um confirmado aguardando o artesão) e um evento pendente de moderação. A senha das contas de teste é um valor fixo de teste local, sem uso fora da pilha local.
- `foto-peca.png`: foto usada no cadastro de peça pela tela.
- `preparar-dados.ts`: cria ou reaproveita tudo pela API do gateway (`http://localhost:8080`). É idempotente: procura cada item antes de criar, e o evento pendente aceita 409 como "já existe". Grava os ids em `test-results/e2e-real/dados.json`, lido pelos specs.

O admin não é criado pelo dataset. Ele vem do bootstrap do profile-service (`ADMIN_EMAIL` e `ADMIN_SENHA_INICIAL` no `platform/.env`, não versionado). Como o bootstrap cria o admin com troca de senha obrigatória, o script lê também `QA_ADMIN_SENHA` do mesmo arquivo: entra com ela e, se ainda não existir, entra com a senha inicial e faz a troca. As variáveis `QA_ADMIN_EMAIL`/`QA_ADMIN_SENHA` (ou `BALAIO_PLATFORM_ENV` apontando para outro `.env`) substituem a leitura do arquivo.

### Pedidos pagos sem Mercado Pago

Sem credenciais sandbox, `POST /checkout` responde `503 PAGAMENTO_INDISPONIVEL` antes de reservar ou criar pedido. Para ter pedidos pagos, o script e os specs inserem o pedido direto no banco do commerce, simulando o efeito do webhook aprovado:

```
docker exec -i balaio-local-commerce-db-1 sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

A função `inserirPedidoPago` (`tests/e2e-real/apoio/pilha.ts`) cria o pedido em `aguardando_pagamento` e percorre `confirmacao_pendente → confirmado → producao → enviado → entregue` até o estado pedido. Assim os triggers do commerce registram a linha do tempo (`pedido_etapas`) e a fila de e-mails (`pedido_emails`) como no fluxo real. O artesão do pedido é o id da conta do artesão, e o item aponta para uma peça existente no catálogo.

### Como rodar

```
cd Balaio-Front/Frontend
npm run dados:e2e:real     # só prepara os dados
npm run test:e2e:real      # prepara os dados e roda os specs de tests/e2e-real
```

Pré-requisitos: pilha local saudável (`pwsh -NoProfile -File platform/scripts/start-local.ps1`), Google Chrome instalado (os specs usam `channel: 'chrome'`), Docker acessível para o `docker exec` e internet para o ViaCEP.
