# Relatório de entrega — release candidate de 25/11/2026 (PI-221, PI-260)

Execução de 22/11/2026, na pilha local `balaio-local` recompilada com `platform/scripts/start-local.ps1`, a partir das working trees de `develop` (community-service em `main`) com as alterações das frentes de eventos, commerce, catálogo, perfil e QA ainda não commitadas. Nada foi mergeado para `main`.

## 1. Ambiente

- `pwsh -NoProfile -File platform/scripts/start-local.ps1`: build concluído e os 13 containers `healthy` (frontend, api-gateway, catalog, profile, commerce, community, events, cinco PostgreSQL e SeaweedFS).
- Reinício completo (`docker compose ... restart`, sem apagar volumes): todos voltaram `healthy`; a foto de uma peça teve o mesmo SHA-256 antes e depois, o evento demo continuou em `/eventos/{slug}` e o E2E real passou de novo (24/24).
- Admin local de QA: `admin-qa@teste.local`, senha só no `platform/.env` (ignorado pelo Git). Detalhes em `docs/qa/matriz-telas.md`.

## 2. Suítes automatizadas

| Suíte | Como foi executada | Resultado |
| --- | --- | --- |
| api-gateway | `./mvnw -B test` (JDK 25) | 301 testes, 0 falhas |
| catalog-service | `CATALOG_POSTGRES_TEST=true ./mvnw -B test` (inclui `ReservasPostgresTest`, `PecasPostgresConcurrencyTest`, `FiltrosPaginacaoPostgresTest`) | 50 testes, 0 falhas |
| commerce-service | `COMMERCE_POSTGRES_TEST=true ./mvnw -B test` | 52 testes, 0 falhas |
| community-service | `COMMUNITY_POSTGRES_TEST=true COMMUNITY_S3_TEST=true ./mvnw -B test` | 172 testes, 0 falhas |
| events-service | `./mvnw -B test` com PostgreSQL 18 temporário (`SPRING_DATASOURCE_*`) | 83 testes, 0 falhas |
| profile-service | `./mvnw -B test` (Testcontainers) | 739 testes, 0 falhas, 1 ignorado |
| Front: TypeScript | `npx tsc --noEmit -p .` | sem erros |
| Front: ESLint | `npx eslint .` | 0 erros, 1 aviso já existente (`token` sem uso em `pecas.servico.ts`) |
| Front: unitários | 13 scripts `npm run test:*` (auth, media, pi209, curadoria, recovery, session, sacola, orders, community, pi210, filtros, eventos, cep) | 130 testes, 0 falhas |
| Front: E2E com stub | `npx playwright test` (`tests/e2e`, servidor `tests/fixtures/servidores.cjs`) | pendente, ver seção 2.1 |
| Front: E2E real | `npm run test:e2e:real` (`tests/e2e-real`, pilha real) | 24 testes, 0 falhas |

### 2.1 E2E com stub

**Pendente, não bloqueia a entrega.** Esta suíte não roda no CI (o CI do front roda build e testes unitários) e as jornadas que ela cobre também estão no E2E real (24/24). A execução foi interrompida com 11 falhas, sem comparação com a `develop` anterior:

- `auth.spec`: o login de admin, artesão e comprador espera `/account` em todas as rotas privadas, mas agora cada papel volta para a própria área (`/admin`, `/dashboard`, `/checkout`). É efeito da mudança intencional de rotas por papel (PI-216/PI-228). Também falharam atributos do cookie, "Acesso não permitido", expiração em aba ociosa, logout indisponível e o HTML de `/checkout`.
- `pi209.spec`: o link "Meus dados" do menu não foi encontrado.
- `sacola.spec`: o botão "Confirmar compra" fica desabilitado em 2 casos (o checkout agora exige frete cotado pelo CEP e endereço por ViaCEP).

Próximo passo: rodar a mesma suíte na `develop` anterior para separar o que já falhava, alinhar os specs e o stub `tests/fixtures/servidores.cjs` às rotas por papel e ao novo checkout (`/usuario/enderecos`, `/fretes?cep=`), e corrigir o que for regressão.

## 3. E2E real por papel (PI-259)

Specs em `tests/e2e-real/`, configuração `playwright.real.config.ts` (baseURL `http://localhost:4321`, Chrome, um worker). O `global-setup` confere a saúde do gateway e do front e roda o preparador de dados. Os specs também verificam que o navegador não chama Fake API, stub nem portas internas dos serviços.

| Papel | Jornada | Resultado |
| --- | --- | --- |
| Visitante | Vitrine; busca `q=QA` com faixa de preço 200–250 (só a peça sob encomenda fica); página da peça com foto servida pelo storage; agenda e detalhe de evento | 4/4 |
| Comprador | Cadastro pela tela com cookie HttpOnly, logout e login; endereço com CEP preenchido pelo ViaCEP e persistido; sacola → checkout com endereço salvo e frete cotado → `503 PAGAMENTO_INDISPONIVEL` exibido na tela; pedido entregue com rastreio visível e avaliação enviada | 4/4 |
| Artesão | Cadastro de peça com foto pela tela, com a foto lida de volta do storage; inativar (público 404) e reativar (200); aceitar pedido, marcar enviado com rastreio e marcar entregue; relatório de vendas e resumo do painel | 4/4 |
| Organizador | Submissão de evento pela tela (201, "Evento enviado!", evento `PENDENTE` na fila); validação dos campos obrigatórios | 2/2 |
| Admin | Aprovar evento submetido pelo organizador e vê-lo na agenda pública; conceder selo na curadoria; fila de eventos com o evento do dataset | 3/3 |
| Segurança (PI-258) | 401 em 11 rotas protegidas sem sessão; 403 por papel em 11 combinações; JWT com payload adulterado recusado e cabeçalhos de papel forjados ignorados; isolamento de pedido, conversa, avaliação, transição de pedido e edição de peça entre contas; duas reservas simultâneas da mesma peça única dão exatamente um 201 e um 409 `PECA_INDISPONIVEL`; dois checkouts simultâneos sem Mercado Pago dão 503 sem criar pedido; frete com CEP ou itens inválidos dá 400; upload de foto que não é imagem dá 400 | 7/7 |

