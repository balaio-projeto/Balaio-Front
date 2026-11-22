# Arquitetura do frontend

## Tecnologias

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** com CSS organizado em camadas (`src/styles/`)
- **React Context** para estado global
- **api-gateway** da plataforma como única fonte de dados, acessado pelo Route Handler `/api/v1/[...caminho]`
- Leaflet + OpenStreetMap (mapa de eventos) e Recharts (gráfico do painel)

## Estrutura de pastas

```
Frontend/
├── src/
│   ├── app/          páginas, rotas e o Route Handler api/v1/[...caminho]
│   ├── components/   componentes separados por domínio
│   ├── services/     comunicação com a API e sessão
│   ├── store/        estado global
│   ├── hooks/        lógica reutilizável
│   ├── types/        tipos do domínio
│   ├── constants/    valores fixos
│   ├── utils/        funções auxiliares
│   ├── styles/       estilos
│   └── proxy.ts      proteção de rotas
├── tests/            testes de autenticação (node:test e Playwright)
├── public/           imagens estáticas (`public/fotos` é usado pelo seed do catalog-service)
└── Dockerfile
```

| Pasta | Responsabilidade |
|---|---|
| `app/` | Monta cada tela: busca os dados pelos services e compõe os componentes |
| `components/` | Componentes por domínio: `produto`, `carrinho`, `pedido`, `painel`, `admin`, `eventos`, `forms`, `layout`, `ui` e `feedback` (carregando, erro e estado vazio) |
| `services/api/` | Único ponto de acesso à API: um cliente HTTP (`cliente.ts`), o encaminhamento ao gateway (`proxy.ts`, `gateway.ts`) e um arquivo por recurso (`pecas.servico.ts`, `pedidos.servico.ts`...) |

No Checkout Pro, o frontend recebe apenas a URL hospedada `sandbox.mercadopago.com` e redireciona o comprador. Nenhum cartão, token do provedor ou segredo webhook passa pelo navegador. O retorno para `/confirmation/:id` consulta o estado do commerce periodicamente; query string ou navegação de sucesso não alteram o status financeiro. Cancelamento e reembolso só são exibidos como concluídos depois da confirmação do provedor no backend. A integração não promete retenção ou repasse ao artesão.
| `store/` | Sessão, sacola, favoritos e dados compartilhados |
| `hooks/` | Lógica reutilizável dos componentes (`usePecas`, `useReferencias`...) |
| `types/` | Tipos das entidades (`Peca`, `Artesao`, `Pedido`, `Evento`, `Usuario`...) |
| `constants/` | Valores fixos: rótulos, departamentos, municípios e tipos de evento |
| `utils/` | Formatação, validação de formulários, filtros de URL, distância entre pontos e imagem padrão |

## Fluxo dos dados

```
Página ou componente
   └─ service       (ex.: obterPeca)          src/services/api/pecas.servico.ts
       └─ cliente   (buscar / enviar)         src/services/api/cliente.ts
           └─ API   /api/v1/...                api-gateway (catalog, profile, commerce, community, events)
```

- As páginas são renderizadas no servidor e buscam os dados antes de montar o HTML.
- Os componentes interativos (sacola, favoritos, formulários) chamam os mesmos services
  no navegador.
- O cliente HTTP aplica timeout de 10 s e devolve sempre `{ dados, erro }`. As telas
  nunca fazem `fetch` direto.
- No navegador, as chamadas vão para `/api/v1` na mesma origem e o Route Handler
  `src/app/api/v1/[...caminho]/route.ts` encaminha todas ao gateway, convertendo o cookie
  `balaio_sessao` em `Authorization: Bearer`. No servidor (SSR), o cliente chama o gateway
  direto por `API_GATEWAY_URL`. Não há destino alternativo: gateway fora do ar vira
  `502 API_INDISPONIVEL` e a tela mostra o estado de erro.

## Estado global

Montado no `app/layout.tsx`:

- **Sessão:** usuário logado e papel.
- **Sacola:** visitante usa `localStorage`; comprador autenticado usa `GET/PUT /estado/sacola` no commerce. No login, a cópia local é mesclada e removida apenas após confirmação remota. Atualizar a sacola não reserva peças; a reserva acontece no checkout.
- **Revalidação:** `POST /sacola/revalidar` é adaptado ao Gateway e consulta o comércio, que lê a sacola do JWT e cota cada peça pelo HTTP interno do catálogo. A interface mostra o preço final da cotação, bloqueia checkout com item indisponível ou falha de dependência e repete a consulta antes de registrar o pedido. A verificação não altera a sacola nem reserva estoque.
- Conflitos de catálogo na mesclagem mantêm a lista para correção pelo comprador. Falhas do armazenamento local deixam a sacola visitante em memória com aviso; essa cópia atravessa a troca de identidade no login, permanece em falha de PUT e é descartada apenas após confirmação remota. A memória da sacola autenticada continua isolada por identidade. O checkout só redireciona ao pagamento após confirmar a limpeza da sacola da conta.
- **Favoritos, histórico de busca e vídeos curtidos/salvos:** visitante guarda só no
  `localStorage`; ao entrar, os itens são mesclados na conta por `GET/PUT /estado/{colecao}`
  no community.
- **Dados de apoio:** artesãos, coletivos e opções de frete.
- **Tema claro/escuro:** fica só no navegador.

## Autenticação

- O profile-service grava a sessão no cookie `HttpOnly` `balaio_sessao` após o login, e o
  Route Handler o regrava com `Path=/` para que o SSR receba a sessão.
- O `src/proxy.ts` redireciona antes de a página abrir: quem não está logado vai para
  `/login`, e cada papel só entra na sua área (`/dashboard` para artesão, `/admin` para
  administrador).
- As páginas protegidas confirmam a sessão com `GET /usuario` no gateway antes de mostrar os dados.

## Carregando, erro e estado vazio

| Situação | Tratamento |
|---|---|
| Carregando | `loading.tsx` nas rotas principais e `EstadoCarregando` |
| Erro | `error.tsx` com botão "Tentar novamente" e `EstadoErro` |
| Não encontrado | `not-found.tsx` |
| Lista vazia | `EstadoVazio` (sacola, favoritos, busca, pedidos, curadoria, mediações) |
| Erro em formulário | Mensagem da API exibida sem apagar o que foi digitado |

## Estilos e responsividade

- Layout mobile-first com pontos de quebra em 560, 700, 900 e 1000 px.
- Cores definidas uma vez com `light-dark()` para os dois temas, com contraste acessível.
- Foco visível, suporte a leitores de tela e a movimento reduzido.

## Execução

- **Desenvolvimento:** suba antes a plataforma (gateway e serviços); depois `npm run dev`
  sobe só o frontend (`next dev -p 4321`).
- **Produção:** o `Dockerfile` gera uma imagem só com o build `standalone` do Next.js
  (`node server.js`, porta 7879, healthcheck em `/healthz`). O gateway roda fora do contêiner.
- Telas que dependem de endpoints ainda ausentes no backend mostram erro ou estado vazio;
  veja [Pendências no backend](api.md#pendências-no-backend).
