'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { avisar } from '@/components/feedback/Avisos'
import { Campo } from '@/components/ui/Basicos'
import { atualizarUsuario } from '@/services/api/conta.servico'
import { sessaoDoUsuario } from '@/services/sessao/cookie'
import { useSessao } from '@/store/sessao'
import type { Usuario } from '@/types/dominio'

export default function FormDadosConta({ usuario }: { usuario: Usuario }) {
  const roteador = useRouter()
  const { sessao, iniciarSessao } = useSessao()
  const [enviando, definirEnviando] = useState(false)
  const [erroEmail, definirErroEmail] = useState<string | undefined>()

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const formulario = evento.currentTarget
    if (!formulario.reportValidity()) return
    const dados = new FormData(formulario)
    definirErroEmail(undefined)
    definirEnviando(true)
    const resposta = await atualizarUsuario({
      nome: String(dados.get('nome') ?? ''),
      email: String(dados.get('email') ?? ''),
    })
    definirEnviando(false)
    if (!resposta.dados) {
      if (resposta.erro?.codigo === 'EMAIL_EM_USO') {
        definirErroEmail(resposta.erro.mensagem || 'Este e-mail já está cadastrado em outra conta.')
        document.getElementById('conta-email')?.focus()
        return
      }
      avisar.erro('Não foi possível salvar os dados', resposta.erro?.mensagem)
      return
    }
    const salvo = resposta.dados
    const sessaoAtualizada = sessaoDoUsuario(salvo) ?? (sessao && { ...sessao, nome: salvo.nome, email: salvo.email })
    if (sessaoAtualizada) iniciarSessao(sessaoAtualizada)
    avisar.sucesso('Dados da conta salvos')
    roteador.refresh()
  }

  return (
    <form noValidate onSubmit={salvar}>
      <section className="cartao">
        <Campo rotulo="Nome completo" id="conta-nome">
          <input id="conta-nome" name="nome" defaultValue={usuario.nome} autoComplete="name" required />
        </Campo>
        <Campo rotulo="E-mail" id="conta-email" erro={erroEmail}>
          <input
            id="conta-email"
            name="email"
            type="email"
            defaultValue={usuario.email}
            autoComplete="email"
            required
            onChange={() => definirErroEmail(undefined)}
          />
        </Campo>
        <button type="submit" className="botao botao-primario" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </section>
    </form>
  )
}
