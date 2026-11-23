import { test, expect, type Page } from '@playwright/test'

const controle = 'http://127.0.0.1:18080'
const png = { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=', 'base64') }
const webp = { name: 'foto.webp', mimeType: 'image/webp', buffer: Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64') }

test.beforeEach(async ({ request }) => { await request.post(`${controle}/__test/reset`) })

async function abrirPerfil(page: Page) {
  await page.goto('/login?proximo=/account')
  await page.locator('#email:visible').fill('artesao@auth.test')
  await page.locator('#senha:visible').fill('SenhaDeTeste123!')
  await page.locator('#conteudo:visible').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
  await page.locator('.conta-hub').getByRole('link', { name: 'Perfil do ateliê' }).click()
  await expect(page.locator('#cfg-atelie')).toBeVisible()
}

async function enviarFoto(page: Page, arquivo = png) {
  const resposta = page.waitForResponse((res) => res.request().method() === 'PUT' && res.url().endsWith('/api/v1/artesao/me/imagem'))
  await page.locator('input[type=file]').setInputFiles(arquivo)
  const enviada = await resposta
  expect(enviada.status()).toBe(200)
  expect(enviada.request().headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/)
  return (await enviada.json()).dados.imagem as string
}

test('perfil real, upload, painel, pagina publica, reload e HEAD usam a aplicacao', async ({ page, request, context }) => {
  await abrirPerfil(page)
  await expect(page.locator('input[name=territorio]')).toHaveValue('')
  await expect(page.locator('input[name=tecnica]')).toHaveValue('')
  expect((await context.cookies()).find((c) => c.name === 'balaio_sessao')?.httpOnly).toBe(true)
  const url = await enviarFoto(page)
  await expect(page.locator('form').filter({ has: page.locator('#cfg-atelie') }).locator('img')).toHaveAttribute('src', url)
  await expect(page.locator('.menu-oficina img').first()).toHaveAttribute('src', url)
  const head = await request.head(url)
  expect(head.status()).toBe(200)
  expect(head.headers()['content-type']).toBe('image/png')
  expect(head.headers()['content-length']).toBe(String(png.buffer.length))
  expect((await head.body()).length).toBe(0)
  await page.reload()
  await expect(page.locator('form').filter({ has: page.locator('#cfg-atelie') }).locator('img')).toHaveAttribute('src', url)
  await page.locator('form').filter({ has: page.locator('#cfg-atelie') }).getByRole('link', { name: 'Ver minha loja' }).click()
  await expect(page.locator('.capa-artesao:visible img')).toHaveAttribute('src', url)
  await expect.poll(() => page.locator('.capa-artesao:visible img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  await page.reload()
  await expect(page.locator('.capa-artesao:visible img')).toHaveAttribute('src', url)
  const eventos = (await (await request.get(`${controle}/__test/eventos`)).json()).dados as { destino: string; caminho: string }[]
  const perfilOuImagem = (p: string) => p.startsWith('/api/v1/arquivos/perfis/') || p === '/api/v1/artesao/me' || /^\/api\/v1\/artesaos\/[^/]+$/.test(p)
  expect(eventos.some((e) => e.destino === 'fake' && perfilOuImagem(e.caminho))).toBe(false)
})

test('substitui, preserva foto em falha e campos nao salvos, remove e salva texto do PI-171', async ({ page, request }) => {
  await abrirPerfil(page)
  const anterior = await enviarFoto(page)
  await page.locator('#cfg-historia').fill('Historia que ainda nao foi salva')
  await request.post(`${controle}/__test/config`, { data: { falhaImagem: true } })
  const falha = page.waitForResponse((r) => r.url().endsWith('/artesao/me/imagem') && r.status() === 503)
  await page.locator('input[type=file]').setInputFiles(webp)
  await falha
  await expect(page.locator('form').filter({ has: page.locator('#cfg-atelie') }).locator('img')).toHaveAttribute('src', anterior)
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível concluir' })).toBeVisible()
  await request.post(`${controle}/__test/config`, { data: { falhaImagem: false } })
  const atual = await enviarFoto(page, webp)
  await expect(page.locator('form').filter({ has: page.locator('#cfg-atelie') }).locator('img')).toHaveAttribute('src', atual)
  await expect(page.locator('#cfg-historia')).toHaveValue('Historia que ainda nao foi salva')
  expect((await request.get(anterior)).status()).toBe(404)
  expect((await request.head(anterior)).status()).toBe(404)
  const salvou = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/api/v1/artesaos/'))
  await page.getByRole('button', { name: 'Salvar identidade' }).click()
  expect((await salvou).status()).toBe(200)
  await page.reload()
  await expect(page.locator('#cfg-historia')).toHaveValue('Historia que ainda nao foi salva')
  await expect(page.locator('form').filter({ has: page.locator('#cfg-atelie') }).locator('img')).toHaveAttribute('src', atual)
  const removida = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().endsWith('/artesao/me/imagem'))
  await page.getByRole('button', { name: 'Remover foto' }).click()
  expect((await removida).status()).toBe(200)
  const formularioAtelie = page.locator('form').filter({ has: page.locator('#cfg-atelie') })
  await expect(formularioAtelie.locator('img')).toHaveCount(0)
  await expect(formularioAtelie.locator('.retrato-silhueta')).toBeVisible()
  expect((await request.get(atual)).status()).toBe(404)
})

test('recusa formato e tamanho antes do envio e conserva foto confirmada', async ({ page }) => {
  await abrirPerfil(page)
  const anterior = await enviarFoto(page)
  let uploads = 0
  page.on('request', (r) => { if (r.method() === 'PUT' && r.url().endsWith('/artesao/me/imagem')) uploads++ })
  await page.locator('input[type=file]').setInputFiles({ name: 'arquivo.txt', mimeType: 'text/plain', buffer: Buffer.from('texto') })
  await expect(page.getByRole('alert').filter({ hasText: 'Use uma foto' })).toBeVisible()
  await page.locator('input[type=file]').setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) })
  await expect(page.getByRole('alert').filter({ hasText: 'no máximo 2' })).toBeVisible()
  await expect(page.locator('form').filter({ has: page.locator('#cfg-atelie') }).locator('img')).toHaveAttribute('src', anterior)
  expect(uploads).toBe(0)
})

