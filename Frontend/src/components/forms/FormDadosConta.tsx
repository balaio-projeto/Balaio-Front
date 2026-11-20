'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { avisar } from '@/components/feedback/Avisos'
import { Campo } from '@/components/ui/Basicos'
import { atualizarUsuario } from '@/services/api/conta.servico'
import type { Usuario } from '@/types/dominio'

export default function FormDadosConta({ usuario }: { usuario: Usuario }) {
  const roteador = useRouter()
  const [enviando, definirEnviando] = useState(false)

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const formulario = evento.currentTarget
    if (!formulario.reportValidity()) return
    const dados = new FormData(formulario)
    definirEnviando(true)
    const resposta = await atualizarUsuario({
      nome: String(dados.get('nome') ?? ''),
      email: String(dados.get('email') ?? ''),
    })
    definirEnviando(false)
    if (!resposta.dados) {
      avisar.erro('Não foi possível salvar os dados', resposta.erro?.mensagem)
      return
    }
    avisar.sucesso('Dados da conta salvos')
    roteador.refresh()
  }

  return (
    <form noValidate onSubmit={salvar}>
      <section className="cartao">
        <Campo rotulo="Nome completo" id="conta-nome">
          <input id="conta-nome" name="nome" defaultValue={usuario.nome} autoComplete="name" required />
        </Campo>
        <Campo rotulo="E-mail" id="conta-email">
          <input id="conta-email" name="email" type="email" defaultValue={usuario.email} autoComplete="email" required />
        </Campo>
        <button type="submit" className="botao botao-primario" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </section>
    </form>
  )
}
