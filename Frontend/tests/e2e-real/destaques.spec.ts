import { expect, test } from '@playwright/test'

const API = process.env.E2E_REAL_API_URL ?? 'http://localhost:8080'

// TC41 (TS24): a faixa "Destaques da semana" da home mostra somente peças publicadas e ativas.
test('home mostra destaques apenas de peças publicadas', async ({ page, request }) => {
  const resposta = await request.get(`${API}/api/v1/pecas?tamanho=100`)
  expect(resposta.ok()).toBeTruthy()
  const { dados } = (await resposta.json()) as { dados: { slug: string }[] }
  const publicadas = new Set(dados.map((peca) => peca.slug))

  await page.goto('/')

  const carrossel = page.getByRole('region', { name: 'Destaques da semana' })
  const links = carrossel.locator('a[href^="/pieces/"]')
  await expect(links.first()).toBeVisible()

  const slugs = await links.evaluateAll((elementos) =>
    elementos.map((elemento) => (elemento.getAttribute('href') ?? '').replace('/pieces/', '')),
  )
  expect(new Set(slugs).size).toBeGreaterThan(0)
  for (const slug of slugs) {
    expect(publicadas.has(slug), `destaque ${slug} não está publicado`).toBeTruthy()
  }
})
