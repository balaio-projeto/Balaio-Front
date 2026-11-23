'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Campo } from '@/components/ui/Basicos'
import { avisar } from '@/components/feedback/Avisos'
import SeletorEstado from '@/components/forms/SeletorEstado'
import { useBuscaCep } from '@/hooks/useBuscaCep'
import { comporBairro, formatarCep, separarBairro, type EnderecoPorCep } from '@/utils/cep'
import { validarCEP, validarEstado, validarObrigatorio } from '@/utils/validacao'
import type { EnderecoUsuario } from '@/types/dominio'

export type DadosEndereco = Omit<EnderecoUsuario, 'id' | 'principal'>

type Campos = { apelido: string; cep: string; rua: string; bairro: string; cidade: string; uf: string }

function camposIniciais(endereco?: EnderecoUsuario): Campos {
  const partes = separarBairro(endereco?.bairro ?? '')
  return { apelido: endereco?.apelido ?? '', cep: endereco?.cep ?? '', rua: endereco?.rua ?? '', ...partes }
}

function validar(campos: Campos): Record<string, string> {
  const erros: Record<string, string> = {}
  const problemas: [string, string | null][] = [
    ['end-apelido', validarObrigatorio(campos.apelido, 'Dê um nome a este endereço, como Casa')],
    ['end-cep', validarCEP(campos.cep)],
    ['end-rua', validarObrigatorio(campos.rua, 'Informe rua e número')],
    ['end-cidade', validarObrigatorio(campos.cidade, 'Informe a cidade')],
    ['end-uf', validarEstado(campos.uf)],
  ]
  for (const [id, problema] of problemas) if (problema) erros[id] = problema
  return erros
}

export default function FormularioEndereco({
  endereco,
  processando,
  aoSalvar,
  aoCancelar,
}: {
  endereco?: EnderecoUsuario
  processando: boolean
  aoSalvar: (dados: DadosEndereco) => void
  aoCancelar: () => void
}) {
  const [campos, definirCampos] = useState(() => camposIniciais(endereco))
  const [erros, definirErros] = useState<Record<string, string>>({})
  const ruaRef = useRef<HTMLInputElement>(null)
  const busca = useBuscaCep(preencherPeloCep)

  function preencherPeloCep(encontrado: EnderecoPorCep) {
    definirCampos((atuais) => ({
      ...atuais,
      rua: encontrado.rua || atuais.rua,
      bairro: encontrado.bairro || atuais.bairro,
      cidade: encontrado.cidade,
      uf: encontrado.uf,
    }))
    definirErros((atuais) => {
      const proximos = { ...atuais }
      delete proximos['end-cidade']
      delete proximos['end-uf']
      if (encontrado.rua) delete proximos['end-rua']
      return proximos
    })
    ruaRef.current?.focus()
  }

  function atualizar(campo: keyof Campos, valor: string) {
    definirCampos((atuais) => ({ ...atuais, [campo]: valor }))
    if (campo === 'cep') void busca.buscarCep(valor)
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (processando) return
    const proximosErros = validar(campos)
    definirErros(proximosErros)
    const primeiro = Object.keys(proximosErros)[0]
    if (primeiro) {
      document.getElementById(primeiro)?.focus()
      avisar.erro('Confira os campos destacados')
      return
    }
    aoSalvar({
      apelido: campos.apelido.trim(),
      rua: campos.rua.trim(),
      bairro: comporBairro(campos),
      cep: formatarCep(campos.cep),
    })
  }

  const ajudaCep = busca.mensagem ?? 'Digite o CEP para preencher rua, bairro, cidade e estado.'

  return (
    <form onSubmit={enviar} noValidate className="acima-3" aria-busy={processando || busca.carregando}>
      <Campo rotulo="Nome do endereço" erro={erros['end-apelido']} id="end-apelido">
        <input id="end-apelido" name="apelido" value={campos.apelido} onChange={(e) => atualizar('apelido', e.target.value)} placeholder="Casa" disabled={processando} />
      </Campo>
      <Campo rotulo="CEP" erro={erros['end-cep']} id="end-cep">
        <input
          id="end-cep"
          name="cep"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={9}
          value={campos.cep}
          onChange={(e) => atualizar('cep', formatarCep(e.target.value))}
          placeholder="50000-000"
          disabled={processando}
        />
      </Campo>
      <p className={busca.situacao === 'inexistente' || busca.situacao === 'erro' ? 'aviso' : 'campo-ajuda'} role="status" aria-live="polite" data-busca-cep={busca.situacao}>
        {ajudaCep}
      </p>
      <Campo rotulo="Rua e número" erro={erros['end-rua']} id="end-rua">
        <input ref={ruaRef} id="end-rua" name="rua" value={campos.rua} onChange={(e) => atualizar('rua', e.target.value)} placeholder="Rua da Aurora, 240" autoComplete="address-line1" disabled={processando} />
      </Campo>
      <Campo rotulo="Bairro" id="end-bairro">
        <input id="end-bairro" name="bairro" value={campos.bairro} onChange={(e) => atualizar('bairro', e.target.value)} placeholder="Boa Vista" disabled={processando} />
      </Campo>
      <div className="grade-dois">
        <Campo rotulo="Cidade" erro={erros['end-cidade']} id="end-cidade">
          <input id="end-cidade" name="cidade" value={campos.cidade} onChange={(e) => atualizar('cidade', e.target.value)} placeholder="Recife" autoComplete="address-level2" disabled={processando} />
        </Campo>
        <SeletorEstado id="end-uf" value={campos.uf} erro={erros['end-uf']} onChange={(valor) => atualizar('uf', valor)} />
      </div>
      <div className="acoes-linha">
        <button type="submit" className="botao botao-primario" disabled={processando}>
          {processando ? 'Salvando…' : 'Salvar endereço'}
        </button>
        <button type="button" className="botao botao-fantasma" disabled={processando} onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
