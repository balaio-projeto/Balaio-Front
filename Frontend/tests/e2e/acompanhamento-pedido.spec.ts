import { test, expect } from '@playwright/test'

const controle = 'http://127.0.0.1:18080'

test('comprador vê snapshot, etapas reais, conversa persistida e 404 alheio', async ({ page, request }) => {
  await request.post(`${controle}/__test/reset`)
  await request.post(`${controle}/__test/config`, { data: { pedidoComprador: {
    id: 'pedido-qa', pecaSlug: 'peca-qa', compradorNome: 'Comprador', data: '20/11/2026',
    total: 138.9, estado: 'producao', itens: [{ slug: 'peca-qa', quantidade: 2, preco: 50 }],
    endereco: { cep: '52021030', endereco: 'Rua da compra', cidade: 'Recife', estado: 'PE' },
    etapas: [
      { estado: 'aguardando_reserva', titulo: 'Compra registrada', detalhe: 'Pedido criado.', concluida: true, atual: false },
      { estado: 'producao', titulo: 'Produção iniciada', detalhe: 'O artesão começou.', concluida: true, atual: true },
    ],
  } } })
  await page.goto('/login')
  await page.locator('#email').fill('comprador@auth.test')
  await page.locator('#senha').fill('SenhaDeTeste123!')
  await page.locator('#conteudo').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
  await page.goto('/orders')
  await expect(page.getByText('R$ 138,90')).toBeVisible()
  await page.goto('/orders/pedido-qa')
  await expect(page.getByText('Produção iniciada')).toBeVisible()
  await expect(page.getByText('O artesão começou.')).toBeVisible()
  await expect(page.getByText('R$ 50,00 por unidade na compra')).toBeVisible()
  await expect(page.getByText(/Rua da compra, Recife\/PE/)).toBeVisible()
  const chaves: string[] = []
  await page.route('**/api/v1/pedidos/pedido-qa/conversa', async (rota) => {
    if (rota.request().method() !== 'POST') return rota.continue()
    chaves.push(rota.request().headers()['idempotency-key'] ?? '')
    if (chaves.length === 1) return rota.fulfill({ status: 503,
      json: { dados: null, erro: { codigo: 'ERRO_REDE', mensagem: 'Resposta perdida.' } } })
    return rota.continue()
  })
  await page.getByPlaceholder('Escreva sua mensagem...').fill('Olá, como está o pedido?')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  await expect(page.getByText('Resposta perdida. Sua mensagem foi mantida.')).toBeVisible()
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  expect(chaves).toHaveLength(2)
  expect(chaves[0]).toBeTruthy()
  expect(chaves[1]).toBe(chaves[0])
  await expect(page.getByText('Olá, como está o pedido?')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Olá, como está o pedido?')).toBeVisible()
  await page.goto('/orders/outro-pedido')
  await expect(page.getByRole('heading', { name: 'Esta peça não está mais aqui' })).toBeVisible()
})
