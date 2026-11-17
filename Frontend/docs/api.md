# API do Balaio

O frontend consome **somente o `api-gateway`** da plataforma. Não existe mais Fake API,
dados simulados nem destino alternativo: se o gateway estiver fora do ar, o navegador
recebe `502 API_INDISPONIVEL`. Consulte [autenticação e execução local](auth-local.md).

- **URL no navegador:** `/api/v1`, na mesma origem do Next. O Route Handler
  `src/app/api/v1/[...caminho]/route.ts` encaminha toda requisição ao gateway.
- **URL no servidor (SSR):** `API_GATEWAY_URL` (padrão `http://127.0.0.1:8080/api/v1`).
- **Formato:** JSON
- **Acesso no frontend:** todas as chamadas passam por `src/services/api/`

---

## Formato das respostas

Toda resposta segue o mesmo envelope:

```json
{ "dados": { }, "erro": null, "paginacao": { "pagina": 1, "tamanho": 9, "total": 24, "totalPaginas": 3 } }
```

`paginacao` só aparece em listagens paginadas. Em caso de erro:

```json
{ "dados": null, "erro": { "codigo": "NAO_AUTENTICADO", "mensagem": "Entre na sua conta para continuar." } }
```

| Status | Código | Quando |
|---|---|---|
| 400 | `REQUISICAO_INVALIDA` | Dados inválidos |
| 401 | `NAO_AUTENTICADO` / `CREDENCIAIS_INVALIDAS` | Sem sessão / e-mail ou senha errados |
| 403 | `SEM_PERMISSAO` | Papel ou dono do recurso não confere |
| 404 | `RECURSO_NAO_ENCONTRADO` | Recurso inexistente |
| 409 | `EMAIL_EM_USO` e outros | Conflito de estado |
| 502 | `API_INDISPONIVEL` | Gateway fora do ar (gerado pelo Route Handler do Next) |

---

## Autenticação

- `POST /auth/login` e alias `/auth/entrar` usam a senha bcrypt persistida no profile e
  emitem JWT RS256 no cookie **`balaio_sessao`** (HttpOnly, SameSite=Lax, 60 minutos;
  Secure em HTTPS). Cadastro também emite o cookie. JWT não vai no JSON.
- O Route Handler regrava o cookie de sessão devolvido pelo gateway com `Path=/`, para
  que o SSR das páginas protegidas receba a sessão.
- Em cada requisição, o Route Handler converte o cookie `balaio_sessao` em
  `Authorization: Bearer`; um `Authorization` explícito tem prioridade. O gateway valida
  o token e encaminha o Bearer aos serviços.
- `GET /usuario` revalida no profile e devolve a conta atual; no navegador a consulta
  restaura a sessão após reload.
- **Papéis:** `comprador`, `artesao` e `admin`. O cadastro público só cria comprador ou
  artesão.

### Regras do Route Handler

- Rejeita caminhos ambíguos (`%2f`, `%5c`, `%2e`, barras duplas) e query com parâmetro
  começando com `_`, sem chamar o gateway.
- As rotas `/auth/*` só aceitam `POST`.
- Escrita autenticada por cookie exige `Origin` presente em `AUTH_ALLOWED_ORIGINS`;
  Bearer puro segue a validação do gateway.
- Limite de corpo: 64 KB no JSON das rotas do community e 100 MB no upload de vídeo.

**Acesso** nas tabelas abaixo: 🌐 público · 🔑 logado · 🧑‍🎨 artesão · 🛡️ admin.
A checagem de papel é feita no backend.

---

## Rotas

Todas com o prefixo `/api/v1`.

