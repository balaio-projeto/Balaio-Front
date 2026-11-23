import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { aceitarConfirmacoes, carimbo, entrarPelaTela, estadoDataset, semFakeApi } from './apoio/navegador'
import { contaComSessao, exigir, inserirPedidoPago, SessaoApi } from './apoio/pilha'
import { CONTAS } from './dados/dataset'

type PecaPainel = { slug: string; nome: string; inativadoEm?: string | null; fotos?: { url: string }[] }

const nomePeca = `Jarra E2E Real ${carimbo()}`
const precoPeca = 100 + (Number(carimbo()) % 800)
let artesao: SessaoApi

async function pecaPeloNome(nome: string) {
  const { artesao: dados } = estadoDataset()
  const pecas = await exigir<PecaPainel[]>(artesao.requisitar('GET', `/artesaos/${dados.slug}/pecas/painel`), [200], 'painel do artesão')
  return pecas.find((peca) => peca.nome === nome)
}

const cartaoDaPeca = (page: Page) => page.locator('article.peca-painel').filter({ has: page.getByRole('link', { name: nomePeca, exact: true }) })

test.describe.serial('artesão', () => {
  test.beforeAll(async () => { artesao = await contaComSessao(CONTAS.artesao) })

  test.beforeEach(async ({ page }) => {
    aceitarConfirmacoes(page)
    await entrarPelaTela(page, CONTAS.artesao.email, CONTAS.artesao.senha, /\/dashboard/)
  })

  test('cadastra peça com foto pelo painel e a foto fica no storage', async ({ page, request }) => {
    const conferir = semFakeApi(page)
    await page.goto('/dashboard/pieces/new')
    await page.locator('#peca-nome').fill(nomePeca)
    await page.locator('#peca-historia').fill('Jarra cadastrada pelo roteiro E2E contra a pilha real.')
    await page.locator('input[type="file"]').setInputFiles(path.resolve(__dirname, 'dados/foto-peca.png'))
    await expect(page.getByText('1 de').first()).toBeVisible()
    await page.getByText('Tenho pronta para enviar').click()
    await page.locator('#peca-preco').fill(String(precoPeca))
    await page.getByRole('button', { name: 'Publicar peça' }).click()
    await expect(page).toHaveURL(/\/dashboard\/pieces$/)
    await expect(cartaoDaPeca(page)).toBeVisible()
    const peca = await pecaPeloNome(nomePeca)
    expect(peca?.fotos?.[0]?.url).toMatch(/^\/api\/v1\/arquivos\/pecas\//)
    const foto = await request.get(peca!.fotos![0].url)
    expect(foto.status()).toBe(200)
    expect(foto.headers()['content-type']).toMatch(/^image\//)
    conferir()
  })

  test('inativa e reativa a peça pela lista do painel', async ({ page, request }) => {
    const peca = await pecaPeloNome(nomePeca)
    await page.goto('/dashboard/pieces')
    await cartaoDaPeca(page).getByRole('button', { name: 'Inativar' }).click()
    await expect(cartaoDaPeca(page).getByRole('button', { name: 'Reativar' })).toBeVisible()
    expect((await request.get(`/api/v1/pecas/${peca!.slug}`)).status()).toBe(404)
    await cartaoDaPeca(page).getByRole('button', { name: 'Reativar' }).click()
    await expect(cartaoDaPeca(page).getByRole('button', { name: 'Inativar' })).toBeVisible()
    expect((await request.get(`/api/v1/pecas/${peca!.slug}`)).status()).toBe(200)
  })

  test('aceita, marca enviado com rastreio e marca entregue', async ({ page }) => {
    const { artesao: dados, comprador } = estadoDataset()
    const peca = await pecaPeloNome(nomePeca)
    const pedidoId = randomUUID()
    const rastreio = `QA${carimbo()}BR`
    inserirPedidoPago({ id: pedidoId, compradorId: comprador.id, artesaoId: dados.id, slug: peca!.slug, preco: precoPeca, disponibilidade: 'disponivel', estado: 'confirmado' })
    await page.goto('/dashboard')
    const pendente = page.locator('article.linha-pedido').filter({ hasText: nomePeca }).filter({ has: page.getByRole('button', { name: 'Aceitar pedido' }) })
    await pendente.getByRole('button', { name: 'Aceitar pedido' }).click()
    const emAndamento = page.locator('article.linha-pedido').filter({ hasText: nomePeca }).filter({ has: page.getByRole('button', { name: /Marcar como/ }) })
    await emAndamento.getByRole('button', { name: 'Marcar como enviado' }).click()
    await page.locator('#rastreio-envio').fill(rastreio)
    await page.locator('#transportadora-envio').fill('Correios')
    await page.getByRole('button', { name: 'Confirmar envio' }).click()
    await expect(emAndamento.getByText(rastreio)).toBeVisible()
    await emAndamento.getByRole('button', { name: 'Marcar como entregue' }).click()
    await expect(page.locator('article.linha-pedido').filter({ hasText: nomePeca })).toHaveCount(0)
    const compradorDoPedido = await contaComSessao(CONTAS.comprador)
    const pedido = await exigir<{ estado: string; rastreio: string }>(compradorDoPedido.requisitar('GET', `/pedidos/${pedidoId}`), [200], 'pedido visto pelo comprador')
    expect(pedido.estado).toBe('entregue')
    expect(pedido.rastreio).toBe(rastreio)
  })

  test('relatório de vendas e resumo do painel vêm do commerce', async ({ page }) => {
    await page.goto('/dashboard/sales?periodo=30d')
    await expect(page.getByRole('heading', { name: 'Vendas e faturamento' })).toBeVisible()
    await expect(page.getByText('Receita no período')).toBeVisible()
    await expect(page.getByText(nomePeca).first()).toBeVisible()
    const relatorio = await exigir<{ quantidadePedidos: number; ranking: unknown[] }>(artesao.requisitar('GET', '/artesao/vendas/relatorio?periodo=30d'), [200], 'relatório de vendas')
    expect(relatorio.quantidadePedidos).toBeGreaterThan(0)
    const resumo = await exigir<Record<string, unknown>>(artesao.requisitar('GET', '/artesao/painel/resumo'), [200], 'resumo do painel')
    expect(resumo).toHaveProperty('pecasAtivas')
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Gerenciamento de pedidos' })).toBeVisible()
  })
})
