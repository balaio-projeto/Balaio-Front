# Autenticação e execução local com o gateway

Cadastro, login/alias, logout e consulta de sessão usam **Next → api-gateway → profile-service → PostgreSQL**. O frontend não tem Fake API nem destino alternativo: toda chamada a `/api/v1/*` vai ao gateway e, se ele estiver fora do ar, a resposta é `502 API_INDISPONIVEL`. `API_GATEWAY_URL` e `AUTH_ALLOWED_ORIGINS` são configurações somente do servidor, lidas em runtime.

O navegador usa a mesma origem do Next, `credentials: 'same-origin'` e cookie `balaio_sessao` HttpOnly, SameSite=Lax, 60 minutos. O profile-service emite o cookie com Path=/api/v1; o Route Handler do Next o regrava com Path=/ para que o SSR das páginas protegidas receba a sessão. Em cada requisição, o Route Handler converte o cookie em `Authorization: Bearer` antes de encaminhar ao gateway; no SSR, as páginas chamam o gateway direto por `API_GATEWAY_URL`. O backend determina Secure; só o perfil local HTTP pode desativá-lo. Nenhum JWT é lido pelo JavaScript ou salvo em localStorage/sessionStorage.

## Preparação

### Plataforma no Docker

Na pasta `platform`, prepare o `.env`, as chaves JWT e `secrets/admin.env` conforme o README da plataforma e suba a pilha completa:

```powershell
docker compose --profile extended up --build -d
```

O Compose também sobe o contêiner `frontend` (imagem com o Next `standalone`) em **http://localhost:4321**, já apontado para `http://api-gateway:8080/api/v1`. Para desenvolver com `npm run dev` na mesma porta, pare esse contêiner antes.

### Alternativa: Java e Next no host

Use Node 22 ou superior, npm, JDK 25 e Docker Desktop ativo. Este caminho sobe só profile e gateway, suficiente para exercitar a autenticação; catálogo, commerce, community e events ficam fora, e as telas que dependem deles mostram erro. Não inicie essa alternativa nas mesmas portas enquanto os containers estiverem em execução.

Na pasta `Balaio-Front/Frontend`, configure `.env.local` a partir de `.env.example`, preservando um arquivo existente:

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm ci
docker compose -f ../../platform/docker-compose.yml --profile extended up -d profile-db
```

As configurações do frontend são:

```dotenv
API_GATEWAY_URL=http://127.0.0.1:8080/api/v1
AUTH_ALLOWED_ORIGINS=http://localhost:4321,http://127.0.0.1:4321
```

Reinicie o `npm run dev` após mudar configurações. Em container, `API_GATEWAY_URL` precisa do host interno do gateway (a imagem já usa `http://api-gateway:8080/api/v1` por padrão); localhost do container não é o host.

## Chaves locais

Gere uma vez por ambiente, fora do repositório; preserve as chaves em reinícios. No PowerShell 7, este exemplo usa somente a API de criptografia do .NET, sem imprimir chave:

```powershell
$pastaChaves = Join-Path $env:USERPROFILE '.balaio-local/chaves'
$privada = Join-Path $pastaChaves 'private.pem'
$publica = Join-Path $pastaChaves 'public.pem'
if (!(Test-Path $privada) -and !(Test-Path $publica)) {
  New-Item -ItemType Directory -Path $pastaChaves -Force | Out-Null
  $rsaBalaio = [System.Security.Cryptography.RSA]::Create(3072)
  [System.IO.File]::WriteAllText($privada, $rsaBalaio.ExportPkcs8PrivateKeyPem())
  [System.IO.File]::WriteAllText($publica, $rsaBalaio.ExportSubjectPublicKeyInfoPem())
  $rsaBalaio.Dispose()
} elseif (!(Test-Path $privada) -or !(Test-Path $publica)) {
  throw 'Par incompleto. Recupere as chaves do ambiente antes de iniciar.'
}
```

Restrinja a leitura da privada à conta que executa o profile. Somente o profile recebe seu caminho. Os [READMEs do profile](../../../profile-service/README.md) e [gateway](../../../api-gateway/README.md) descrevem formato, validação e alternativa com OpenSSL. Não use as chaves dos testes como configuração de ambiente.

## Iniciar os serviços

Em um terminal **na pasta `profile-service`**, com JDK 25 selecionado em JAVA_HOME/PATH:

```powershell
$env:SPRING_DATASOURCE_URL = 'jdbc:postgresql://localhost:5434/balaio_profile'
$env:SPRING_DATASOURCE_USERNAME = 'balaio_profile_app'
$env:SPRING_DATASOURCE_PASSWORD = 'balaio'
$env:JWT_PRIVATE_KEY_LOCATION = Join-Path $env:USERPROFILE '.balaio-local/chaves/private.pem'
$env:JWT_ISSUER = 'https://balaio.local'
$env:JWT_AUDIENCE = 'balaio-api'
$env:AUTH_ALLOWED_ORIGINS = 'http://localhost:4321,http://127.0.0.1:4321'
$env:SPRING_PROFILES_ACTIVE = 'local'
$env:AUTH_COOKIE_SECURE = 'false'
$env:ADMIN_EMAIL = 'admin-local@balaio.invalid'
$senhaInicialLocal = Read-Host 'Senha inicial do administrador local (mínimo 12 caracteres)' -AsSecureString
$env:ADMIN_SENHA_INICIAL = [System.Net.NetworkCredential]::new('', $senhaInicialLocal).Password
.\mvnw.cmd -B -ntp spring-boot:run
```

