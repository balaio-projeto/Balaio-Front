import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'

const controle = 'http://127.0.0.1:18080'
const senha = 'SenhaDeTeste123!'

test('PI-209: conta, senha e configuracoes SSR autenticadas persistem na recarga e novo login', async ({ page, request, context }) => {
  await request.post(`${controle}/__test/reset`)
  const email = `pi209-${randomUUID()}@auth.test`
  const cadastro = await request.post(`${controle}/api/v1/auth/cadastro`, {
    data: { nome: 'Pessoa PI209', email, senha, perfil: 'artesao' },
  })
  expect(cadastro.status()).toBe(201)
  const conta = (await cadastro.json()).dados
  // A preparacao chama o backend de teste diretamente, sem o proxy da aplicacao.
  // Remover seu cookie /api/v1 evita misturar escopos no login real abaixo.
  await context.clearCookies()
  await page.goto('/login?proximo=/account')
  await page.locator('#email:visible').fill(email)
  await page.locator('#senha:visible').fill(senha)
  await page.locator('#conteudo:visible').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.locator('.conta-capa')).toContainText(email)
  await page.locator('.menu-perfil-gatilho:visible').click()
  const loja = page.locator('.menu-perfil-painel:visible').getByRole('link', { name: 'Ver minha loja', exact: true })
  const enderecoLoja = `/artisans/artesao-${conta.id}`
  await expect(loja).toHaveAttribute('href', enderecoLoja)
  await loja.click()
  await expect(page).toHaveURL(new RegExp(`${enderecoLoja}$`))
  await expect(page.locator('.capa-artesao:visible')).toBeVisible()
  await page.goto('/account')
  await page.locator('.conta-hub').getByRole('link', { name: 'Perfil do ateliê' }).click()
  await expect(page.locator('.menu-ver-loja:visible')).toHaveAttribute('href', enderecoLoja)
  await expect(page.locator('#cfg-cep')).toBeVisible()
  await expect(page.getByText('Entre na sua conta para continuar.', { exact: true })).toHaveCount(0)
  await page.locator('#cfg-cep').fill('55880-000')
  await page.locator('#cfg-prazo').fill('12')
  await page.locator('input[name=aceitaEncomendas]').check()
  await page.getByRole('button', { name: 'Salvar envio', exact: true }).click()
  await expect(page.getByText('Preferências de envio salvas', { exact: true })).toBeVisible()
  await page.locator('#cfg-pix').fill('privada@pi209.test')
  await page.getByRole('button', { name: 'Atualizar chave', exact: true }).click()
  await expect(page.getByText('Chave Pix atualizada', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('#cfg-cep')).toHaveValue('55880-000')
  await expect(page.locator('#cfg-prazo')).toHaveValue('12')
  await expect(page.locator('#cfg-pix')).toHaveValue('privada@pi209.test')
  await expect(page.locator('input[name=aceitaEncomendas]')).toBeChecked()
  const eventos = (await (await request.get(`${controle}/__test/eventos`)).json()).dados as { caminho: string; metodo: string; bearer: boolean }[]
  const consultas = eventos.filter((e) => e.metodo === 'GET' && e.caminho.endsWith('/configuracoes'))
  expect(consultas.length).toBeGreaterThan(0)
  expect(consultas.every((e) => e.bearer)).toBe(true)
  const cookie = (await context.cookies()).find((c) => c.name === 'balaio_sessao')!
  expect(cookie.httpOnly).toBe(true)
  expect(await page.content()).not.toContain(cookie.value)
  expect(await page.evaluate(() => document.cookie)).not.toContain('balaio_sessao')

  await page.locator('.menu-perfil-gatilho:visible').click()
  await page.locator('.menu-perfil-painel:visible').getByRole('link', { name: 'Meus dados', exact: true }).click()
  await expect(page).toHaveURL(/\/account\/details$/)
  await page.locator('#conta-nome').fill('Nome PI209 atualizado')
  const novoEmail = `novo-${randomUUID()}@auth.test`
  await page.locator('#conta-email').fill(novoEmail)
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
  await expect(page.getByText('Dados da conta salvos', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('#conta-nome')).toHaveValue('Nome PI209 atualizado')
  await expect(page.locator('#conta-email')).toHaveValue(novoEmail)
  await page.locator('#senha-atual').fill(senha)
  await page.locator('#senha-nova').fill('NovaSenhaPI209456!')
  await page.locator('#senha-confirmacao').fill('NovaSenhaPI209456!')
  const trocou = page.waitForResponse((r) => r.url().endsWith('/api/v1/auth/alterar-senha') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Alterar senha', exact: true }).click()
  expect((await trocou).status()).toBe(200)
  await context.clearCookies()
  await page.goto('/login?proximo=/account')
  await page.locator('#email:visible').fill(novoEmail)
  await page.locator('#senha:visible').fill('NovaSenhaPI209456!')
  await page.locator('#conteudo:visible').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.locator('.conta-capa')).toContainText('Nome PI209 atualizado')
  await page.goto('/dashboard/settings')
  await expect(page.locator('#cfg-prazo')).toHaveValue('12')
})
