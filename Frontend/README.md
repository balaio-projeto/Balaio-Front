# Balaio: Projeto Origem

> Marketplace da economia criativa e do artesanato de Pernambuco.
> Projeto Integrador **Origem**, disciplina de Desenvolvimento Web, CESAR School, 2026.2.

| | |
|---|---|
| **Deploy** | https://balaio.torreszx.space |
| **Vídeo de demonstração** | `PREENCHER: link do vídeo` |
| **Repositório** | https://github.com/lucaschavessf2/marketplace-artesanato |
| **Branch principal** | Hoje o desenvolvimento acontece em `develop`, por pull request, e `main` é a branch padrão |
| **Estado atual** | Frontend responsivo integrado à plataforma pelo `api-gateway` (sem Fake API) |
| **Contas locais** | Cadastre comprador ou artesão em `/login/register`; a conta é persistida no profile/PostgreSQL. |

## 👥 Membros da Equipe

<table align="center">
  <tr>
    <td align="center">
      <a href="https://github.com/GabrielHen-dev">
        <img src="https://avatars.githubusercontent.com/u/113862540?v=4" width="100" style="border-radius:50%;" alt="Foto de Gabriel Henrique"/>
        <br />
        <sub><b>Gabriel Henrique</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/dgcavalcante">
        <img src="https://avatars.githubusercontent.com/u/210120655?v=4" width="100" style="border-radius:50%;" alt="Foto de Diogo Cavalcante"/>
        <br />
        <sub><b>Diogo Cavalcante</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/lucaschavessf">
        <img src="https://avatars.githubusercontent.com/u/153633041?v=4" width="100" style="border-radius:50%;" alt="Foto de Lucas Chaves"/>
        <br />
        <sub><b>Lucas Chaves</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/allyssonifx">
        <img src="https://avatars.githubusercontent.com/u/68469620?v=4" width="100" style="border-radius:50%;" alt="Foto de Allysson Fellype"/>
        <br />
        <sub><b>Allysson Fellype</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/Fernando2732">
        <img src="https://avatars.githubusercontent.com/u/209713382?v=4" width="100" style="border-radius:50%;" alt="Foto de Fernando Marinho"/>
        <br />
        <sub><b>Fernando Marinho</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/MatheusAS1">
        <img src="https://avatars.githubusercontent.com/u/210196636?v=4" width="100" style="border-radius:50%;" alt="Foto de Matheus Andrade"/>
        <br />
        <sub><b>Matheus Andrade</b></sub>
      </a>
    </td>
  </tr>
</table>

---

## Descrição

O **Balaio** conecta artesãos e coletivos de Pernambuco (Alto do Moura, Tracunhaém,
Pajeú, Cariri e outros polos) a compradores de todo o país. A plataforma dá vitrine e
canal de venda a quem produz, destacando a **técnica, a origem e a história** de cada
peça. Sem ela, esses artesãos dependem de intermediários e têm pouca visibilidade
digital.

A aplicação atende três perfis:

- **Comprador:** descobre peças, filtra por técnica, território e categoria, compra e
  acompanha pedidos.
- **Artesão:** cadastra e gerencia peças, recebe e acompanha pedidos, conversa com
  compradores e publica vídeos do ateliê.
- **Administrador:** concede o selo de artesão verificado e media conflitos entre
  comprador e artesão.

## Objetivos

- Valorizar o artesanato e a cultura pernambucana.
- Aproximar artesãos e consumidores por meio da tecnologia.
- Facilitar a descoberta de produtos artesanais.
- Dar maior visibilidade aos produtores e coletivos.
- Proporcionar uma experiência de compra simples e intuitiva.
- Criar um espaço para divulgação de eventos e conteúdos relacionados ao artesanato.

## Tecnologias

| Área | Tecnologias |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5 |
| Estilo | Tailwind CSS v4 (CSS-first, com `@apply`), tokens CSS com `light-dark()` |
| Estado | React Context (`src/store/`) |
| API | `api-gateway` da plataforma, acessado pelo Route Handler `/api/v1/[...caminho]` do Next.js |
| Mapa e gráficos | Leaflet + OpenStreetMap, Recharts |
| Interface | Lucide React (ícones), Sonner (avisos) |
| Qualidade | ESLint, `tsc --noEmit`, testes com `node:test` (via `tsx`) e Playwright |
| Deploy | Docker (build `standalone` do Next.js) |

