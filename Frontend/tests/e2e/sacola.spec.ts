import { test, expect } from '@playwright/test'

const controle = 'http://127.0.0.1:18080'
const chave = 'balaio:sacola:visitante:v1'

async function login(page: import('@playwright/test').Page, itens: { slug: string; quantidade: number }[]) {
  await page.addInitScript(({ chave, itens }) => {
    if (!sessionStorage.getItem('qa-sacola-semeada')) {
      localStorage.setItem(chave, JSON.stringify(itens))
      sessionStorage.setItem('qa-sacola-semeada', '1')
    }
  }, { chave, itens })
  await page.goto('/login')
  await page.locator('#email').fill('comprador@auth.test')
  await page.locator('#senha').fill('SenhaDeTeste123!')
  await page.locator('#conteudo').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
}

test.beforeEach(async ({ request }) => {
  await request.post(`${controle}/__test/reset`)
  await request.post(`${controle}/__test/config`, { data: { sacolaTeste: true } })
})

test('exibe preço revalidado sem aplicar desconto novamente', async ({ page, request }) => {
  await login(page, [{ slug: 'peca-valida', quantidade: 1 }])
  await request.post(`${controle}/__test/config`, { data: { precoRevalidado: 72.5 } })
  await page.goto('/cart')
  await expect(page.getByText(/Preço atualizado:.*72,50/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ir para o pagamento' })).toBeVisible()
  await expect.poll(async () => (await (await page.request.get('/api/v1/estado/sacola')).json()).dados)
    .toEqual([{ slug: 'peca-valida', quantidade: 1 }])
})

test('peça indisponível impede avançar na sacola e no checkout', async ({ page, request }) => {
  await login(page, [{ slug: 'peca-valida', quantidade: 1 }])
  await request.post(`${controle}/__test/config`, { data: { pecaIndisponivel: true } })
  await page.goto('/cart')
  await expect(page.getByText('Peça indisponível na revalidação.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ir para o pagamento' })).toHaveCount(0)
  await page.goto('/checkout')
  await expect(page.getByRole('button', { name: /Confirmar compra/ })).toBeDisabled()
})

test('falha da revalidação bloqueia checkout até nova consulta válida', async ({ page, request }) => {
  await login(page, [{ slug: 'peca-valida', quantidade: 1 }])
  await request.post(`${controle}/__test/config`, { data: { falhaRevalidacao: true } })
  await page.goto('/checkout')
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível revalidar' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Confirmar compra/ })).toBeDisabled()
  await request.post(`${controle}/__test/config`, { data: { falhaRevalidacao: false } })
  await page.getByRole('button', { name: 'Conferir novamente' }).click()
  await expect(page.getByRole('button', { name: /Confirmar compra/ })).toBeEnabled()
})

test('preço mudado após abrir checkout exige revisar antes de criar pedido', async ({ page, request }) => {
  await login(page, [{ slug: 'peca-valida', quantidade: 1 }])
  await page.goto('/checkout')
  await expect(page.getByRole('button', { name: /Confirmar compra/ })).toBeEnabled()
  await page.locator('#cep-checkout').fill('50000-000')
  await page.locator('#endereco').fill('Rua de teste')
  await page.locator('#cidade').fill('Recife')
  await page.locator('#estado').fill('PE')
  await request.post(`${controle}/__test/config`, { data: { precoRevalidado: 72.5 } })
  await page.getByRole('button', { name: /Confirmar compra/ }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'O preço ou a disponibilidade mudou' })).toBeVisible()
  await expect(page.getByText(/Preço atualizado:.*72,50/)).toBeVisible()
  const eventos = (await (await request.get(`${controle}/__test/eventos`)).json()).dados
  expect(eventos.filter((evento: { caminho: string }) => evento.caminho === '/api/v1/checkout')).toHaveLength(0)
})

