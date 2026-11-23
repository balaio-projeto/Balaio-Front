import { expect, test } from '@playwright/test'
import { CONTAS, SENHA_CONTAS_TESTE } from './dados/dataset'

// TC07 (TS02): visitante que pede uma rota protegida volta a ela depois de entrar.
test('visitante volta ao checkout depois do login', async ({ page }) => {
  await page.goto('/checkout')
  await expect(page).toHaveURL(/\/login\?proximo=%2Fcheckout/)

  await page.locator('#email').fill(CONTAS.comprador.email)
  await page.locator('#senha').fill(SENHA_CONTAS_TESTE)
  await page.locator('#conteudo').getByRole('button', { name: 'Entrar', exact: true }).click()

  await expect(page).toHaveURL(/\/checkout(\?|$)/)
})

// Destino externo forjado no parâmetro de retorno é descartado (TC08 já tem teste unitário).
test('destino externo no parâmetro de retorno não é seguido', async ({ page }) => {
  await page.goto('/login?proximo=https%3A%2F%2Fevil.example')
  await page.locator('#email').fill(CONTAS.comprador.email)
  await page.locator('#senha').fill(SENHA_CONTAS_TESTE)
  await page.locator('#conteudo').getByRole('button', { name: 'Entrar', exact: true }).click()

  await expect(page).not.toHaveURL(/evil\.example/)
  await expect(page).toHaveURL(/localhost:4321|127\.0\.0\.1:4321/)
})
