'use client'

import { useRef, useState, type FormEvent } from 'react'
import { avisar } from '@/components/feedback/Avisos'
import { Campo } from '@/components/ui/Basicos'
import {
  alterarPapelDaConta, buscarContaPorEmail, type ContaAdmin, type PapelConta, type PapelProvisionavel,
} from '@/services/api/contasAdmin.servico'
import type { ErroApi } from '@/services/api/tipos'

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LIMITE_EMAIL = 254

const ROTULOS_PAPEL: Record<PapelConta, string> = {
  comprador: 'Comprador',
  artesao: 'Artesão',
  organizador: 'Organizador de eventos',
  admin: 'Administrador',
}

const MOTIVO_PAPEL_FIXO: Partial<Record<PapelConta, string>> = {
  artesao: 'Contas de artesão não podem virar organizador por aqui: o papel de artesão guarda ateliê, peças e vendas.',
  admin: 'Contas de administrador não podem ser alteradas por esta tela.',
}

function mensagemDaBusca(erro: ErroApi): string {
  switch (erro.status) {
    case 404:
      return 'Nenhuma conta com esse e-mail.'
    case 400:
      return 'Informe um e-mail válido.'
    case 401:
      return 'Sua sessão expirou. Entre de novo para continuar.'
    case 403:
      return 'Sua conta não tem permissão para consultar contas. Se a senha inicial de administrador ainda não foi trocada, troque-a e entre de novo.'
    default:
      return erro.mensagem || 'Não foi possível buscar a conta. Tente novamente.'
  }
}

function mensagemDaAlteracao(erro: ErroApi): string {
  switch (erro.status) {
    case 404:
      return 'A conta não existe mais. Busque o e-mail de novo.'
    case 409:
      return 'O papel desta conta mudou ou não pode ser alterado. Busque o e-mail de novo para ver o papel atual.'
    case 400:
      return 'Papel solicitado inválido.'
    case 401:
      return 'Sua sessão expirou. Entre de novo para continuar.'
    case 403:
      return 'Sua conta não tem permissão para alterar papéis.'
    default:
      return erro.mensagem || 'Não foi possível alterar o papel. Tente novamente.'
  }
}