`balaio` é a senha **padrão de desenvolvimento do Compose**, não uma credencial de produção; ajuste banco/porta/senha se já configurou `PROFILE_DB_PASSWORD`, `DB_PASSWORD` ou `PROFILE_DB_HOST_PORT`. O bootstrap não redefine um administrador existente. Esse administrador continua sujeito à troca obrigatória e aos limites administrativos descritos no profile.

Em outro terminal **na pasta `api-gateway`**, com JDK 25:

```powershell
$env:JWT_PUBLIC_KEY_LOCATION = Join-Path $env:USERPROFILE '.balaio-local/chaves/public.pem'
$env:JWT_ISSUER = 'https://balaio.local'
$env:JWT_AUDIENCE = 'balaio-api'
$env:AUTH_ALLOWED_ORIGINS = 'http://localhost:4321,http://127.0.0.1:4321'
$env:PROFILE_SERVICE_URL = 'http://localhost:8082'
.\mvnw.cmd -B -ntp spring-boot:run
```

Em outro terminal **na pasta `Balaio-Front/Frontend`**:

```powershell
npm run dev
```

Abra **http://localhost:4321/login/register**. Crie comprador ou artesão com senha de pelo menos 12 caracteres Unicode, até 72 bytes UTF-8, sem caracteres de controle. Para build/execução de produção local: `npm run build` e `npm run start`, com o gateway no ar. Use Secure em qualquer ambiente HTTPS.

## Regras do Route Handler

- Encaminha toda requisição de `/api/v1/*` ao gateway, sem lista de rotas locais.
- Rejeita caminhos com `%2f`, `%5c`, `%2e` ou barras duplas e query com parâmetro começando com `_`, sem chamar o gateway.
- As rotas `/auth/*` só aceitam `POST`.
- Escrita autenticada por cookie valida `Origin` contra `AUTH_ALLOWED_ORIGINS`; Origin ausente é rejeitado. Bearer sem cookie pode operar sem Origin após validação no gateway.
- Limite de corpo de 64 KB no JSON das rotas do community e de 100 MB no upload de vídeo.

## Conferência manual

1. Cadastre uma conta e confirme `/account`. No Network, verifique o envelope público e Set-Cookie; não há JWT no JSON.
2. Recarregue `/account`: o servidor do Next lê `balaio_sessao` (Path=/) e confirma a identidade com `GET /usuario` no gateway antes de renderizar. `401` do gateway invalida a sessão; `403` informa falta de permissão.
3. Como visitante, adicione itens à sacola e aos favoritos e depois entre: os itens guardados no navegador são mesclados na conta pelo gateway.
4. Clique em sair e tente `/account` novamente: será exigido login. Se logout falhar, a tela limpa o estado e oferece nova tentativa, sem afirmar que removeu o cookie. Um JWT copiado continua válido até expirar; não há refresh/revogação imediata.
5. Pare o gateway e tente login: a resposta deve ser `502 API_INDISPONIVEL`.

A interface revalida ao montar, voltar à aba/foco e a cada 30 segundos enquanto visível. A expiração é aplicada no backend; a tela ociosa visível reage na próxima revalidação. Ao voltar de uma aba em segundo plano, ocorre nova consulta. Não há temporizador inferido por decodificação do cookie HttpOnly.

Telas que dependem de endpoints ainda ausentes no backend (eventos, perfil de artesão, coletivos, curadoria, endereços, edição de conta e sacola da conta) mostram erro ou estado vazio; a lista completa está em [Pendências no backend](api.md#pendências-no-backend).

## Testes

- `npm run test:auth`: Route Handler com gateway controlado, cookies, Bearer, Origin, caminhos ambíguos, método errado e gateway indisponível (502).
- `npm run test:session`: `src/proxy.ts` e envio da sessão como Bearer ao gateway nas rotas de peças, usuário, checkout, pedidos e sacola.
- `npm run test:e2e:auth`: Chrome headless instalado, portas 14321/18080 livres; sobe Next e um gateway **controlado de teste**. Verifica cadastro, cookies, reload, 401/403, expiração, logout, mesclagem da sacola no login e ausência de loaders privados em SSR. O processo não usa o banco do projeto.
- `npm run lint` e `npm run build`: verificações do frontend. O build precisa acessar Google Fonts ou usar o cache já baixado.

Os testes Java reais do `GET /usuario` usam JDK 25/PostgreSQL via Testcontainers e estão registrados no [acompanhamento](../../../profile-service/docs/engineering/auth-jwt-progress.md). Nenhuma chave privada estática ou JWT de ambiente foi versionado.
