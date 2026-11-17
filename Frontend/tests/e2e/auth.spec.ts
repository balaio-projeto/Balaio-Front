import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

const controle = 'http://127.0.0.1:18080'
const senha = 'SenhaDeTeste123!'
type Evento = { destino: string; caminho: string; metodo: string }
const paginasPrivadas = ['/checkout', '/dashboard', '/admin']
const linksPrivados = 'a[href^="/checkout"], a[href^="/confirmation"], a[href^="/dashboard"], a[href^="/admin"], a[href^="/orders/"]'
const eventosDoTeste = async (request: APIRequestContext): Promise<Evento[]> => (await (await request.get(`${controle}/__test/eventos`)).json()).dados
const acessoPrivado = (evento: Evento) => /^\/api\/v1\/(?:demo(?:\/|$)|pedidos(?:\/|$)|checkout(?:\/|$)|artesao(?:\/|$)|admin(?:\/|$)|usuario(?:\/|$))/.test(evento.caminho)

async function semDemonstracaoOuAviso(page: Page) {
  await expect(page.getByLabel('Conta de demonstração', { exact: true })).toHaveCount(0)
  await expect(page.locator('#conteudo')).not.toContainText(/demonstração|simulado|backend|em breve|não integrad/i)
  await expect(page.locator(linksPrivados)).toHaveCount(0)
}

async function login(page: Page, papel = 'comprador') {
  await page.goto('/login')
  await page.locator('#email').fill(`${papel}@auth.test`)
  await page.locator('#senha').fill(senha)
  await page.locator('#conteudo').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.locator('.conta-capa-nome')).toHaveText(`Conta real ${papel}`)
}

test.beforeEach(async ({ request }) => { await request.post(`${controle}/__test/reset`) })