### Autenticação e conta

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/auth/cadastro` | 🌐 | Cria a conta `{ nome, email, senha, perfil }` e já faz login |
| POST | `/auth/login` | 🌐 | `{ email, senha }` |
| POST | `/auth/logout` | 🌐 | Encerra a sessão |
| POST | `/auth/recuperacao` | 🌐 | `{ email }`: solicita link, sempre `201` e `{ dados: { recebida: true }, erro: null }` para endereço válido, cadastrado ou não |
| POST | `/auth/redefinicao` | 🌐 | `{ token, novaSenha }`: redefine senha com link de uso único; `200` ou `400 TOKEN_INVALIDO` |
| GET / PATCH | `/usuario` | 🔑 | Consulta ou altera o usuário logado |
| POST | `/conta/:id/senha` | 🔑 | `{ senhaAtual, novaSenha }` |
| GET / POST / PATCH / DELETE | `/usuario/enderecos` | 🔑 | Endereços de entrega |

### Catálogo

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/pecas` | 🌐 | Busca e filtros: `q`, `tecnica`, `territorio`, `categoria`, `tipo`, `disponibilidade`, `desconto`, `ordenar`, `pagina`, `tamanho` |
| GET | `/pecas/:slug` | 🌐 | Detalhe da peça |
| GET | `/pecas/:slug/relacionadas` | 🌐 | Peças da mesma técnica (recomendação simples) |
| GET / POST | `/pecas/:slug/perguntas` | 🌐 / 🔑 | Perguntas públicas da peça |
| GET | `/artesaos`, `/artesaos/:slug`, `/artesaos/:slug/pecas` | 🌐 | Artesãos e suas peças |
| GET | `/coletivos`, `/coletivos/:slug` | 🌐 | Coletivos |
| GET | `/referencias` | 🌐 | Técnicas, territórios, categorias e tipos para os filtros |

### Sacola e coleções

Visitantes guardam sacola, favoritos, histórico de busca e vídeos curtidos e salvos só
em `localStorage`. Ao entrar, o frontend mescla os itens locais com os da conta pelo
gateway (sacola no commerce, demais coleções no community) e só remove a cópia local
após a confirmação do PUT. Não há reserva antes do checkout.
Se a mesclagem encontrar uma peça indisponível, a página mantém os itens visíveis para o comprador retirar o item e tentar novamente; falha de rede permite repetir sem descartar a cópia local. Se o navegador bloquear o armazenamento, a sacola visitante continua em memória e exibe aviso de que não persistirá após fechar a página. Essa cópia atravessa o login por navegação cliente e só é descartada após o PUT de mesclagem confirmar; nenhuma sacola privada de outra conta é transportada. Depois de registrar o pedido, a navegação ao pagamento aguarda a confirmação do PUT que limpa a sacola remota; uma falha oferece nova tentativa sem criar outro pedido.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/estado/sacola` | 🔑 | `{dados:[{slug,quantidade}],erro:null}` da conta autenticada (commerce) |
| PUT | `/estado/sacola` | 🔑 | `{ sacola: [{ slug, quantidade }] }`, substituição completa no commerce |
| GET / PUT | `/estado/{colecao}` | 🔑 | `favoritos`, `historicoBusca`, `videosCurtidos` ou `videosSalvos` da conta (community); o PUT recebe `{ <colecao>: ["..."] }` |

O endpoint de domínio da sacola é `/estado/sacola`; não existe rota `/sacola`. O commerce persiste somente slug e quantidade por `sub` do JWT, valida a peça no catálogo e volta a cotar no checkout. Hoje o commerce ainda não implementa essa rota (veja [Pendências no backend](#pendências-no-backend)).

### Pedidos

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/fretes` | 🌐 | Opções de entrega |
| POST | `/checkout` | 🔑 | Cria pedido, reserva e preferência Checkout Pro de teste; retorna URL sandbox quando pronta |
| GET | `/pedidos`, `/pedidos/:id` | 🔑 | Pedidos do usuário logado |
| PATCH | `/pedidos/:id/cancelar` | 🔑 | Solicita cancelamento ou reembolso; resultado depende de confirmação do provedor |
| GET / POST | `/pedidos/:id/conversa` | 🔑 | Mensagens entre comprador e artesão |
| POST | `/pedidos/:id/avaliacao` | 🔑 | `{ nota, comentario }`, só depois da entrega |

