import { expect, test } from '@playwright/test'

// TC14 (TS05): busca sem resultados mostra o estado vazio, não a mensagem de erro.
test('busca sem resultados mostra estado vazio e não mostra erro', async ({ page }) => {
  await page.goto('/search?q=termo-inexistente-xyz-123')

  await expect(page.getByText('Nenhuma peça', { exact: true })).toBeVisible()
  await expect(page.getByText('Tivemos um problema ao buscar os dados')).toHaveCount(0)
})
