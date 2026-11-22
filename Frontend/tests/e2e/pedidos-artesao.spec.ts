import { test, expect } from '@playwright/test'

const controle = 'http://127.0.0.1:18080'

test('falha mantém pedido; sucesso atualiza lista após refresh', async ({ page, request }) => {
  await request.post(`${controle}/__test/reset`)
  await request.post(`${controle}/__test/config`, { data: {
    pedidosPendentes: [{ id: 'pedido-qa', pecaSlug: 'peca-qa', comprador: 'Comprador',
      quando: '20/11/2026', valor: 50 }], falhaAceite: true,
  } })
  await page.goto('/login')
  await page.locator('#email').fill('artesao@auth.test')
  await page.locator('#senha').fill('SenhaDeTeste123!')
  await page.locator('#conteudo').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const aceitar = page.getByRole('button', { name: 'Aceitar pedido' })
  await expect(aceitar).toBeVisible()
  await aceitar.click()
  await expect(aceitar).toBeEnabled()
  await expect(page.getByText('Não foi possível aceitar')).toBeVisible()
  await request.post(`${controle}/__test/config`, { data: { falhaAceite: false } })
  await aceitar.evaluate((botao: HTMLButtonElement) => botao.click())
  await expect(aceitar).toHaveCount(0)
  await expect(page.getByText('Nenhum pedido aguardando')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Nenhum pedido aguardando')).toBeVisible()
  const eventos = (await (await request.get(`${controle}/__test/eventos`)).json()).dados as
    { caminho: string; metodo: string; bearer: boolean }[]
  expect(eventos.filter((evento) => evento.caminho === '/api/v1/pedidos/pedido-qa/estado'))
    .toEqual([expect.objectContaining({ metodo: 'PATCH', bearer: true }),
      expect.objectContaining({ metodo: 'PATCH', bearer: true })])
})

test('recusa com estorno pendente não informa liberação da peça', async ({ page, request }) => {
  await request.post(`${controle}/__test/reset`)
  await request.post(`${controle}/__test/config`, { data: {
    pedidosPendentes: [{ id: 'pedido-qa', pecaSlug: 'peca-qa', comprador: 'Comprador',
      quando: '20/11/2026', valor: 50 }],
  } })
  await page.route('**/api/v1/pedidos/pedido-qa/recusar', async (rota) => {
    expect(rota.request().method()).toBe('PATCH')
    await rota.fulfill({ status: 202,
      json: { dados: { id: 'pedido-qa', estado: 'reembolso_pendente' }, erro: null } })
  })
  await page.goto('/login')
  await page.locator('#email').fill('artesao@auth.test')
  await page.locator('#senha').fill('SenhaDeTeste123!')
  await page.locator('#conteudo').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('button', { name: 'Recusar', exact: true }).click()
  await page.locator('#motivo-recusa').fill('Não consigo produzir esta peça.')
  await page.getByRole('button', { name: 'Confirmar recusa' }).click()
  await expect(page.getByText('Aguardamos a confirmação do reembolso antes de liberar a peça única no catálogo.'))
    .toBeVisible()
  await expect(page.getByText('O comprador verá o motivo e a peça única, se houver, voltou à vitrine.'))
    .toHaveCount(0)
})
