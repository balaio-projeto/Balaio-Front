import { expect, test } from '@playwright/test'
import { estadoDataset, semFakeApi } from './apoio/navegador'
import { PECAS } from './dados/dataset'

test.describe('visitante', () => {
  test('vitrine lista peças publicadas pelo gateway', async ({ page }) => {
    const conferir = semFakeApi(page)
    const listagem = page.waitForResponse((resposta) => resposta.url().includes('/api/v1/') && resposta.status() < 500)
    await page.goto('/')
    await expect(page.locator('a[href^="/pieces/"]').first()).toBeVisible()
    await listagem.catch(() => null)
    conferir()
  })

  test('busca com faixa de preço filtra as peças do dataset', async ({ page }) => {
    const conferir = semFakeApi(page)
    await page.goto('/search?q=QA')
    await expect(page.getByRole('heading', { level: 1, name: /Resultados para "QA"/ })).toBeVisible()
    await expect(page.getByText(/Exibindo \d+.\d+ de \d+ peças/)).toBeVisible()
    const minimo = page.locator('input[name="precoMin"]')
    if (!(await minimo.isVisible())) await page.getByRole('button', { name: /^Filtros/ }).click()
    await minimo.fill('200')
    await page.locator('input[name="precoMax"]').fill('250')
    await page.getByRole('button', { name: 'Aplicar faixa' }).click()
    await expect(page).toHaveURL(/precoMin=200/)
    await expect(page).toHaveURL(/precoMax=250/)
    await expect(page.getByText(PECAS.encomenda.nome).first()).toBeVisible()
    await expect(page.getByText(PECAS.disponivel.nome)).toHaveCount(0)
    await expect(page.getByText(PECAS.unica.nome)).toHaveCount(0)
    conferir()
  })

  test('página da peça mostra foto do storage, preço e frete', async ({ page, request }) => {
    const { pecas } = estadoDataset()
    await page.goto(`/pieces/${pecas.disponivel.slug}`)
    await expect(page.getByRole('heading', { name: PECAS.disponivel.nome })).toBeVisible()
    const foto = page.locator('img[src*="/api/v1/arquivos/pecas/"]').first()
    await expect(foto).toBeVisible()
    const src = await foto.getAttribute('src')
    const arquivo = await request.get(new URL(src!, page.url()).href)
    expect(arquivo.status()).toBe(200)
    expect(arquivo.headers()['content-type']).toMatch(/^image\//)
    await expect(page.getByRole('button', { name: 'Adicionar à sacola' })).toBeVisible()
  })

  test('agenda pública mostra eventos publicados e o detalhe abre', async ({ page }) => {
    const conferir = semFakeApi(page)
    await page.goto('/events')
    const link = page.locator('a[href^="/events/"]:not([href="/events/new"])').first()
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(/\/events\/[^/]+$/)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(page.getByText('Onde vai ser')).toBeVisible()
    conferir()
  })
})
