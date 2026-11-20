/* Executar pelo script isolado profile-service/scripts/test-pi170-runtime.py. */
const { chromium, expect: baseExpect } = require('@playwright/test')
const expect = baseExpect.configure({ timeout: 20000 })

async function main() {
  const baseURL = process.env.PI170_BASE_URL
  const mailURL = process.env.PI170_MAILPIT_URL
  if (!baseURL || !mailURL) throw new Error('Execute pelo script descartável do PI-170.')
  const accounts = JSON.parse(process.env.PI170_ACCOUNTS)
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  async function receivedLink(email) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const response = await fetch(`${mailURL}/api/v1/messages`)
      const summary = await response.json()
      const found = summary.messages.find((item) => item.To.some((recipient) => recipient.Address === email))
      if (found) {
        const message = await (await fetch(`${mailURL}/api/v1/message/${found.ID}`)).json()
        const link = message.Text.split(/\s+/).find((part) => part.startsWith(`${baseURL}/login/reset?token=`))
        if (link) return link
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('E-mail de recuperação não entregue ao Mailpit.')
  }
  try {
    for (const account of accounts.filter((item) => item.mode !== 'expired')) {
      const mobile = account.mode === 'mobile'
      const context = await browser.newContext({ baseURL, viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } })
      const page = await context.newPage()
      try {
        await page.goto('/login/recover')
        await page.locator('#recuperar-email:visible').fill(account.email)
        const waiting = page.waitForResponse((res) => res.url().endsWith('/auth/recuperacao') && res.request().method() === 'POST')
        await page.getByRole('button', { name: 'Solicitar recuperação', exact: true }).click()
        const known = await waiting
        expect(known.status()).toBe(201)
        await expect(page.locator('.cartao-auth-sucesso:visible')).toContainText('Solicitação recebida')
        const unknown = await context.request.post('/api/v1/auth/recuperacao', {
          headers: { Origin: baseURL }, data: { email: `ausente-${account.mode}@example.test` },
        })
        expect(unknown.status()).toBe(201)
        expect(await unknown.json()).toEqual(await known.json())
        const link = await receivedLink(account.email)
        await page.goto(link)
        await expect(page.locator('#nova-senha:visible')).toHaveAttribute('minlength', '12')
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        let mutations = 0
        page.on('request', (req) => { if (req.method() === 'POST' && req.url().endsWith('/auth/redefinicao')) mutations++ })
        for (const [password, text] of [['😀'.repeat(11), '12'], ['😀'.repeat(19), '72 bytes'], ['é'.repeat(37), '72 bytes']]) {
          await page.locator('#nova-senha:visible').fill(password)
          await page.locator('#confirmar-senha:visible').fill(password)
          await page.getByRole('button', { name: 'Salvar nova senha', exact: true }).click()
          await expect(page.locator('form:visible [role=alert]')).toContainText(text)
        }
        expect(mutations).toBe(0)
        const password = mobile ? '😀'.repeat(18) : 'é'.repeat(36)
        await page.locator('#nova-senha:visible').fill(password)
        await page.locator('#confirmar-senha:visible').fill(password)
        const reset = page.waitForResponse((res) => res.url().endsWith('/auth/redefinicao') && res.request().method() === 'POST')
        await page.getByRole('button', { name: 'Salvar nova senha', exact: true }).click()
        expect((await reset).status(), `${account.mode}: redefinição da senha`).toBe(200)
        await expect(page.locator('.cartao-auth-sucesso:visible')).toContainText('Senha redefinida')
        await page.getByRole('link', { name: 'Ir para o login', exact: true }).click()
        await page.locator('#email:visible').fill(account.email)
        await page.locator('#senha:visible').fill(process.env.PI170_OLD_PASSWORD)
        const oldLogin = page.waitForResponse((res) => res.url().endsWith('/auth/login') && res.request().method() === 'POST')
        await page.locator('#conteudo:visible').getByRole('button', { name: 'Entrar', exact: true }).click()
        expect((await oldLogin).status(), `${account.mode}: recusa da senha anterior`).toBe(401)
        await page.locator('#senha:visible').fill(password)
        const newLogin = page.waitForResponse((res) => res.url().endsWith('/auth/login') && res.request().method() === 'POST')
        await page.locator('#conteudo:visible').getByRole('button', { name: 'Entrar', exact: true }).click()
        expect((await newLogin).status(), `${account.mode}: login com a senha nova`).toBe(200)
        await expect(page).toHaveURL(/\/account$/)
        await expect(page.locator('.conta-capa:visible')).toContainText(account.email)
        const cookie = (await context.cookies()).find((item) => item.name === 'balaio_sessao')
        expect(cookie.httpOnly).toBe(true)
        expect(await page.evaluate(() => document.cookie)).not.toContain('balaio_sessao')
        await context.clearCookies()
        await page.goto(link)
        await page.locator('#nova-senha:visible').fill('OutraSenhaSegura789!')
        await page.locator('#confirmar-senha:visible').fill('OutraSenhaSegura789!')
        const replay = page.waitForResponse((res) => res.url().endsWith('/auth/redefinicao') && res.request().method() === 'POST')
        await page.getByRole('button', { name: 'Salvar nova senha', exact: true }).click()
        expect((await replay).status()).toBe(400)
        await expect(page.locator('form:visible [role=alert]')).toContainText('Link inválido ou expirado')
        console.log(`PI-170 ${account.mode}: recuperação SMTP, senha Unicode, login, uso único e layout aprovados.`)
      } finally { await context.close() }
    }
    const context = await browser.newContext({ baseURL })
    try {
      const page = await context.newPage()
      await page.goto(process.env.PI170_EXPIRED_LINK)
      await page.locator('#nova-senha:visible').fill('OutraSenhaSegura789!')
      await page.locator('#confirmar-senha:visible').fill('OutraSenhaSegura789!')
      const response = page.waitForResponse((res) => res.url().endsWith('/auth/redefinicao') && res.request().method() === 'POST')
      await page.getByRole('button', { name: 'Salvar nova senha', exact: true }).click()
      expect((await response).status()).toBe(400)
      await expect(page.locator('form:visible [role=alert]')).toContainText('Link inválido ou expirado')
      await page.goto('/login/reset')
      await expect(page.locator('.auth-painel:visible')).toContainText('Link inválido')
      await expect(page.getByRole('link', { name: 'Solicitar novo link', exact: true })).toBeVisible()
      console.log('PI-170 navegador: link expirado e link ausente recusados corretamente.')
    } finally { await context.close() }
  } finally { await browser.close() }
}
main().catch((error) => {
  console.error(error.message.replace(/token(?:=|%3D)[A-Za-z0-9_%+-]+/gi, 'token=[REDACTED]'))
  process.exitCode = 1
})