Estados financeiros incluem `aguardando_pagamento`, `confirmacao_pendente`, `cancelamento_pendente`, `reembolso_pendente`, `falha_pagamento` e `reembolsado`. O navegador consulta `GET /pedidos/:id` depois do retorno do Checkout Pro; parâmetros do redirect não confirmam pagamento.

### Painel do artesão

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET / PATCH | `/artesao/me` | 🧑‍🎨 | Dados do ateliê |
| GET | `/artesao/vendas` | 🧑‍🎨 | Faturamento do gráfico do painel |
| POST | `/pecas` | 🧑‍🎨 | Cadastra peça (até 5 fotos) |
| PATCH / DELETE | `/pecas/:slug` | 🧑‍🎨 | Edita, publica, inativa ou apaga a própria peça |
| GET | `/artesao/pedidos-pendentes` | 🧑‍🎨 | Pedidos aguardando aceite |
| PATCH | `/pedidos/:id/estado` | 🧑‍🎨 | Avança o pedido (produção, envio, entrega) |
| PATCH | `/pedidos/:id/recusar` | 🧑‍🎨 | `{ motivo }` |
| GET / POST | `/artesao/selo` | 🧑‍🎨 | Consulta ou pede o selo de verificado |

No `catalog-service` real, `POST /pecas`, `PATCH /pecas/:slug` e `DELETE /pecas/:slug` exigem Bearer JWT de artesão e usam o UUID autenticado para determinar a titularidade. O slug público provisório vem de `GET /artesao/me` do profile-service (`artesao-<UUID>`). `POST` retorna 201, `PATCH` retorna 200 e `DELETE` retorna 204 sem corpo. Erro de validação pode trazer `erro.campo` além de `codigo` e `mensagem`; o formulário destaca `nome`, `preco` e `prazoProducaoDias`. Fotos novas são data URIs JPG/PNG/WebP de até 5 MB, persistidas no catálogo e devolvidas com URL pública. O Route Handler envia as escritas e `GET`/`HEAD /arquivos/pecas/:nome` ao Gateway como qualquer outra rota.

O formulário consulta `GET /referencias` no catálogo real. Se as listas não carregarem, ele exibe o erro e bloqueia o cadastro até uma nova tentativa bem sucedida.

### Administração

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/admin/curadoria` | 🛡️ | Pedidos de selo pendentes |
| POST | `/admin/curadoria/:id/decisao` | 🛡️ | `{ decisao: "aprovada" \| "ajuste", motivo }` |
| POST | `/admin/mediacoes` | 🔑 | Comprador abre mediação de um pedido |
| GET / PATCH | `/admin/mediacoes` | 🛡️ | Lista e analisa as mediações |

### Eventos e vídeos

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/eventos?lat=&lng=` | 🌐 | Agenda, ordenada por distância quando há coordenadas |
| POST | `/eventos` | 🌐 | Cria evento |
| GET / POST | `/videos`, `/videos/:id/comentarios` | 🌐 | Vídeos dos ateliês e comentários |
| PATCH / DELETE | `/videos/:id` | 🧑‍🎨 | Edita `{ legenda, etiquetas, peca, situacao }` ou remove um vídeo do próprio ateliê, com seus comentários |

---

## Exemplos

### Recuperação de senha

`POST /api/v1/auth/recuperacao` recebe `{ "email": "ana@exemplo.com" }`. O resultado é igual para conta existente ou ausente. Para conta existente, o e-mail contém `/login/reset?token=...`; o link expira em 1 hora. `POST /api/v1/auth/redefinicao` recebe `{ "token": "...", "novaSenha": "senha-com-8-ou-mais-caracteres" }` e devolve `{ "dados": { "redefinida": true }, "erro": null }`. Token desconhecido, vencido ou usado devolve `400` com `TOKEN_INVALIDO`. E-mail inválido ou senha curta devolve `400 REQUISICAO_INVALIDA`.

