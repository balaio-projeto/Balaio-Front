/* Fluxo real em ambiente descartável criado por Profile/scripts/test-pi177-runtime.py. */
const { chromium, expect: baseExpect } = require('@playwright/test')
const expect = baseExpect.configure({ timeout: 20000 })

async function main() {
  const baseURL = process.env.PI177_BASE_URL
  if (!baseURL) throw new Error('Execute pelo script de runtime do PI-177.')
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const artisan = await browser.newContext({ baseURL })
  const admin = await browser.newContext({ baseURL })
  const page = await artisan.newPage()
  const queue = await admin.newPage()
  async function login(target, email, senha, destino) {
    await target.goto(`/login?proximo=${destino}`)
    await target.locator('#email:visible').fill(email)
    await target.locator('#senha:visible').fill(senha)
    await target.locator('#conteudo:visible').getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(target).toHaveURL(new RegExp(`${destino}$`))
  }
  try {
    await login(page, process.env.PI177_ARTESAO_EMAIL, process.env.PI177_ARTESAO_SENHA, '/dashboard/settings')
    if (process.env.PI177_EXPECT_SELO_FAILURE === '1') {
      await expect(page.getByText('Serviço temporariamente indisponível.', { exact: true })).toBeVisible()
      await expect(page.locator('#mensagem-selo')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Solicitar selo', exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Enviar novamente', exact: true })).toHaveCount(0)
      console.log('PI-177 navegador real: falha HTTP no selo exibida; formulário de reenvio não é apresentado.')
      return
    }
    await expect(page.locator('#mensagem-selo')).toBeVisible()
    await expect(page.getByText('Entre na sua conta para continuar.', { exact: true })).toHaveCount(0)
    const cookie = (await artisan.cookies()).find((item) => item.name === 'balaio_sessao')
    expect(cookie.httpOnly).toBe(true)
    expect(await page.content()).not.toContain(cookie.value)
    expect(await page.evaluate(() => document.cookie)).not.toContain('balaio_sessao')
    await page.locator('#mensagem-selo').fill('Confirmar autoria pelo navegador')
    await page.getByRole('button', { name: 'Solicitar selo', exact: true }).click()
    await expect(page.locator('#conteudo:visible').getByText('Em análise', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.locator('#conteudo:visible').getByText('Em análise', { exact: true })).toBeVisible()
    await login(queue, process.env.PI177_ADMIN_EMAIL, process.env.PI177_ADMIN_SENHA, '/admin')
    await expect(queue.getByRole('heading', { name: 'Fila de curadoria', exact: true })).toBeVisible()
    await expect(queue.getByText('Não foi possível consultar os coletivos.', { exact: false })).toBeVisible()
    const card = queue.locator('.cartao-curadoria').filter({ hasText: 'Ateliê Navegador PI177' })
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: 'Pedir ajuste', exact: true }).click()
    await card.locator('textarea').fill('Confirme a associação do território')
    await card.getByRole('button', { name: 'Enviar pedido de ajuste', exact: true }).click()
    await expect(card).toHaveCount(0)
    await page.reload()
    await expect(page.getByText('Confirme a associação do território', { exact: false })).toBeVisible()
    await page.locator('#mensagem-selo').fill('Associação confirmada')
    await page.getByRole('button', { name: 'Enviar novamente', exact: true }).click()
    await expect(page.locator('#conteudo:visible').getByText('Em análise', { exact: true })).toBeVisible()
    await queue.reload()
    await expect(card).toContainText('Associação confirmada')
    await card.getByRole('button', { name: 'Conceder selo', exact: true }).click()
    await card.getByRole('button', { name: 'Confirmar selo', exact: true }).click()
    await expect(card).toHaveCount(0)
    await expect(queue.locator('#conteudo:visible .subtitulo-pagina:visible').first()).toContainText('2 artesãos verificados')
    await queue.reload()
    await expect(queue.locator('#conteudo:visible .subtitulo-pagina:visible').first()).toContainText('2 artesãos verificados')
    await page.reload()
    await expect(page.locator('#conteudo:visible').getByText('Selo ativo', { exact: true })).toBeVisible()
    await page.goto(`/artisans/${process.env.PI177_SLUG}`)
    await expect(page.getByText('Artesão verificado.', { exact: true })).toBeVisible()
    console.log('PI-177 navegador real: solicitação, ajuste, reenvio, aprovação, selo público, sessão HttpOnly e coletivos indisponíveis aprovados.')
  } catch (error) {
    await page.screenshot({ path: 'test-results/pi177-artesao-failure.png', fullPage: true }).catch(() => {})
    await queue.screenshot({ path: 'test-results/pi177-admin-failure.png', fullPage: true }).catch(() => {})
    throw error
  } finally {
    await artisan.close()
    await admin.close()
    await browser.close()
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