test('foto do artesao acompanha upload, substituicao e remocao na conta e nos menus', async ({ page, request }) => {
  await abrirPerfil(page)
  const menu = page.locator('.menu-perfil')
  await menu.locator('.menu-perfil-gatilho').click()
  const primeira = await enviarFoto(page)
  await expect(menu.locator('.menu-perfil-topo img')).toHaveAttribute('src', primeira)

  await page.goto('/account')
  await expect(page.locator('.conta-capa img')).toHaveAttribute('src', primeira)
  await page.reload()
  await expect(page.locator('.conta-capa img')).toHaveAttribute('src', primeira)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.nav-inferior-item[aria-haspopup="dialog"]:visible').click()
  await expect(page.locator('.folha-perfil[open] .menu-perfil-topo img')).toHaveAttribute('src', primeira)
  await page.getByRole('button', { name: 'Fechar menu', exact: true }).click()
  await page.setViewportSize({ width: 1280, height: 900 })

  await page.goto('/dashboard/settings')
  await expect(page.locator('#cfg-atelie')).toBeVisible()
  await menu.locator('.menu-perfil-gatilho').click()
  await request.post(`${controle}/__test/config`, { data: { falhaImagem: true } })
  const falha = page.waitForResponse((r) => r.url().endsWith('/artesao/me/imagem') && r.status() === 503)
  await page.locator('input[type=file]').setInputFiles(webp)
  await falha
  await expect(menu.locator('.menu-perfil-topo img')).toHaveAttribute('src', primeira)
  await request.post(`${controle}/__test/config`, { data: { falhaImagem: false } })
  const segunda = await enviarFoto(page, webp)
  await expect(menu.locator('.menu-perfil-topo img')).toHaveAttribute('src', segunda)
  await page.goto('/account')
  await expect(page.locator('.conta-capa img')).toHaveAttribute('src', segunda)

  await page.goto('/dashboard/settings')
  await expect(page.locator('#cfg-atelie')).toBeVisible()
  await menu.locator('.menu-perfil-gatilho').click()
  const removida = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().endsWith('/artesao/me/imagem'))
  await page.getByRole('button', { name: 'Remover foto' }).click()
  expect((await removida).status()).toBe(200)
  if (await menu.locator('.menu-perfil-gatilho').getAttribute('aria-expanded') !== 'true') {
    await menu.locator('.menu-perfil-gatilho').click()
  }
  await expect(menu.locator('.menu-perfil-topo img')).toHaveCount(0)
  await expect(menu.locator('.menu-perfil-topo .retrato-silhueta')).toBeVisible()
  await page.goto('/account')
  await expect(page.locator('.conta-capa img')).toHaveCount(0)
  await expect(page.locator('.conta-capa .retrato-silhueta')).toBeVisible()
})
