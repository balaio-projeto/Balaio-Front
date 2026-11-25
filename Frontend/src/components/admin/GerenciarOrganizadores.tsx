'use client'

import { CODIGO_TROCA_SENHA_OBRIGATORIA } from '@/components/admin/AvisoTrocaSenhaAdmin'
import { useRef, useState } from 'react'
import { avisar } from '@/components/feedback/Avisos'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { Retrato } from '@/components/ui/Basicos'
import { IconeSetaBaixo, IconeUsuario } from '@/components/ui/Icones'
import {
  alterarPapelDaConta, type ContaAdmin, type PapelConta, type PapelProvisionavel,
} from '@/services/api/contasAdmin.servico'
import type { ErroApi } from '@/services/api/tipos'

const ROTULOS_PAPEL: Record<PapelConta, string> = {
  comprador: 'Comprador',
  artesao: 'Artesão',
  organizador: 'Organizador de eventos',
  admin: 'Administrador',
}

const SELO_PAPEL: Record<PapelConta, { classe: string; texto: string }> = {
  comprador: { classe: 'selo-neutro', texto: 'Comprador' },
  organizador: { classe: 'selo-unica', texto: 'Organizador' },
  artesao: { classe: 'selo-neutro', texto: 'Artesão' },
  admin: { classe: 'selo-neutro', texto: 'Administrador' },
}

const MOTIVO_PAPEL_FIXO: Partial<Record<PapelConta, string>> = {
  artesao: 'Contas de artesão não podem virar organizador por aqui: o papel de artesão guarda ateliê, peças e vendas.',
  admin: 'Contas de administrador não podem ser alteradas por esta tela.',
}

function mensagemDaListagem(erro: ErroApi): string {
  switch (erro.status) {
    case 400:
      return 'Busca inválida. Use até 100 caracteres.'
    case 401:
      return 'Sua sessão expirou. Entre de novo para continuar.'
    case 403:
      return erro.codigo === CODIGO_TROCA_SENHA_OBRIGATORIA
        ? 'Troque a senha inicial de administrador em Minha conta > Meus dados para liberar esta tela.'
        : 'Sua conta não tem permissão para consultar contas.'
    default:
      return erro.mensagem || 'Não foi possível carregar as contas. Tente novamente.'
  }
}

function mensagemDaAlteracao(erro: ErroApi): string {
  switch (erro.status) {
    case 404:
      return 'A conta não existe mais. Recarregue a lista.'
    case 409:
      return 'O papel desta conta mudou ou não pode ser alterado. Recarregue a lista para ver o papel atual.'
    case 400:
      return 'Papel solicitado inválido.'
    case 401:
      return 'Sua sessão expirou. Entre de novo para continuar.'
    case 403:
      return erro.codigo === CODIGO_TROCA_SENHA_OBRIGATORIA
        ? 'Troque a senha inicial de administrador em Minha conta > Meus dados para liberar esta tela.'
        : 'Sua conta não tem permissão para alterar papéis.'
    default:
      return erro.mensagem || 'Não foi possível alterar o papel. Tente novamente.'
  }
}

function resumo(total: number, busca: string): string {
  const contagem = total === 0 ? 'Nenhuma conta' : total === 1 ? '1 conta' : `${total} contas`
  return busca ? `${contagem} para “${busca}”` : contagem
}

