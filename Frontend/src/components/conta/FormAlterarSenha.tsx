'use client'

import { useState, type FormEvent } from 'react'
import { Campo } from '@/components/ui/Basicos'
import { avisar } from '@/components/feedback/Avisos'
import { alterarSenha } from '@/services/api/auth.servico'
import { useSessao } from '@/store/sessao'
import { validarObrigatorio, validarSenha } from '@/utils/validacao'
import type { ErroApi } from '@/services/api/tipos'

const CAMPO_POR_MENSAGEM_DO_PERFIL: Record<string, string> = {
  'senha atual incorreta.': 'senha-atual',
  'informe a senha atual.': 'senha-atual',
  'nova senha inválida.': 'senha-nova',
  'a nova senha deve ser diferente da senha atual.': 'senha-nova',
}

function campoDoErro(erro: ErroApi): string | undefined {
  if (erro.codigo === 'SENHA_ATUAL_INVALIDA') return 'senha-atual'
  if (erro.codigo !== 'ALTERACAO_SENHA_INVALIDA') return undefined
  return CAMPO_POR_MENSAGEM_DO_PERFIL[erro.mensagem.trim().toLowerCase()]
}

export default function FormAlterarSenha() {
  const { sessao } = useSessao()
  const [erros, definirErros] = useState<Record<string, string>>({})
  const [erroGeral, definirErroGeral] = useState<string | null>(null)
  const [salvando, definirSalvando] = useState(false)

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (salvando || !sessao) return
    const formulario = evento.currentTarget
    const dados = new FormData(formulario)
    const atual = String(dados.get('senhaAtual') ?? '')
    const nova = String(dados.get('novaSenha') ?? '')
    const confirmacao = String(dados.get('confirmacao') ?? '')
    const proximosErros: Record<string, string> = {}

    const problemaAtual = validarObrigatorio(atual, 'Digite sua senha atual')
    if (problemaAtual) proximosErros['senha-atual'] = problemaAtual
    const problemaNova = validarSenha(nova)
    if (problemaNova) proximosErros['senha-nova'] = problemaNova
    else if (nova === atual) proximosErros['senha-nova'] = 'A nova senha precisa ser diferente da atual'
    if (!problemaNova && confirmacao !== nova) proximosErros['senha-confirmacao'] = 'As senhas não conferem'

    definirErros(proximosErros)
    definirErroGeral(null)
    const primeiro = Object.keys(proximosErros)[0]
    if (primeiro) {
      document.getElementById(primeiro)?.focus()
      return
    }

    definirSalvando(true)
    const { erro } = await alterarSenha(atual, nova)
    definirSalvando(false)

    if (erro) {
      const campo = campoDoErro(erro)
      if (campo) {
        definirErros({ [campo]: erro.mensagem })
        document.getElementById(campo)?.focus()
        return
      }
      definirErroGeral(erro.mensagem)
      avisar.erro('Não foi possível alterar a senha', erro.mensagem)
      return
    }

    formulario.reset()
    avisar.sucesso('Senha alterada', 'Use a nova senha no próximo login.')
  }

  return (
    <form className="cartao" id="seguranca" onSubmit={salvar} noValidate>
      <h2 className="secao-titulo">Alterar senha</h2>

      <Campo rotulo="Senha atual" erro={erros['senha-atual']} id="senha-atual">
        <input id="senha-atual" name="senhaAtual" type="password" autoComplete="current-password" />
      </Campo>
      <Campo rotulo="Nova senha" ajuda="No mínimo 12 caracteres." erro={erros['senha-nova']} id="senha-nova">
        <input id="senha-nova" name="novaSenha" type="password" autoComplete="new-password" />
      </Campo>
      <Campo rotulo="Repita a nova senha" erro={erros['senha-confirmacao']} id="senha-confirmacao">
        <input id="senha-confirmacao" name="confirmacao" type="password" autoComplete="new-password" />
      </Campo>

      {erroGeral && <p className="aviso abaixo-4" role="alert">{erroGeral}</p>}

      <button type="submit" className="botao botao-secundario botao-largo" disabled={salvando}>
        {salvando ? 'Alterando…' : 'Alterar senha'}
      </button>
    </form>
  )
}
