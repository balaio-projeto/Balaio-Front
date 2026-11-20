'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Campo } from '@/components/ui/Basicos'
import { redefinirSenha } from '@/services/api/conta.servico'
import { useSessao } from '@/store/sessao'
import { validarSenha } from '@/utils/validacao'

export default function FormRedefinirSenha() {
  const token = useSearchParams().get('token')
  const [erro, definirErro] = useState<string | null>(null)
  const [concluido, definirConcluido] = useState(false)
  const [enviando, definirEnviando] = useState(false)
  const { encerrarSessao } = useSessao()

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const campos = new FormData(evento.currentTarget)
    const senha = String(campos.get('senha') ?? '')
    const confirmacao = String(campos.get('confirmacao') ?? '')
    const problemaSenha = validarSenha(senha)
    if (problemaSenha) return definirErro(problemaSenha)
    if (senha !== confirmacao) return definirErro('As senhas precisam ser iguais.')
    if (!token) return definirErro('Link inválido. Solicite outro link de recuperação.')
    definirErro(null)
    definirEnviando(true)
    const resposta = await redefinirSenha(token, senha)
    definirEnviando(false)
    if (!resposta.dados) return definirErro(resposta.erro?.mensagem ?? 'Não foi possível redefinir a senha.')
    encerrarSessao()
    definirConcluido(true)
  }

  if (concluido) return <div className="cartao cartao-auth-sucesso" role="status"><p className="texto-forte">Senha redefinida</p><p>Entre com sua nova senha.</p><Link href="/login" className="botao botao-primario botao-largo">Ir para o login</Link></div>
  if (!token) return <div className="cartao" role="alert"><p>Link inválido. Solicite outro link de recuperação.</p><Link href="/login/recover">Solicitar novo link</Link></div>

  return <form className="cartao" onSubmit={enviar} noValidate>
    <Campo id="nova-senha" rotulo="Nova senha" ajuda="No mínimo 12 caracteres e no máximo 72 bytes em UTF-8.">
      <input id="nova-senha" name="senha" type="password" autoComplete="new-password" minLength={12} required />
    </Campo>
    <Campo id="confirmar-senha" rotulo="Confirme a nova senha">
      <input id="confirmar-senha" name="confirmacao" type="password" autoComplete="new-password" minLength={12} required />
    </Campo>
    {erro && <p role="alert">{erro}</p>}
    <button className="botao botao-primario botao-largo" disabled={enviando}>{enviando ? 'Salvando...' : 'Salvar nova senha'}</button>
  </form>
}