Pagamento: sem credenciais, o checkout para no 503 documentado. Pedidos pagos do roteiro são inseridos no commerce-db por `docker exec ... psql`, percorrendo os estados para que os triggers gerem linha do tempo e e-mails (detalhes em `matriz-telas.md`). Frete: o provedor fixo de demonstração responde quando o Melhor Envio sandbox não está configurado.

## 4. Defeitos

Nenhum defeito bloqueante novo foi encontrado nesta rodada; nenhuma correção de código de produto foi necessária.

Comportamentos observados e registrados:

- `GET /pedidos/{id}` é exclusivo do comprador; o artesão recebe 403 e acompanha o pedido por `/artesao/vendas` e `/artesao/pedidos-pendentes`. É o contrato atual do commerce, não um defeito.
- Em `/events/[slug]` e `/admin/events`, o DOM tem uma cópia oculta do título e dos cartões após a hidratação (o SSR tem uma só). Não aparece na tela; os specs selecionam apenas elementos visíveis.
- Cada execução do E2E real cria contas, peças, pedidos e eventos com sufixo de tempo, somados aos dados fixos do dataset. Para um ambiente limpo, use o reset descrito no README do `platform`.

## 5. Pendências conhecidas

| Pendência | Impacto | Responsável sugerido |
| --- | --- | --- |
| Credenciais sandbox do Mercado Pago e URL HTTPS pública para o webhook (PI-54, PI-262, PI-233) | Checkout termina em 503; webhook repetido só é coberto pelos testes do commerce | Allysson (commerce) com quem tiver a conta MP |
| Token do Melhor Envio sandbox (PI-212, PI-263) | Cotação usa o frete fixo de demonstração | Equipe commerce; sem responsável no Jira |
| Contratação automática de etiqueta no Melhor Envio | Rastreio é informado pelo artesão ao marcar enviado | Equipe commerce |
| Resposta do professor sobre Java/Spring (PI-166) | Registro acadêmico pendente no card | Allysson |
| Merge `develop` → `main` e redeploy de produção (PI-53) | Produção HTTPS continua atrás da `develop` | Lucas Chaves |
| Validação estrita do JWT: um caractere extra no fim da assinatura (por exemplo `A` ou `x`) ainda é aceito pelo gateway (200 em `GET /usuario`); `=` é recusado | Token alterado de forma inócua passa; não permite forjar claims | Gateway/profile (PI-168, PI-261, PI-252) |
| Itens marcados `manual` na matriz de telas (recuperação de senha, mediação, vídeos, favoritos, conversas, cancelamento) | Sem E2E real automatizado nesta rodada | QA, por card da matriz |

## 6. Reproduzir do zero

1. Pré-requisitos: Docker Desktop, PowerShell 7.2+, JDK 25, Node 22, Google Chrome e internet (ViaCEP).
2. Em `platform/`, copie `.env.example` para `.env` antes da primeira subida e preencha `ADMIN_EMAIL` (por exemplo `admin-qa@teste.local`), `ADMIN_SENHA_INICIAL` e `QA_ADMIN_SENHA` (duas senhas fortes diferentes, de 12 a 72 bytes). Em volumes que já têm administrador, o bootstrap não roda de novo: use a conta existente e ajuste os valores do `.env` a ela.
3. `pwsh -NoProfile -File platform/scripts/start-local.ps1` e confirme `docker ps` com os 13 containers `healthy`.
4. Em `Balaio-Front/Frontend`: `npm ci`, depois `npm run test:e2e:real`. O preparador cria contas, peças com foto, endereço, organizador (promovido pelo admin), evento pendente e pedidos pagos; os specs rodam em seguida. Para só popular a pilha: `npm run dados:e2e:real`.
5. Suítes dos serviços: em cada repositório Java, `./mvnw -B test` com `JAVA_HOME` no JDK 25 e as variáveis da seção 2 (catalog, commerce e community com as flags de PostgreSQL; events com um PostgreSQL temporário e `SPRING_DATASOURCE_URL/USERNAME/PASSWORD`).
6. Front: `npx tsc --noEmit -p .`, `npx eslint .`, os scripts `npm run test:*` e `npx playwright test` (stub).

Referências: matriz de telas e dados em `docs/qa/matriz-telas.md`; matriz de rotas em `api-gateway/docs/matriz-rotas.csv`; OpenAPI do gateway em `api-gateway/docs/openapi.yaml`; roteiro de demonstração em `platform/docs/roteiro-demonstracao.md`.