export default function GerenciarOrganizadores({
  contasIniciais,
  erro,
  total,
  busca,
}: {
  contasIniciais: ContaAdmin[]
  erro: ErroApi | null
  total: number
  busca: string
}) {
  const [contas, definirContas] = useState(contasIniciais)
  const [alterando, definirAlterando] = useState<string | null>(null)
  const [errosAlteracao, definirErrosAlteracao] = useState<Record<string, string>>({})
  const [alteradas, definirAlteradas] = useState<string[]>([])
  const operacaoEmAndamento = useRef(false)

  async function alterarPapel(alvo: ContaAdmin, novoPapel: PapelProvisionavel) {
    if (operacaoEmAndamento.current) return
    operacaoEmAndamento.current = true
    definirAlterando(alvo.id)
    definirErrosAlteracao((atuais) => Object.fromEntries(Object.entries(atuais).filter(([id]) => id !== alvo.id)))
    definirAlteradas((atuais) => atuais.filter((id) => id !== alvo.id))
    try {
      const resposta = await alterarPapelDaConta(alvo.id, novoPapel)
      if (resposta.erro) {
        const mensagem = mensagemDaAlteracao(resposta.erro)
        definirErrosAlteracao((atuais) => ({ ...atuais, [alvo.id]: mensagem }))
        avisar.erro('Não foi possível alterar o papel', mensagem)
        return
      }
      definirContas((atuais) => atuais.map((conta) => (conta.id === alvo.id ? { ...conta, papel: novoPapel } : conta)))
      definirAlteradas((atuais) => [...atuais, alvo.id])
      avisar.sucesso(
        novoPapel === 'organizador' ? 'Conta agora é organizadora' : 'Conta voltou a ser compradora',
        'A pessoa precisa sair e entrar de novo para o novo papel valer.',
      )
    } catch {
      definirErrosAlteracao((atuais) => ({ ...atuais, [alvo.id]: 'Não foi possível alterar o papel. Tente novamente.' }))
    } finally {
      operacaoEmAndamento.current = false
      definirAlterando(null)
    }
  }

  if (erro) return <p className="aviso" role="status">{mensagemDaListagem(erro)}</p>

  return (
    <section aria-labelledby="lista-contas-titulo">
      <h2 className="so-leitor" id="lista-contas-titulo">Contas</h2>
      <p className="texto-suave abaixo-2" aria-live="polite">{resumo(total, busca)}</p>

      {contas.length === 0 ? (
        <EstadoVazio
          icone={<IconeUsuario tamanho={34} />}
          titulo={busca ? 'Nenhuma conta encontrada' : 'Nenhuma conta para mostrar'}
        />
      ) : (
        <ul className="lista-acordeao-admin">
          {contas.map((conta) => {
            const ocupado = alterando !== null
            const emAlteracao = alterando === conta.id
            const selo = SELO_PAPEL[conta.papel] ?? { classe: 'selo-neutro', texto: conta.papel }
            const motivoFixo = MOTIVO_PAPEL_FIXO[conta.papel]
            const erroAlteracao = errosAlteracao[conta.id]
            return (
              <li className="item-conta-admin" key={conta.id}>
                <details className="acordeao-admin">
                  <summary className="acordeao-admin-resumo">
                    <Retrato imagem={conta.imagem ?? undefined} tamanho={36} />
                    <span className="acordeao-admin-identidade">
                      <span className="acordeao-admin-titulo">{conta.nome}</span>
                    </span>
                    <span className={`selo ${selo.classe}`}>{selo.texto}</span>
                    <span className="seta-grupo" aria-hidden>
                      <IconeSetaBaixo />
                    </span>
                  </summary>

                  <div className="acordeao-admin-corpo" aria-busy={emAlteracao}>
                    <dl className="acordeao-admin-dados">
                      <div className="dado">
                        <dt className="dado-rotulo">E-mail</dt>
                        <dd className="dado-valor acordeao-admin-texto">{conta.email}</dd>
                      </div>
                      <div className="dado">
                        <dt className="dado-rotulo">Papel atual</dt>
                        <dd className="dado-valor">{ROTULOS_PAPEL[conta.papel] ?? conta.papel}</dd>
                      </div>
                    </dl>

                    <div className="acoes-linha">
                      {conta.papel === 'comprador' && (
                        <button
                          type="button"
                          className="botao botao-primario"
                          disabled={ocupado}
                          onClick={() => alterarPapel(conta, 'organizador')}
                        >
                          {emAlteracao ? 'Alterando…' : 'Tornar organizador'}
                        </button>
                      )}
                      {conta.papel === 'organizador' && (
                        <button
                          type="button"
                          className="botao botao-fantasma"
                          disabled={ocupado}
                          onClick={() => alterarPapel(conta, 'comprador')}
                        >
                          {emAlteracao ? 'Alterando…' : 'Voltar a comprador'}
                        </button>
                      )}
                      {motivoFixo && <p className="texto-suave">{motivoFixo}</p>}
                    </div>

                    {erroAlteracao && <p className="aviso" role="alert">{erroAlteracao}</p>}
                    {alteradas.includes(conta.id) && (
                      <p className="aviso" role="status">
                        Papel alterado para {(ROTULOS_PAPEL[conta.papel] ?? conta.papel).toLowerCase()}. A pessoa precisa
                        sair e entrar de novo na conta para o novo papel valer.
                      </p>
                    )}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
