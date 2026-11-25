import { expect, test } from '@playwright/test'
import { carimbo, entrarPelaTela, estadoDataset, semFakeApi } from './apoio/navegador'
import { exigir, sessaoAdmin } from './apoio/pilha'
import { CONTAS } from './dados/dataset'

test.describe('organizador', () => {
  test('submete evento pela tela e ele entra pendente na fila do admin', async ({ page }) => {
    const conferir = semFakeApi(page)
    const { artesao } = estadoDataset()
    const nome = `Feira E2E Organizador ${carimbo()}`
    await entrarPelaTela(page, CONTAS.organizador.email, CONTAS.organizador.senha, /\/(account|events)/)
    await page.goto('/events/new')
    await page.locator('#evento-nome').fill(nome)
    await page.locator('#evento-organizador').fill('Organização QA Feiras')
    await page.locator('#evento-descricao').fill('Feira submetida pelo roteiro E2E real do organizador.')
    await page.locator('#evento-data-inicio').fill('2027-01-10')
    await page.locator('#evento-data-fim').fill('2027-01-11')
    await page.locator('#evento-local').fill('Cais da Alfândega')
    await page.locator('#evento-cidade').fill('Recife')
    await page.locator('#evento-rua').fill('Rua da Alfândega')
    await page.locator('#evento-numero').fill('35')
    await page.locator('#evento-bairro').fill('Recife Antigo')
    await page.locator('.mapa-eventos-escolha').click()
    await page.locator('#evento-contato-nome').fill('Pessoa Responsável QA')
    await page.locator('#evento-contato-telefone').fill('81999990000')
    await page.locator(`#participante-${artesao.slug}`).check()
    const envio = page.waitForResponse((resposta) => resposta.url().endsWith('/api/v1/eventos') && resposta.request().method() === 'POST')
    await page.getByRole('button', { name: 'Enviar para análise' }).click()
    expect((await envio).status()).toBe(201)
    await expect(page.getByRole('heading', { name: 'Evento enviado!' })).toBeVisible()
    const admin = await sessaoAdmin()
    const fila = await exigir<unknown[]>(admin.requisitar('GET', '/admin/eventos?estado=PENDENTE'), [200], 'fila de moderação')
    expect(JSON.stringify(fila)).toContain(nome)
    conferir()
  })

  test('formulário vazio destaca os campos obrigatórios', async ({ page }) => {
    await entrarPelaTela(page, CONTAS.organizador.email, CONTAS.organizador.senha, /\/(account|events)/)
    await page.goto('/events/new')
    await page.getByRole('button', { name: 'Enviar para análise' }).click()
    await expect(page.getByText('Dê um nome ao evento').first()).toBeVisible()
  })
})
