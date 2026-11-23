'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'
import { Campo } from '@/components/ui/Basicos'
import { problemaDoPeriodoPersonalizado } from '@/components/painel/periodoVendas'

type Props = {
  deInicial: string
  ateInicial: string
  ativo: boolean
  erroDoPeriodo?: string
}

export default function PeriodoPersonalizadoVendas({ deInicial, ateInicial, ativo, erroDoPeriodo }: Props) {
  const roteador = useRouter()
  const [aplicando, iniciarAplicacao] = useTransition()
  const [de, definirDe] = useState(deInicial)
  const [ate, definirAte] = useState(ateInicial)
  const [erroDe, definirErroDe] = useState('')
  const [erroAte, definirErroAte] = useState('')

  function aplicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (aplicando) return
    const problema = problemaDoPeriodoPersonalizado(de, ate)
    definirErroDe(problema?.campo === 'de' ? problema.mensagem : '')
    definirErroAte(problema?.campo === 'ate' ? problema.mensagem : '')
    if (problema) {
      document.getElementById(`periodo-${problema.campo}`)?.focus()
      return
    }
    const consulta = new URLSearchParams({ de, ate })
    iniciarAplicacao(() => roteador.push(`/dashboard/sales?${consulta.toString()}`))
  }

  return (
    <form className="cartao abaixo-4" onSubmit={aplicar} noValidate aria-labelledby="periodo-personalizado-titulo">
      <h2 className="campo-rotulo abaixo-3" id="periodo-personalizado-titulo">
        Período personalizado{ativo ? ' (aplicado)' : ''}
      </h2>
      <div className="grade-dois">
        <Campo rotulo="De" id="periodo-de" erro={erroDe}>
          <input
            id="periodo-de"
            type="date"
            value={de}
            max={ate || undefined}
            disabled={aplicando}
            onChange={(evento) => { definirDe(evento.target.value); definirErroDe('') }}
          />
        </Campo>
        <Campo rotulo="Até" id="periodo-ate" erro={erroAte}>
          <input
            id="periodo-ate"
            type="date"
            value={ate}
            min={de || undefined}
            disabled={aplicando}
            onChange={(evento) => { definirAte(evento.target.value); definirErroAte('') }}
          />
        </Campo>
      </div>
      {erroDoPeriodo && <p className="campo-erro abaixo-3" role="alert">{erroDoPeriodo}</p>}
      <button type="submit" className="botao botao-primario" disabled={aplicando}>
        {aplicando ? 'Aplicando…' : 'Aplicar período'}
      </button>
    </form>
  )
}