test('cookie JSON forjado não permite acessar rotas nem executar loaders privados SSR', async ({ page, context, request }) => {
  await context.addCookies([{ name: 'balaio-sessao', value: encodeURIComponent(JSON.stringify({ id: 'admin', nome: 'Forjado', papel: 'admin' })), domain: '127.0.0.1', path: '/' }])
  const resposta = await request.get('/orders')
  expect(await resposta.text()).not.toContain('usuarioId')
  await page.goto('/orders')
  await expect(page).toHaveURL(/\/login\?proximo=/)
  expect((await eventosDoTeste(request)).filter(acessoPrivado)).toEqual([])
})
test('cadastro real, cookie HttpOnly, reload e logout sem JWT em storage', async ({ page, context, request }) => {
  await page.goto('/login/register')
  await page.locator('#cadastro-nome').fill('Cadastro Browser')
  await page.locator('#cadastro-email').fill(`browser-${Date.now()}@auth.test`)
  await page.locator('#cadastro-senha').fill(senha)
  await page.getByRole('button', { name: 'Criar minha conta' }).click()
  await expect(page).toHaveURL(/\/account$/)
  const cookies = await context.cookies('http://127.0.0.1:14321/api/v1/usuario')
  const jwt = cookies.find((cookie) => cookie.name === 'balaio_sessao')!
  expect(Boolean(jwt)).toBe(true)
  expect(jwt.httpOnly && jwt.sameSite === 'Lax' && jwt.path === '/api/v1').toBe(true)
  const claims = JSON.parse(Buffer.from(jwt.value.split('.')[1], 'base64url').toString())
  expect(claims.exp - claims.iat).toBe(3600)
  expect(await page.evaluate(() => document.cookie.includes('balaio_sessao='))).toBe(false)
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]).includes('eyJ'))).toBe(false)
  await page.reload()
  await expect(page.locator('.conta-capa-nome')).toHaveText('Cadastro Browser')
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  expect((await context.cookies()).some((cookie) => cookie.name === 'balaio_sessao')).toBe(false)
  await page.goto('/account')
  await expect(page).toHaveURL(/\/login\?proximo=/)
  const eventos = await eventosDoTeste(request)
  expect(eventos.some((evento) => evento.destino === 'gateway' && evento.caminho.endsWith('/auth/cadastro'))).toBe(true)
})
test('login inválido mostra 401; alias entrar estabelece a sessão real', async ({ page, request }) => {
  await page.goto('/login')
  await page.locator('#email').fill('comprador@auth.test')
  await page.locator('#senha').fill('senha-incorreta')
  await page.locator('#conteudo').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha inválidos' })).toBeVisible()
  const resposta = await page.request.post('/api/v1/auth/entrar', { data: { email: 'comprador@auth.test', senha }, headers: { Origin: 'http://127.0.0.1:14321' } })
  expect(resposta.status()).toBe(200)
  await page.goto('/account')
  await expect(page.locator('.conta-capa-nome')).toHaveText('Conta real comprador')
  const eventos = (await (await request.get(`${controle}/__test/eventos`)).json()).dados
  expect(eventos.some((evento: { destino: string; caminho: string }) => evento.destino === 'gateway' && evento.caminho.endsWith('/auth/entrar'))).toBe(true)
})
test('403 mantém cookie e não vira logout; erro de rede bloqueia dados e permite tentar novamente', async ({ page, request, context }) => {
  await login(page)
  await request.post(`${controle}/__test/config`, { data: { statusUsuario: 403 } })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('heading', { name: 'Acesso não permitido' })).toBeVisible()
  expect((await context.cookies()).some((cookie) => cookie.name === 'balaio_sessao')).toBe(true)
  await request.post(`${controle}/__test/config`, { data: { statusUsuario: 503 } })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText('Não foi possível validar sua sessão.', { exact: false })).toBeVisible()
  await request.post(`${controle}/__test/config`, { data: { statusUsuario: 0 } })
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.locator('.conta-capa-nome')).toHaveText('Conta real comprador')
})
test('expiração invalida sessão real em aba ociosa', async ({ page, request }) => {
  await page.clock.install()
  await login(page)
  await request.post(`${controle}/__test/config`, { data: { expirar: true } })
  await page.clock.fastForward(30001)
  await expect(page).toHaveURL(/\/login\?proximo=/)
})
test('conta, dados, endereços e pedidos não executam loaders privados em SSR ou prefetch', async ({ request }) => {
  const variacoes: Record<string, string>[] = [{}, { RSC: '1' }, { RSC: '1', 'Next-Router-Prefetch': '1' }]
  for (const caminho of ['/account', '/account/details', '/account/addresses', '/orders']) {
    for (const headers of variacoes) {
      const resposta = await request.get(caminho, { headers })
      expect(resposta.status()).toBe(200)
      const html = await resposta.text()
      expect(html).not.toMatch(/usuarioId|compradorId|compradorNome|Conta real comprador|comprador@auth\.test/)
      expect((await eventosDoTeste(request)).filter(acessoPrivado)).toEqual([])
    }
  }
})
for (const papel of ['comprador', 'artesao', 'admin']) {
  test(`${papel} real vê itens básicos da conta sem seletor, avisos ou painéis por papel`, async ({ page, request }) => {
    await login(page, papel)
    await expect(page.locator('.conta-capa')).toContainText(`${papel}@auth.test`)
    await expect(page.locator('.conta-hub').getByRole('link', { name: 'Peças salvas' })).toBeVisible()
    for (const nome of ['Meus pedidos', 'Meus dados', 'Endereços de entrega', 'Alterar senha']) {
      await expect(page.locator('.conta-hub').getByRole('link', { name: nome, exact: nome !== 'Meus pedidos' })).toBeVisible()
    }
    await semDemonstracaoOuAviso(page)
    await page.locator('.menu-perfil-gatilho').click()
    await expect(page.locator('.menu-perfil-painel')).toBeVisible()
    await semDemonstracaoOuAviso(page)
    for (const caminho of paginasPrivadas) {
      await page.goto(caminho)
      await expect(page).toHaveURL(/\/account$/)
      await expect(page.locator('.conta-capa-nome')).toHaveText(`Conta real ${papel}`)
      await semDemonstracaoOuAviso(page)
    }
    const eventos = await eventosDoTeste(request)
    expect(eventos.filter((evento) => evento.destino === 'gateway' && acessoPrivado(evento) && evento.caminho !== '/api/v1/usuario')).toEqual([])
  })
}
test('checkout, detalhes de pedidos e painéis não executam loaders privados em HTML ou RSC', async ({ request }) => {
  test.setTimeout(120000)
  const paginas = [...paginasPrivadas, '/orders/pedido', '/orders/pedido/review', '/orders/pedido/mediation', '/confirmation/pedido', '/dashboard/pieces', '/dashboard/pieces/new', '/dashboard/pieces/peca', '/dashboard/sales', '/dashboard/messages', '/dashboard/videos', '/dashboard/settings', '/admin/criteria', '/admin/mediations']
  const variacoes: { tipo: string; headers: Record<string, string> }[] = [
    { tipo: 'HTML', headers: {} },
    { tipo: 'RSC', headers: { RSC: '1' } },
    { tipo: 'prefetch', headers: { RSC: '1', 'Next-Router-Prefetch': '1' } },
  ]
  for (const caminho of paginas) {
    for (const { tipo, headers } of variacoes) {
      const cenario = `${tipo} ${caminho}`
      let resposta = await request.get(caminho, { headers, maxRedirects: 0 })
      if (headers.RSC && resposta.status() === 307 && resposta.headers().location) {
        const normalizada = new URL(resposta.headers().location, 'http://127.0.0.1:14321')
        if (normalizada.pathname === caminho) {
          expect(normalizada.origin, cenario).toBe('http://127.0.0.1:14321')
          expect([...normalizada.searchParams.keys()]).toEqual(['_rsc'])
          resposta = await request.get(normalizada.href, { headers, maxRedirects: 0 })
        }
      }
      expect([200, 307, 308], cenario).toContain(resposta.status())
      const corpo = await resposta.text()
      if (resposta.status() >= 300) expect(resposta.headers().location, cenario).toBe('/account')
      else {
        expect(resposta.headers()['content-type'], cenario).toContain(tipo === 'HTML' ? 'text/html' : 'text/x-component')
        if (tipo === 'prefetch') {
          expect(corpo, cenario).not.toBe('')
          expect(corpo, cenario).toContain('"f":')
        } else expect(corpo, cenario).toContain('/account')
      }
      expect(corpo, cenario).not.toMatch(/usuarioId|compradorId|compradorNome|configuracoesAtelie|pedidosPendentes/)
      expect(corpo, cenario).not.toMatch(/ResumoItensPedido|PedidosPendentes|CaixaConversas|FormAvaliacao|FormMediacao|CheckoutFormulario/)
      expect(await eventosDoTeste(request), cenario).toEqual([])
    }
  }
  expect((await eventosDoTeste(request)).filter(acessoPrivado)).toEqual([])
})
test('logout indisponível limpa a tela, informa pendência e permite nova tentativa', async ({ page, request }) => {
  await login(page)
  await request.post(`${controle}/__test/config`, { data: { falhaLogout: true } })
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await expect(page.getByText('A saída não foi confirmada pelo servidor.', { exact: false })).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText('Conta real comprador', { exact: true })).toHaveCount(0)
  await request.post(`${controle}/__test/config`, { data: { falhaLogout: false } })
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
})
test('resposta antiga de /usuario não restaura a sessão depois do logout', async ({ page }) => {
  await login(page)
  let liberar!: () => void
  let avisarRecebida!: () => void
  const recebida = new Promise<void>((resolve) => { avisarRecebida = resolve })
  const liberada = new Promise<void>((resolve) => { liberar = resolve })
  await page.route('**/api/v1/usuario', async (rota) => {
    const resposta = await rota.fetch()
    avisarRecebida()
    await liberada
    await rota.fulfill({ response: resposta })
  })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await recebida
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  const concluida = page.waitForResponse('**/api/v1/usuario')
  liberar()
  await concluida
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  await expect(page.locator('.conta-capa-nome')).toHaveCount(0)
})
