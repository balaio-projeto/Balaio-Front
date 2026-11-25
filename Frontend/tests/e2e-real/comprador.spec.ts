import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { carimbo, entrarPelaTela, estadoDataset, semFakeApi } from './apoio/navegador'
import { contaComSessao, inserirPedidoPago } from './apoio/pilha'
import { CONTAS, PECAS, SENHA_CONTAS_TESTE } from './dados/dataset'

test.describe('comprador', () => {
  test('cadastro, logout e login pela tela com sessão HttpOnly', async ({ page, context }) => {
    const conferir = semFakeApi(page)
    const email = `qa-e2e-comprador-${carimbo()}@teste.local`
    await page.goto('/login/register')
    await page.locator('input[name="perfil"][value="comprador"]').check()
    await page.locator('#cadastro-nome').fill('Compradora E2E Real')
    await page.locator('#cadastro-email').fill(email)
    await page.locator('#cadastro-senha').fill(SENHA_CONTAS_TESTE)
    await page.getByRole('button', { name: 'Criar minha conta' }).click()
    await expect(page).toHaveURL(/\/account$/)
    const sessao = (await context.cookies()).find((cookie) => cookie.name === 'balaio_sessao')
    expect(sessao?.httpOnly).toBe(true)
    await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
    await expect(page).toHaveURL(/\/login(?:\?|$)/)
    await entrarPelaTela(page, email, SENHA_CONTAS_TESTE, /\/account$/)
    conferir()
  })

  test('endereço com CEP preenchido pelo ViaCEP fica salvo na conta', async ({ page }) => {
    const email = `qa-e2e-endereco-${carimbo()}@teste.local`
    await contaComSessao({ nome: 'Comprador Endereço E2E', email, senha: SENHA_CONTAS_TESTE, perfil: 'comprador' })
    await entrarPelaTela(page, email, SENHA_CONTAS_TESTE, /\/account$/)
    await page.goto('/account/addresses')
    await page.getByRole('button', { name: 'Adicionar endereço' }).click()
    await page.locator('#end-apelido').fill('Trabalho')
    await page.locator('#end-cep').fill('01310100')
    await expect(page.locator('#end-cidade')).toHaveValue('São Paulo')
    await expect(page.locator('#end-rua')).toHaveValue(/Avenida Paulista/)
    await expect(page.locator('#end-numero')).toBeFocused()
    await page.locator('#end-numero').fill('1578')
    await page.locator('#end-complemento').fill('Conjunto 4')
    await page.getByRole('button', { name: 'Salvar endereço' }).click()
    await expect(page.getByText('Trabalho').first()).toBeVisible()
    await page.reload()
    await expect(page.getByText('Avenida Paulista, 1578 - Conjunto 4').first()).toBeVisible()
  })

  test('sacola e checkout com endereço salvo chegam ao pagamento ou ao 503 documentado', async ({ page }) => {
    const conferir = semFakeApi(page)
    const { pecas } = estadoDataset()
    await entrarPelaTela(page, CONTAS.comprador.email, CONTAS.comprador.senha, /\/account$/)
    await page.goto(`/pieces/${pecas.disponivel.slug}`)
    await page.getByRole('button', { name: 'Adicionar à sacola' }).click()
    await page.goto('/cart')
    await expect(page.getByText(PECAS.disponivel.nome).first()).toBeVisible()
    await page.getByRole('link', { name: 'Ir para o pagamento' }).click()
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.getByText('Casa QA').first()).toBeVisible()
    await expect(page.locator('input[name="frete"]').first()).toBeVisible()
    await page.locator('input[name="frete"]').first().check()
    const checkout = page.waitForResponse((resposta) => resposta.url().endsWith('/api/v1/checkout') && resposta.request().method() === 'POST')
    await page.getByRole('button', { name: /Confirmar compra/ }).click()
    const resposta = await checkout
    if (resposta.status() === 503) {
      const corpo = await resposta.json()
      expect(corpo.erro.codigo).toBe('PAGAMENTO_INDISPONIVEL')
      await expect(page.getByText('Pagamento não configurado.').first()).toBeVisible()
    } else {
      expect(resposta.status()).toBe(201)
      await expect(page).toHaveURL(/sandbox\.mercadopago\.com/)
    }
    conferir()
  })

  test('pedido entregue mostra rastreio e aceita avaliação', async ({ page }) => {
    const { artesao, pecas } = estadoDataset()
    const email = `qa-e2e-avaliacao-${carimbo()}@teste.local`
    const comprador = await contaComSessao({ nome: 'Comprador Avaliação E2E', email, senha: SENHA_CONTAS_TESTE, perfil: 'comprador' })
    const pedidoId = randomUUID()
    const rastreio = `QA${carimbo()}BR`
    inserirPedidoPago({
      id: pedidoId, compradorId: comprador.usuario!.id, artesaoId: artesao.id,
      slug: pecas.disponivel.slug, preco: pecas.disponivel.preco, disponibilidade: 'disponivel', estado: 'entregue', rastreio,
    })
    await entrarPelaTela(page, email, SENHA_CONTAS_TESTE, /\/account$/)
    await page.goto(`/orders/${pedidoId}`)
    await expect(page.getByText(rastreio).first()).toBeVisible()
    await page.getByRole('link', { name: 'Avaliar compra' }).click()
    await expect(page).toHaveURL(new RegExp(`/orders/${pedidoId}/review$`))
    await page.getByRole('radio', { name: '5 de 5' }).click()
    await page.locator('#comentario').fill('Peça chegou bem embalada; avaliação do roteiro E2E real.')
    await page.getByRole('button', { name: 'Enviar avaliação' }).click()
    await expect(page).toHaveURL(new RegExp(`/orders/${pedidoId}$`))
    await expect(page.getByRole('link', { name: 'Avaliar compra' })).toHaveCount(0)
    const avaliacao = await comprador.requisitar<{ nota: number }>('GET', `/pedidos/${pedidoId}/avaliacao`)
    expect(avaliacao.status).toBe(200)
  })
})
