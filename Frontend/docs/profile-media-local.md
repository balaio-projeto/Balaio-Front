# PI-214 — imagens do perfil na arquitetura atual do frontend

## Integração

O navegador utiliza a mesma origem da aplicação. Upload e remoção passam pelo
Route Handler do Next.js, API Gateway, Profile Service e SeaweedFS. Nenhuma
credencial S3 ou URL interna Docker é enviada ao navegador.

- Perfil autenticado: `GET /api/v1/artesao/me`.
- Perfil público: `GET /api/v1/artesaos/{slug}`.
- Envio/substituição: `PUT /api/v1/artesao/me/imagem`, multipart com campo `arquivo`.
- Remoção: `DELETE /api/v1/artesao/me/imagem`.
- Leitura pública: `GET` e `HEAD /api/v1/arquivos/perfis/{midiaId}`, com UUID.

A validação preliminar aceita JPEG, PNG e WebP não vazios, até 2 MiB. O proxy
limita o corpo multipart a 3 MiB, incluindo quando não há Content-Length. O
backend continua responsável pela autorização, conteúdo, tamanho e limite de
20 milhões de pixels. O frontend não gera nomes de objetos nem slugs.

O upload usa FormData diretamente, sem Base64 nem Content-Type manual. A imagem
exibida só muda após confirmação do backend. Falhas mantêm a imagem anterior;
upload e remoção preservam os textos ainda não salvos no formulário.

## Execução

Instalar com `npm ci`. Para desenvolvimento fora do Docker:

```dotenv
API_GATEWAY_URL=http://127.0.0.1:8080/api/v1
AUTH_ALLOWED_ORIGINS=http://localhost:4321,http://127.0.0.1:4321
```

Executar `npm run dev` e acessar `http://localhost:4321`. Dentro do Docker,
API_GATEWAY_URL deve apontar para o Gateway pela rede interna e terminar em
`/api/v1`, conforme o Compose utilizado. Essa variável é exclusiva do servidor.
Não apontar o navegador para o Gateway interno, Profile Service ou S3.

Entrar como artesão e abrir Minha conta → Perfil do ateliê, ou
`/dashboard/settings`. Enviar, substituir e remover a imagem. Conferir o painel,
os menus desktop/mobile, Minha conta e o perfil público em `/artisans/{slug}`.
Atualizar a página e confirmar que GET/HEAD utilizam `/api/v1/arquivos/perfis/`.

## Compatibilidade com develop e PI-171

Esta adaptação preserva a API única pelo Gateway, autenticação SSR, cookie
HttpOnly na raiz, proteção de Origin, Idempotency-Key, streaming e Range de
vídeos, sacola e demais integrações atuais. Não restaura a Fake API, seletores
de backend antigos ou ProtecaoRotas.

O identificador e o slug vêm do Profile Service. Preservar o contrato atual
`artesao-<UUID da conta>` do PI-171. A atualização textual do perfil mantém seu
contrato; as operações de imagem são independentes.

TrocarFoto também é utilizado por FormDadosConta. O modo de upload real é
ativado pelos callbacks do formulário do ateliê; o uso anterior do componente
na tela de dados da conta foi preservado e não constitui upload persistente
de foto de comprador.

A tela mantém os painéis de selo, envio e recebimento. Se as configurações de
envio falharem, mostra o erro correspondente sem bloquear o formulário do perfil
nem criar configurações fictícias.

## Testes

```powershell
npm run test:media
npm run test:auth
npm run test:session
npm run test:sacola
npm run test:orders
npm run test:community
npm run lint
npm run build
npx tsc --noEmit
npx playwright test tests/e2e/media.spec.ts
```

Os testes automatizados de mídia e navegador utilizam um Gateway de teste
isolado, sem SeaweedFS. Verificam multipart, cookies, Origin, binário, HEAD,
limites, falhas, substituição, remoção, avatares e preservação dos campos textuais.
Não comprovam persistência S3 ou integração com os containers reais.

Antes da entrega, integrar também os commits compatíveis de Profile Service,
API Gateway e Platform e repetir o fluxo no Docker. Resolver no backend a
colisão de numeração das migrations antigas de mídia com a V5 atual do PI-171,
sem editar migrations já aplicadas. Não alterar bancos para adaptar o frontend.

## Preservação do trabalho anterior

A branch `backup/pi-214-frontend-original` preserva o commit `6dcd1f1` da entrega
anterior. Esta integração parte de `origin/develop` (`452a231`). Não reaplica
os commits antigos de catálogo e autenticação sobre a arquitetura atual.

## Evidências desta adaptação — 17/11/2026

- `test:media`: 12/12 aprovados.
- Regressão: auth 10/10, session 12/12, sacola 5/5, orders 3/3 e community 17/17.
- `lint`, build de produção e `tsc --noEmit`: aprovados.
- Chrome, mídia isolada: 4/4 aprovados.
- Chrome, suíte completa: 18/26 aprovados; mídia 4/4 e sacola 10/10.
- Os oito cenários reprovados pertencem a `tests/e2e/auth.spec.ts`. A execução
  comparativa desse arquivo na develop 452a231 também teve os mesmos oito
  cenários reprovados e quatro aprovados. A baseline usou worktree temporária,
  portas 14322/18081 e Webpack para permitir o link das dependências; a integração
  foi testada com Turbopack e portas 14321/18080.
- Pendências dos testes antigos: caminho do cookie, tratamento de 403/erro de
  rede, expiração ociosa, navegação por papel, redirects SSR e falha de logout.
  Parte das expectativas diverge da arquitetura atual. Esses casos exigem revisão
  própria; não foram relaxados nem considerados aprovados nesta entrega.
- Houve erro interno de HMR do Turbopack na suíte completa, que ainda concluiu
  os 26 cenários. O cache anterior foi preservado fora do repositório; o build
  posterior e a checagem de tipos passaram com os tipos regenerados.
- Git sem conflitos no índice; `git diff --check` e `git diff --cached --check`
  aprovados. Nenhum commit, push ou atualização dos containers foi realizado.

A suíte completa de navegador ainda não está aprovada. Os resultados com fixture
não substituem a validação com Gateway, Profile Service e SeaweedFS reais após
a integração das entregas nos outros repositórios.
