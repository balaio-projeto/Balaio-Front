import { readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'
import { ARQUIVO_ESTADO, type EstadoDataset } from '../dados/preparar-dados'

export const estadoDataset = (): EstadoDataset => JSON.parse(readFileSync(ARQUIVO_ESTADO, 'utf8')) as EstadoDataset

export const carimbo = () => `${Date.now()}`.slice(-8)

export const emReaisSemSimbolo = (valor: number) => valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export async function entrarPelaTela(page: Page, email: string, senha: string, destino: RegExp) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#senha').fill(senha)
  await page.locator('#conteudo').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(destino)
}

export async function aceitarConfirmacoes(page: Page) {
  page.on('dialog', (dialogo) => void dialogo.accept())
}

export async function escolherOpcao(page: Page, seletor: string, opcao: string) {
  await page.locator(seletor).click()
  await page.getByRole('option', { name: opcao, exact: true }).click()
}

export function semFakeApi(page: Page) {
  const proibidas: string[] = []
  page.on('request', (requisicao) => {
    const url = requisicao.url()
    if (/(localhost|127\.0\.0\.1):(808[1-5]|3001|18080)\b|fake-?api|json-server|__test/i.test(url)) proibidas.push(url)
  })
  return () => expect(proibidas, 'chamadas a Fake API ou stub').toEqual([])
}
