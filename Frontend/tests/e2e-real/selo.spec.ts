import { expect, test } from '@playwright/test'
import { estadoDataset } from './apoio/navegador'

const API = process.env.E2E_REAL_API_URL ?? 'http://localhost:8080'

// TC38 (TS22): o selo "Artesão verificado" aparece na peça somente quando o artesão dono da peça tem selo aprovado.
test('selo da peça reflete o estado de selo do artesão dono da peça no serviço real', async ({ page, request }) => {
  const peca = Object.values(estadoDataset().pecas)[0]

  const respostaPeca = await request.get(`${API}/api/v1/pecas/${peca.slug}`)
  expect(respostaPeca.ok()).toBeTruthy()
  const { dados: dadosPeca } = (await respostaPeca.json()) as { dados: { artesao: string } }

  const respostaArtesao = await request.get(`${API}/api/v1/artesaos/${dadosPeca.artesao}`)
  expect(respostaArtesao.ok()).toBeTruthy()
  const { dados: artesao } = (await respostaArtesao.json()) as { dados: { selo: boolean } }

  await page.goto(`/pieces/${peca.slug}`)
  // Escopo: a seção "sobre o artesão" da peça. Outros cartões da página (relacionadas) podem ter selo próprio.
  const selo = page.locator('.sobre-artesao').getByText('Artesão verificado', { exact: true })

  if (artesao.selo) {
    await expect(selo.first()).toBeVisible()
  } else {
    await expect(selo).toHaveCount(0)
  }
})