O profile-service implementa as duas rotas.

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "ana@exemplo.com", "senha": "<senha com 12 ou mais caracteres>" }
```

```json
{ "dados": { "id": "…", "nome": "Ana …", "email": "ana@exemplo.com", "papel": "comprador" }, "erro": null }
```

### Busca

```http
GET /api/v1/pecas?q=pifano&ordenar=preco-asc&pagina=1&tamanho=9
```

```json
{
  "dados": [
    {
      "slug": "banda-de-pifanos-completa",
      "nome": "Banda de Pífanos Completa",
      "artesao": "dona-bia-do-ipojuca",
      "territorio": "Caruaru",
      "tecnica": "Cerâmica & Barro",
      "preco": 420,
      "desconto": 10,
      "disponibilidade": "encomenda",
      "imagem": "/fotos/banda-pifanos.svg"
    }
  ],
  "erro": null,
  "paginacao": { "pagina": 1, "tamanho": 9, "total": 1, "totalPaginas": 1 }
}
```

### Checkout

```http
POST /api/v1/checkout
Cookie: balaio_sessao=<token>
Idempotency-Key: <uuid gerado pelo cliente e reutilizado até obter checkoutUrl>
Content-Type: application/json

{
  "itens": [{ "slug": "banda-de-pifanos-completa", "quantidade": 1 }],
  "freteId": "padrao",
  "meio": "checkout_pro",
  "endereco": { "cep": "50000-000", "endereco": "Rua da Aurora, 100", "cidade": "Recife", "estado": "PE" }
}
```

```json
{ "dados": { "id": "PE-1758800000000-1a2b3c4d", "total": 416.9, "estado": "confirmado" }, "erro": null }
```

Sem login, a mesma chamada retorna **401** com `NAO_AUTENTICADO`.

---

## Rotas planejadas

| Método | Rota | Para quê |
|---|---|---|
| GET | `/recomendacoes?peca=slug` | Recomendações do módulo de IA na página da peça |
| GET | `/recomendacoes/para-mim` | Recomendações pelo histórico do usuário |
| GET | `/admin/indicadores` | Indicadores do painel administrativo |

## Roteamento no gateway

Definido em `api-gateway/src/main/resources/application.yaml`:

| Serviço | Rotas |
|---|---|
| catalog | `/pecas`, `/referencias`, arquivos de peças, `/artesaos/{slug}/pecas` |
| profile | `/auth/**`, `/usuario/**`, `/conta/**`, `/artesaos`, `/artesao/me`, `/artesao/selo`, `/coletivos`, `/admin/curadoria` |
| commerce | `/checkout`, `/fretes`, `/pedidos`, `/artesao/vendas`, `/artesao/pedidos-pendentes`, `/estado/sacola` |
| community | Perguntas, conversa, avaliação, vídeos, mediações, `/estado/favoritos`, `/estado/videosCurtidos`, `/estado/videosSalvos`, `/estado/historicoBusca` e reputação |
| events | `/eventos` |

## Pendências no backend

Enquanto estes endpoints não existem, as telas correspondentes mostram erro ou estado vazio:

- **events-service:** nenhum endpoint implementado.
- **profile-service:** só implementa `/auth/cadastro`, `/auth/login`, `/auth/entrar`,
  `/auth/logout`, `/auth/recuperacao`, `/auth/redefinicao` e `GET /usuario`. Faltam
  `/artesaos`, `/artesao/me`, `/artesao/selo`, `/coletivos`, `/admin/curadoria`,
  `PATCH /usuario`, endereços e `/conta`.
- **commerce-service:** não implementa `/estado/sacola`.