---

## Como executar localmente

Requisitos: **Node.js 22.21+** e npm. O frontend não tem mais API simulada: todos os
dados vêm do `api-gateway`, que precisa estar no ar antes.

1. **Suba a plataforma.** Na pasta `platform`, siga o README da plataforma
   (`.env`, chaves e `secrets/admin.env` no primeiro uso) e inicie a pilha completa:

   ```sh
   docker compose --profile extended up --build -d
   ```

   O gateway fica em `http://127.0.0.1:8080/api/v1`. O Compose também sobe o
   contêiner `frontend` na porta 4321; para usar o modo de desenvolvimento abaixo,
   pare esse contêiner antes.

2. **Rode o frontend.** A partir da raiz deste repositório:

   ```sh
   cd Frontend
   npm ci
   npm run dev
   ```

| Serviço | Endereço |
|---|---|
| Frontend | http://localhost:4321 |
| API Gateway | http://127.0.0.1:8080/api/v1 |

Se o gateway estiver fora do ar, as chamadas do navegador respondem **502**
`API_INDISPONIVEL` e as telas mostram o estado de erro.

### Contas locais

Cadastre sua conta de comprador ou de artesão em `/login/register` e entre por
`/login`. A conta é persistida no profile/PostgreSQL. A conta de administrador é
criada pela plataforma a partir de `secrets/admin.env`.

### Scripts

Rodar dentro de `Frontend/`:

| Comando | O que faz |
|---|---|
| `npm run dev` | Frontend em modo desenvolvimento (`next dev -p 4321`) |
| `npm run build` e `npm start` | Build de produção e servidor na porta 4321 (o gateway precisa estar no ar) |
| `npm run lint` | ESLint |
| `npm run test:auth` | Testes do proxy `/api/v1` (cookies, Origin, caminhos e encaminhamento ao gateway) |
| `npm run test:e2e:auth` | Testes de ponta a ponta da autenticação com Playwright e gateway controlado de teste |
| `npm run test:session` | Testes do `src/proxy.ts` (sessão e papel) e do envio da sessão como Bearer ao gateway |
| `npm run test:sacola` | Testes da sacola e da abertura do pagamento |
| `npm run test:orders` | Testes da ação de cancelamento de pedido |
| `npm run test:community` | Testes do encaminhamento ao gateway, limites de corpo, mídia e mesclagem das coleções do visitante |

### Com Docker

```sh
cd Frontend
docker build -t balaio-frontend .
docker run -p 7879:7879 balaio-frontend
```

Acesse http://localhost:7879. A imagem contém só o Next.js (`standalone`) e espera
encontrar o gateway em `http://api-gateway:8080/api/v1`; fora do Compose da
plataforma, defina `API_GATEWAY_URL` no contêiner.

## Variáveis de ambiente

Nenhuma é obrigatória no ambiente local. Para mudar o padrão, copie
`Frontend/.env.example` para `Frontend/.env.local`:

| Variável | Padrão | Para quê |
|---|---|---|
| `API_GATEWAY_URL` | `http://127.0.0.1:8080/api/v1` (na imagem Docker: `http://api-gateway:8080/api/v1`) | Endereço do gateway usado no servidor (SSR) e no encaminhamento de `/api/v1` do navegador |
| `AUTH_ALLOWED_ORIGINS` | `http://localhost:4321,http://127.0.0.1:4321` | Origens aceitas em escritas autenticadas pelo cookie de sessão |

As duas são lidas só no servidor. O `.env.example` não contém credenciais.

---

## Funcionalidades implementadas

**Comprador e visitante**
- Vitrine com destaques, ofertas, artesãos e eventos
- Busca com histórico e sugestões; filtros por técnica, território, categoria, tipo,
  disponibilidade e desconto; ordenação e paginação
