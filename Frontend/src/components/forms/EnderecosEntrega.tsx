'use client'

import { useRef, useState } from 'react'
import { avisar } from '@/components/feedback/Avisos'
import { IconeEditar, IconeEstrela, IconeLixeira } from '@/components/ui/Icones'
import type { EnderecoUsuario } from '@/types/dominio'
import { formatarLogradouro } from '@/utils/cep'
import { atualizarEndereco, criarEndereco, excluirEndereco, listarEnderecos } from '@/services/api/conta.servico'
import FormularioEndereco, { type DadosEndereco } from './FormularioEndereco'

const NOVO = '__novo__'

export default function EnderecosEntrega({ iniciais }: { iniciais: EnderecoUsuario[] }) {
  const [enderecos, definirEnderecos] = useState(iniciais)
  const [emEdicao, definirEmEdicao] = useState<string | null>(null)
  const [processando, definirProcessando] = useState(false)
  const operacaoEmAndamento = useRef(false)

  function iniciarOperacao() {
    if (operacaoEmAndamento.current) return false
    operacaoEmAndamento.current = true
    definirProcessando(true)
    return true
  }

  function finalizarOperacao() {
    operacaoEmAndamento.current = false
    definirProcessando(false)
  }

  function abrir(apelido: string) {
    if (operacaoEmAndamento.current) return
    definirEmEdicao(apelido)
  }

  async function recarregar() {
    const resposta = await listarEnderecos()
    if (resposta.dados) definirEnderecos(resposta.dados)
  }

  async function tornarPrincipal(endereco: EnderecoUsuario) {
    if (!iniciarOperacao()) return
    try {
      const resposta = await atualizarEndereco(endereco.id, { principal: true })
      if (!resposta.dados) return avisar.erro('Não foi possível atualizar', resposta.erro?.mensagem)
      definirEnderecos((atuais) => atuais.map((e) => ({ ...e, principal: e.id === endereco.id })))
      await recarregar()
      avisar.sucesso(`"${endereco.apelido}" agora é o endereço principal`)
    } finally {
      finalizarOperacao()
    }
  }

  async function excluir(endereco: EnderecoUsuario) {
    if (!iniciarOperacao()) return
    try {
      const resposta = await excluirEndereco(endereco.id)
      if (!resposta.dados) return avisar.erro('Não foi possível excluir', resposta.erro?.mensagem)
      definirEnderecos((atuais) => {
        const restantes = atuais.filter((e) => e.id !== endereco.id)
        return endereco.principal && restantes.length > 0
          ? restantes.map((e, indice) => ({ ...e, principal: indice === 0 }))
          : restantes
      })
      await recarregar()
      definirEmEdicao((atual) => atual === endereco.id ? null : atual)
      avisar.sucesso(`Endereço "${endereco.apelido}" excluído`)
    } finally {
      finalizarOperacao()
    }
  }

  async function salvar(id: string, dados: DadosEndereco) {
    if (!iniciarOperacao()) return
    try {
      const resposta = id === NOVO ? await criarEndereco(dados) : await atualizarEndereco(id, dados)
      if (!resposta.dados) return avisar.erro('Não foi possível salvar', resposta.erro?.mensagem)
      const salvo = resposta.dados
      definirEnderecos((atuais) => id === NOVO ? [...atuais, salvo] : atuais.map((e) => (e.id === id ? salvo : e)))
      await recarregar()
      definirEmEdicao((atual) => atual === id ? null : atual)
      avisar.sucesso('Endereço salvo')
    } finally {
      finalizarOperacao()
    }
  }

  function formulario(endereco?: EnderecoUsuario) {
    const id = endereco?.id ?? NOVO
    return (
      <FormularioEndereco
        key={id}
        endereco={endereco}
        processando={processando}
        aoSalvar={(dados) => void salvar(id, dados)}
        aoCancelar={() => definirEmEdicao(null)}
      />
    )
  }

  return (
    <section className="cartao" aria-busy={processando}>
      <h2 className="secao-titulo">{emEdicao === NOVO && enderecos.length === 0 ? 'Novo endereço' : 'Endereços salvos'}</h2>
      {enderecos.map((e) => (
        <div className="endereco" key={e.id}>
          <div className="encolhivel">
            <p className="linha-flex" style={{ gap: 8, fontWeight: 600 }}>
              {e.apelido}
              {e.principal && <span className="selo selo-neutro">Principal</span>}
            </p>
            {emEdicao === e.id ? (
              formulario(e)
            ) : (
              [formatarLogradouro(e), e.bairro, `CEP ${e.cep}`].filter(Boolean).map((linha) => (
                <p className="autoria" key={linha}>
                  {linha}
                </p>
              ))
            )}
          </div>
          {emEdicao !== e.id && (
            <div className="acoes-linha">
              {!e.principal && (
                <button
                  type="button"
                  className="botao botao-compacto botao-fantasma"
                  onClick={() => tornarPrincipal(e)}
                  disabled={processando}
                  aria-label={`Tornar "${e.apelido}" o endereço principal`}
                >
                  <IconeEstrela tamanho={15} />
                  Tornar principal
                </button>
              )}
              <button
                type="button"
                className="botao botao-compacto botao-fantasma"
                onClick={() => abrir(e.id)}
                disabled={processando}
                aria-label={`Editar endereço ${e.apelido}`}
              >
                <IconeEditar tamanho={15} />
                Editar
              </button>
              <button
                type="button"
                className="botao botao-compacto botao-perigo"
                onClick={() => excluir(e)}
                disabled={processando}
                aria-label={`Excluir endereço ${e.apelido}`}
              >
                <IconeLixeira tamanho={15} />
                Excluir
              </button>
            </div>
          )}
        </div>
      ))}
      {emEdicao === NOVO ? (
        formulario()
      ) : (
        <button type="button" className="botao botao-secundario acima-4" disabled={processando} onClick={() => abrir(NOVO)}>
          Adicionar endereço
        </button>
      )}
    </section>
  )
}
