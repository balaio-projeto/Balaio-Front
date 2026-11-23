import 'server-only'

import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { obterUsuario } from '@/services/api/conta.servico'
import { obterMeuAtelie } from '@/services/api/artesaos.servico'
import { COOKIE_AUTENTICACAO, destinoSeguro, rotaDeLogin } from '@/services/sessao/cookie'
import { CABECALHO_CAMINHO_ATUAL } from '@/services/sessao/rotas'

export const COOKIE_SESSAO = COOKIE_AUTENTICACAO

export async function tokenDaSessao() {
  return (await cookies()).get(COOKIE_SESSAO)?.value
}

export const obterSessao = cache(async () => {
  const token = await tokenDaSessao()
  if (!token) return null
  const { dados } = await obterUsuario(token)
  return dados ? { usuario: dados, token } : null
})

export async function exigirSessao() {
  const sessao = await obterSessao()
  if (!sessao) {
    const caminhoAtual = destinoSeguro((await headers()).get(CABECALHO_CAMINHO_ATUAL) ?? undefined)
    redirect(caminhoAtual ? rotaDeLogin(caminhoAtual) : '/login')
  }
  return sessao
}

export async function exigirUsuario() {
  return (await exigirSessao()).usuario
}

export async function exigirArtesao() {
  const { usuario, token } = await exigirSessao()
  const { dados: artesao } = await obterMeuAtelie(token)
  if (!artesao) redirect('/account')
  return { usuario, artesao, token }
}