- Página da peça com galeria, história, frete, perguntas públicas e peças relacionadas
- Perfil do artesão, página de coletivo e páginas institucionais
- Favoritos, histórico de busca e sacola: o visitante guarda no navegador
  (`localStorage`); ao entrar, os itens são mesclados na conta pelo gateway
- Checkout com endereço, frete e meio de pagamento (pagamento simulado)
- Pedidos: acompanhamento por etapas, conversa com o artesão, cancelamento antes da
  produção, avaliação após a entrega e abertura de mediação
- Conta: dados pessoais, troca de senha, endereços e recuperação de acesso
- Agenda de eventos com mapa, ordenação por proximidade e criação de evento
- Feed de vídeos dos ateliês, com curtidas, salvos e comentários

**Artesão** (`/dashboard`)
- Resumo com pedidos a aceitar e gráfico de faturamento
- Cadastro e edição de peças com até 5 fotos, rascunho ou publicação, e inativação
- Pedidos: aceitar, recusar com motivo e avançar etapas (produção, envio, entrega)
- Mensagens com compradores, publicação de vídeos
- Perfil do ateliê, configurações de envio e recebimento e pedido do selo de verificado

**Administrador** (`/admin`)
- Curadoria do selo de verificado (aprovar ou pedir ajuste com motivo)
- Mediações entre comprador e artesão

**Experiência e acessibilidade**
- Layout responsivo (mobile a desktop), navegação inferior no celular
- Tema claro e escuro, contraste WCAG AA, foco visível, suporte a leitores de tela e a
  movimento reduzido
- Rotas protegidas por sessão e papel
- Tratamento de carregando, erro e estado vazio nas telas que buscam dados