test('login com peça excluída permite removê-la, repetir a mesclagem e limpar cópia local', async ({ page }) => {
  await login(page, [{ slug: 'peca-excluida', quantidade: 1 }, { slug: 'peca-valida', quantidade: 1 }])
  await page.goto('/cart')
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível mesclar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retirar e tentar mesclar' })).toHaveCount(2)
  await page.locator('.item-sacola').filter({ hasText: 'peca excluida' })
    .getByRole('button', { name: 'Retirar e tentar mesclar' }).click()
  await expect(page.locator('.item-sacola').getByRole('link', { name: 'Peça válida' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível mesclar' })).toHaveCount(0)
  await expect.poll(async () => (await (await page.request.get('/api/v1/estado/sacola')).json()).dados)
    .toEqual([{ slug: 'peca-valida', quantidade: 1 }])
  expect(await page.evaluate((chave) => localStorage.getItem(chave), chave)).toBeNull()
})

test('checkout aguarda limpeza remota e oferece retry quando PUT falha', async ({ page }) => {
  await login(page, [{ slug: 'peca-valida', quantidade: 1 }])
  await expect.poll(async () => (await (await page.request.get('/api/v1/estado/sacola')).json()).dados)
    .toEqual([{ slug: 'peca-valida', quantidade: 1 }])
  await page.goto('/checkout')
  await page.locator('#cep-checkout').fill('50000-000')
  await page.locator('#endereco').fill('Rua de teste')
  await page.locator('#cidade').fill('Recife')
  await page.locator('#estado').fill('PE')
  let liberar!: () => void
  let iniciou!: () => void
  const recebido = new Promise<void>((resolve) => { iniciou = resolve })
  const liberado = new Promise<void>((resolve) => { liberar = resolve })
  await page.route('**/api/v1/estado/sacola', async (rota) => {
    if (rota.request().method() !== 'PUT') return rota.continue()
    iniciou()
    await liberado
    await rota.fulfill({ status: 503, json: { dados: null, erro: { codigo: 'ERRO_REDE', mensagem: 'Falha de rede.' } } })
  }, { times: 1 })
  await page.route('https://sandbox.mercadopago.com/**', (rota) => rota.fulfill({ status: 200, body: 'Pagamento de teste' }))
  await page.getByRole('button', { name: /Confirmar compra/ }).click()
  await recebido
  expect(new URL(page.url()).pathname).toBe('/checkout')
  liberar()
  await expect(page.getByRole('alert').filter({ hasText: 'sacola da conta ainda não foi limpa' })).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/checkout')
  expect((await (await page.request.get('/api/v1/estado/sacola')).json()).dados).toEqual([{ slug: 'peca-valida', quantidade: 1 }])
  await page.getByRole('button', { name: /Tentar abrir pagamento/ }).click()
  await expect(page).toHaveURL(/sandbox\.mercadopago\.com/)
})

test('visitante não fica preso no carregamento se localStorage bloqueia leitura', async ({ page }) => {
  await page.addInitScript(() => {
    const ler = Storage.prototype.getItem
    Storage.prototype.getItem = function (nome) {
      if (nome.startsWith('balaio:sacola:visitante:')) throw new DOMException('Bloqueado', 'SecurityError')
      return ler.call(this, nome)
    }
  })
  await page.goto('/cart')
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível salvar a sacola neste dispositivo' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sua sacola está vazia' })).toBeVisible()
})

test('falha de escrita mantém a alteração da sacola visitante em memória e mostra aviso', async ({ page }) => {
  await page.addInitScript((chave) => {
    if (!sessionStorage.getItem('qa-sacola-semeada')) {
      localStorage.setItem(chave, JSON.stringify([{ slug: 'peca-valida', quantidade: 1 }]))
      sessionStorage.setItem('qa-sacola-semeada', '1')
    }
    const escrever = Storage.prototype.setItem
    Storage.prototype.setItem = function (nome, valor) {
      if (nome === chave) throw new DOMException('Quota', 'QuotaExceededError')
      return escrever.call(this, nome, valor)
    }
  }, chave)
  await page.goto('/cart')
  await expect(page.locator('.item-sacola').getByRole('link', { name: 'Peça válida' })).toBeVisible()
  await page.locator('.item-sacola').getByRole('button', { name: 'Remover' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível salvar a sacola neste dispositivo' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sua sacola está vazia' })).toBeVisible()
})

test('sacola visitante em memória atravessa login cliente e é mesclada à conta', async ({ page }) => {
  await page.addInitScript((chave) => {
    const escrever = Storage.prototype.setItem
    Storage.prototype.setItem = function (nome, valor) {
      if (nome === chave) throw new DOMException('Quota', 'QuotaExceededError')
      return escrever.call(this, nome, valor)
    }
  }, chave)
  await page.goto('/pieces/peca-valida')
  await page.getByRole('button', { name: 'Adicionar à sacola' }).click()
  await page.getByRole('button', { name: 'Entrar', exact: true }).first().click()
  await page.getByRole('link', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.locator('#email').fill('comprador@auth.test')
  await page.locator('#senha').fill('SenhaDeTeste123!')
  await page.locator('#conteudo').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect.poll(async () => (await (await page.request.get('/api/v1/estado/sacola')).json()).dados)
    .toEqual([{ slug: 'peca-valida', quantidade: 1 }])
  expect(await page.evaluate((chave) => localStorage.getItem(chave), chave)).toBeNull()
})

test('falha de PUT no login conserva sacola em memória para nova tentativa', async ({ page }) => {
  await page.addInitScript((chave) => {
    const escrever = Storage.prototype.setItem
    Storage.prototype.setItem = function (nome, valor) {
      if (nome === chave) throw new DOMException('Quota', 'QuotaExceededError')
      return escrever.call(this, nome, valor)
    }
  }, chave)
  await page.goto('/pieces/peca-valida')
  await page.getByRole('button', { name: 'Adicionar à sacola' }).click()
  await page.getByRole('button', { name: 'Entrar', exact: true }).first().click()
  await page.getByRole('link', { name: 'Entrar', exact: true }).click()
  let falhou = false
  await page.route('**/api/v1/estado/sacola', (rota) => {
    if (rota.request().method() !== 'PUT' || falhou) return rota.continue()
    falhou = true
    return rota.fulfill({ status: 503, json: { dados: null, erro: { codigo: 'ERRO_REDE', mensagem: 'Falha de rede.' } } })
  })
  await page.locator('#email').fill('comprador@auth.test')
  await page.locator('#senha').fill('SenhaDeTeste123!')
  await page.locator('#conteudo').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect.poll(() => falhou).toBe(true)
  await page.getByRole('link', { name: /Sacola/ }).first().click()
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível mesclar' })).toBeVisible()
  await expect(page.locator('.item-sacola').getByRole('link', { name: 'Peça válida' })).toBeVisible()
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect.poll(async () => (await (await page.request.get('/api/v1/estado/sacola')).json()).dados)
    .toEqual([{ slug: 'peca-valida', quantidade: 1 }])
})