export default function GerenciarOrganizadores() {
  const [email, definirEmail] = useState('')
  const [erroEmail, definirErroEmail] = useState<string>()
  const [conta, definirConta] = useState<ContaAdmin | null>(null)
  const [erroBusca, definirErroBusca] = useState<string | null>(null)
  const [erroAlteracao, definirErroAlteracao] = useState<string | null>(null)
  const [alteradaAgora, definirAlteradaAgora] = useState(false)
  const [buscando, definirBuscando] = useState(false)
  const [alterando, definirAlterando] = useState(false)
  const operacaoEmAndamento = useRef(false)

  async function buscarConta(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (operacaoEmAndamento.current) return
    const informado = email.trim()
    if (!informado || informado.length > LIMITE_EMAIL || !FORMATO_EMAIL.test(informado)) {
      definirErroEmail('Informe um e-mail válido.')
      document.getElementById('organizador-email')?.focus()
      return
    }

    operacaoEmAndamento.current = true
    definirBuscando(true)
    definirConta(null)
    definirErroBusca(null)
    definirErroAlteracao(null)
    definirAlteradaAgora(false)
    try {
      const resposta = await buscarContaPorEmail(informado)
      if (resposta.erro || !resposta.dados) {
        definirErroBusca(resposta.erro ? mensagemDaBusca(resposta.erro) : 'Não foi possível buscar a conta.')
        return
      }
      definirConta(resposta.dados)
    } catch {
      definirErroBusca('Não foi possível buscar a conta. Tente novamente.')
    } finally {
      operacaoEmAndamento.current = false
      definirBuscando(false)
    }
  }

  async function alterarPapel(alvo: ContaAdmin, novoPapel: PapelProvisionavel) {
    if (operacaoEmAndamento.current) return
    operacaoEmAndamento.current = true
    definirAlterando(true)
    definirErroAlteracao(null)
    definirAlteradaAgora(false)
    try {
      const resposta = await alterarPapelDaConta(alvo.id, novoPapel)
      if (resposta.erro) {
        const mensagem = mensagemDaAlteracao(resposta.erro)
        definirErroAlteracao(mensagem)
        avisar.erro('Não foi possível alterar o papel', mensagem)
        return
      }
      definirConta({ ...alvo, papel: novoPapel })
      definirAlteradaAgora(true)
      avisar.sucesso(
        novoPapel === 'organizador' ? 'Conta agora é organizadora' : 'Conta voltou a ser compradora',
        'A pessoa precisa sair e entrar de novo para o novo papel valer.',
      )
    } catch {
      definirErroAlteracao('Não foi possível alterar o papel. Tente novamente.')
    } finally {
      operacaoEmAndamento.current = false
      definirAlterando(false)
    }
  }

  const ocupado = buscando || alterando
  const motivoFixo = conta ? MOTIVO_PAPEL_FIXO[conta.papel] : undefined

  return (
    <>
      <form className="cartao" onSubmit={buscarConta} noValidate aria-busy={buscando}>
        <fieldset disabled={ocupado} className="sem-margem" style={{ border: 0, padding: 0 }}>
          <Campo
            rotulo="E-mail da conta"
            ajuda="Use o e-mail com que a pessoa se cadastrou como compradora."
            erro={erroEmail}
            id="organizador-email"
          >
            <input
              id="organizador-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={LIMITE_EMAIL}
              value={email}
              onChange={(evento) => {
                definirEmail(evento.target.value)
                definirErroEmail(undefined)
              }}
            />
          </Campo>
          <button type="submit" className="botao botao-primario">
            {buscando ? 'Buscando…' : 'Buscar conta'}
          </button>
        </fieldset>
      </form>

      <div className="acima-3" aria-live="polite">
        {erroBusca && <p className="aviso" role="status">{erroBusca}</p>}

        {conta && (
          <section className="cartao" aria-labelledby="organizador-conta-nome" aria-busy={alterando}>
            <div className="grade-dois">
              <div className="dado">
                <span className="dado-rotulo">Nome</span>
                <span className="dado-valor" id="organizador-conta-nome">{conta.nome}</span>
              </div>
              <div className="dado">
                <span className="dado-rotulo">E-mail</span>
                <span className="dado-valor">{conta.email}</span>
              </div>
            </div>
            <div className="dado acima-2">
              <span className="dado-rotulo">Papel atual</span>
              <span>
                <span className={`selo ${conta.papel === 'organizador' ? 'selo-unica' : 'selo-neutro'}`}>
                  {ROTULOS_PAPEL[conta.papel] ?? conta.papel}
                </span>
              </span>
            </div>

            <div className="acima-3">
              {conta.papel === 'comprador' && (
                <button
                  type="button"
                  className="botao botao-primario"
                  disabled={ocupado}
                  onClick={() => alterarPapel(conta, 'organizador')}
                >
                  {alterando ? 'Alterando…' : 'Tornar organizador'}
                </button>
              )}
              {conta.papel === 'organizador' && (
                <button
                  type="button"
                  className="botao botao-fantasma"
                  disabled={ocupado}
                  onClick={() => alterarPapel(conta, 'comprador')}
                >
                  {alterando ? 'Alterando…' : 'Voltar a comprador'}
                </button>
              )}
              {motivoFixo && <p className="texto-suave">{motivoFixo}</p>}
            </div>

            {erroAlteracao && <p className="aviso acima-3" role="alert">{erroAlteracao}</p>}
            {alteradaAgora && (
              <p className="aviso acima-3" role="status">
                Papel alterado para {ROTULOS_PAPEL[conta.papel].toLowerCase()}. Peça para a pessoa sair e entrar de novo
                na conta: até lá, a sessão aberta continua com o papel anterior.
              </p>
            )}
          </section>
        )}
      </div>
    </>
  )
}