Algumas dessas telas dependem de endpoints que o backend ainda não implementa e mostram
erro ou estado vazio até eles existirem; veja [Pendências no backend](#pendências-no-backend).

## Fluxos implementados

**1. Compra (comprador)**
`/` vitrine → `/search?q=…` busca e filtros → `/pieces/[slug]` detalhe →
adicionar à sacola → `/cart` → `/checkout` (pede login se necessário) →
`/confirmation/[id]` → `/orders/[id]` acompanhamento → `/orders/[id]/review` avaliação

**2. Pós-venda (comprador)**
`/orders/[id]` → conversa com o artesão, **cancelar** (enquanto confirmado) ou
`/orders/[id]/mediation` abrir mediação

**3. Venda (artesão)**
`/login` → `/dashboard` → `/dashboard/pieces/new` cadastrar peça →
peça aparece na vitrine → pedido chega em "pedidos a aceitar" → aceitar ou recusar →
avançar para produção, envio e entrega → `/dashboard/messages` conversar

**4. Curadoria (administrador)**
Artesão pede o selo em `/dashboard/settings` → `/admin` aprova ou pede ajuste →
artesão vê a decisão no painel → selo aparece no perfil público

**5. Descoberta**
`/events` agenda com mapa → `/events/[slug]` · `/videos` feed dos ateliês ·
`/artisans/[slug]` e `/collectives/[slug]` perfis

---

## Rotas da API

A documentação completa está em **[`docs/api.md`](docs/api.md)**: formato das respostas,
autenticação, rotas, exemplos e rotas planejadas. Autenticação, sessão e execução com
o gateway: [`docs/auth-local.md`](docs/auth-local.md).

Resumo dos recursos (prefixo `/api/v1`):

| Recurso | Principais rotas |
|---|---|
| Autenticação | `POST /auth/cadastro`, `/auth/login`, `/auth/logout`, `/auth/recuperacao` |
| Catálogo | `GET /pecas` (busca, filtros, paginação), `GET /pecas/:slug`, `/pecas/:slug/relacionadas` |
| Artesãos e coletivos | `GET /artesaos`, `/artesaos/:slug`, `/artesaos/:slug/pecas`, `/coletivos` |
| Sacola e coleções | `GET/PUT /estado/sacola`, `GET/PUT /estado/favoritos`, `/estado/historicoBusca`, `/estado/videosCurtidos`, `/estado/videosSalvos` |
| Pedidos | `POST /checkout`, `GET /pedidos`, `PATCH /pedidos/:id/cancelar`, `POST /pedidos/:id/avaliacao` |
| Painel do artesão | `POST/PATCH/DELETE /pecas`, `GET /artesao/pedidos-pendentes`, `/artesao/vendas`, `/artesao/selo` |
| Administração | `GET /admin/curadoria`, `POST /admin/curadoria/:id/decisao`, `/admin/mediacoes` |
| Apoio | `GET /referencias`, `/fretes`, `/eventos`, `/videos` |

## Integração com o backend

O frontend fala **somente com o `api-gateway`**; não há API simulada nem dados fixos
como alternativa:

1. **Toda chamada passa por `src/services/api/`.** As telas usam funções como
   `listarPecas()` e `finalizarCompra()`, nunca `fetch` direto nem dados fixos.
2. **No navegador**, as chamadas vão para `/api/v1/...` na mesma origem. O Route Handler
   `src/app/api/v1/[...caminho]/route.ts` encaminha toda requisição ao gateway: valida o
   caminho, converte o cookie HttpOnly `balaio_sessao` em `Authorization: Bearer`, exige
   Origin permitido em escritas autenticadas por cookie e regrava o cookie de sessão
   com `Path=/`. Gateway fora do ar vira **502** `API_INDISPONIVEL`.
3. **No servidor (SSR)**, as páginas chamam o gateway direto por `API_GATEWAY_URL`.
4. **O gateway distribui as rotas** entre catalog, profile, commerce, community e
   events (mapa em [`docs/api.md`](docs/api.md)).

## Pendências no backend

A integração de imagens do PI-214, seus contratos e a validação local estão em
[`docs/profile-media-local.md`](docs/profile-media-local.md). Ela requer as entregas
correspondentes de Profile Service, API Gateway e Platform.

As telas abaixo mostram erro ou estado vazio até o backend implementar os endpoints:

| Serviço | O que falta |
|---|---|
| `events-service` | Nenhum endpoint implementado (agenda, detalhe e criação de evento) |
| `profile-service` | Só implementa autenticação (`/auth/cadastro`, `login`, `entrar`, `logout`, `recuperacao`, `redefinicao`) e `GET /usuario`. Faltam `/artesaos`, `/artesao/me`, `/artesao/selo`, `/coletivos`, `/admin/curadoria`, `PATCH /usuario`, endereços e `/conta` |
| `commerce-service` | Não implementa `/estado/sacola` (a sacola da conta não é lida nem salva) |

## Arquitetura

Tecnologias, pastas, fluxo dos dados, autenticação e tratamento de erros:
**[`docs/arquitetura.md`](docs/arquitetura.md)**.

```
Frontend/
├── src/app/         páginas (montam a tela)
├── src/components/  componentes por domínio
├── src/services/    única porta para a API (gateway) + sessão
├── src/store/       estado global (sessão, sacola, favoritos)
├── src/hooks/       lógica reutilizável
├── src/types/       tipos do domínio
└── docs/            documentação
```

## Deploy

| Ambiente | URL |
|---|---|
| Produção | https://balaio.torreszx.space |

A aplicação é publicada com o `Frontend/Dockerfile`. A imagem contém só o build
`standalone` do Next.js (`node server.js`, porta `7879`), com healthcheck em `/healthz`.
O gateway roda fora do contêiner do frontend.

## Evidências

- **Vídeo:** `PREENCHER: link` (principais fluxos: compra, painel do artesão, curadoria)
- **Commits:** histórico por pull request em `develop`, com commits de todos os integrantes
- **Testes:** `npm run test:auth`, `test:media`, `test:session`, `test:sacola`, `test:orders`,
  `test:community` e `test:e2e:auth` (proxy para o gateway, sessão, cookies, Origin,
  sacola, pedidos e community)

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/api.md`](docs/api.md) | Contrato da API, endpoints e exemplos |
| [`docs/arquitetura.md`](docs/arquitetura.md) | Organização do frontend |
| [`docs/uso-de-ia.md`](docs/uso-de-ia.md) | Declaração de uso de IA |
| [`docs/auth-local.md`](docs/auth-local.md) | Autenticação, sessão e execução local com o gateway |
