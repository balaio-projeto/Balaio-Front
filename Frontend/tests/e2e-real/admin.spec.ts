import { expect, test } from '@playwright/test'
import { carimbo, entrarPelaTela, estadoDataset, semFakeApi } from './apoio/navegador'
import { contaComSessao, credenciaisAdmin, exigir } from './apoio/pilha'
import { CONTAS, EVENTO_PENDENTE, FOTO_PECA_PNG_BASE64, PECAS, SENHA_CONTAS_TESTE } from './dados/dataset'

test.describe('admin', () => {
  test.beforeEach(async ({ page }) => {
    const { email, senha } = credenciaisAdmin()
    await entrarPelaTela(page, email, senha, /\/admin/)
  })

  test('aprova evento submetido pelo organizador e ele aparece na agenda pública', async ({ page }) => {
    const conferir = semFakeApi(page)
    const { artesao } = estadoDataset()
    const nome = `Festival E2E Moderação ${carimbo()}`
    const organizador = await contaComSessao(CONTAS.organizador)
    await exigir(organizador.requisitar('POST', '/eventos', {
      ...EVENTO_PENDENTE, slug: nome.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-'),
      nome, tipo: 'festival', periodo: '15 de janeiro, 2027', artesaos: [artesao.slug],
    }), [201], 'submissão do evento a moderar')
    await page.goto('/admin/events')
    const cartao = page.locator('li.cartao-curadoria').filter({ hasText: nome, visible: true })
    await cartao.getByRole('button', { name: 'Aprovar' }).click()
    const decisao = page.waitForResponse((resposta) => /\/api\/v1\/admin\/eventos\/[^/]+\/decisao$/.test(resposta.url()))
    await cartao.getByRole('button', { name: 'Confirmar aprovação' }).click()
    expect((await decisao).status()).toBe(200)
    await expect(page.getByText('Evento aprovado e publicado').first()).toBeVisible()
    await page.goto('/events')
    await expect(page.getByText(nome).first()).toBeVisible()
    conferir()
  })

  test('concede o selo na curadoria a um artesão com peça publicada', async ({ page }) => {
    const nomeArtesao = `Artesã Selo E2E ${carimbo()}`
    const artesao = await contaComSessao({ nome: nomeArtesao, email: `qa-e2e-selo-${carimbo()}@teste.local`, senha: SENHA_CONTAS_TESTE, perfil: 'artesao' })
    await exigir(artesao.requisitar('POST', '/pecas', {
      ...PECAS.disponivel, nome: `Peça do selo ${carimbo()}`, situacao: 'publicada',
      fotos: [{ id: 'f0', nome: 'foto-peca.png', url: `data:image/png;base64,${FOTO_PECA_PNG_BASE64}` }],
    }), [201], 'peça do artesão da curadoria')
    await exigir(artesao.requisitar('POST', '/artesao/selo', { mensagem: 'Trabalho com barro há 15 anos na Mata Norte; peças no catálogo.' }), [200, 201], 'pedido de selo')
    await page.goto('/admin')
    const cartao = page.locator('li.cartao-curadoria').filter({ hasText: nomeArtesao, visible: true })
    await cartao.getByRole('button', { name: 'Conceder selo' }).click()
    await cartao.getByRole('button', { name: 'Confirmar selo' }).click()
    await expect(page.getByText('Selo de verificado concedido').first()).toBeVisible()
    const selo = await exigir<{ estado?: string; situacao?: string }>(artesao.requisitar('GET', '/artesao/selo'), [200], 'estado do selo')
    expect(JSON.stringify(selo)).toMatch(/aprovad|concedid|verificad/i)
  })

  test('fila de eventos pendentes mostra o evento do dataset', async ({ page }) => {
    await page.goto('/admin/events')
    await expect(page.locator('li.cartao-curadoria').filter({ hasText: EVENTO_PENDENTE.nome, visible: true })).toBeVisible()
  })
})
