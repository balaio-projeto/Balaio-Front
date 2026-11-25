'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Campo } from '@/components/ui/Basicos'
import { avisar } from '@/components/feedback/Avisos'
import SeletorEstado from '@/components/forms/SeletorEstado'
import { useBuscaCep } from '@/hooks/useBuscaCep'
import { comporBairro, formatarCep, separarBairro, separarNumero, type EnderecoPorCep } from '@/utils/cep'
import { validarCEP, validarComprimento, validarEstado, validarObrigatorio } from '@/utils/validacao'
import type { EnderecoUsuario } from '@/types/dominio'

export type DadosEndereco = Omit<EnderecoUsuario, 'id' | 'principal'>

type Campos = {
  apelido: string
  cep: string
  rua: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

const LIMITE_APELIDO = 80
const LIMITE_RUA = 255
const LIMITE_NUMERO = 20
const LIMITE_COMPLEMENTO = 100
const LIMITE_BAIRRO = 140
const LIMITE_CIDADE = 100
const LIMITE_BAIRRO_COMPOSTO = 255

function camposIniciais(endereco?: EnderecoUsuario): Campos {
  const partes = separarBairro(endereco?.bairro ?? '')
  const logradouro = separarNumero({ rua: endereco?.rua ?? '', numero: endereco?.numero })
  return {
    apelido: endereco?.apelido ?? '',
    cep: endereco?.cep ?? '',
    ...logradouro,
    complemento: endereco?.complemento ?? '',
    ...partes,
  }
}

function validar(campos: Campos): Record<string, string> {
  const erros: Record<string, string> = {}
  const problemas: [string, string | null][] = [
    ['end-apelido', validarObrigatorio(campos.apelido, 'Dê um nome a este endereço, como Casa')
      ?? validarComprimento(campos.apelido, LIMITE_APELIDO, `Use até ${LIMITE_APELIDO} caracteres no nome do endereço`)],
    ['end-cep', validarCEP(campos.cep)],
    ['end-rua', validarObrigatorio(campos.rua, 'Informe a rua')
      ?? validarComprimento(campos.rua, LIMITE_RUA, `Use até ${LIMITE_RUA} caracteres na rua`)],
    ['end-numero', validarObrigatorio(campos.numero, 'Informe o número ou S/N')
      ?? validarComprimento(campos.numero, LIMITE_NUMERO, `Use até ${LIMITE_NUMERO} caracteres no número`)],
    ['end-complemento', validarComprimento(campos.complemento, LIMITE_COMPLEMENTO, `Use até ${LIMITE_COMPLEMENTO} caracteres no complemento`)],
    ['end-bairro', validarComprimento(campos.bairro, LIMITE_BAIRRO, `Use até ${LIMITE_BAIRRO} caracteres no bairro`)
      ?? validarComprimento(comporBairro(campos), LIMITE_BAIRRO_COMPOSTO, 'Bairro e cidade estão longos demais; abrevie um deles')],
    ['end-cidade', validarObrigatorio(campos.cidade, 'Informe a cidade')
      ?? validarComprimento(campos.cidade, LIMITE_CIDADE, `Use até ${LIMITE_CIDADE} caracteres na cidade`)],
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
  const numeroRef = useRef<HTMLInputElement>(null)
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
    if (encontrado.rua) numeroRef.current?.focus()
    else ruaRef.current?.focus()
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
    const numero = campos.numero.trim()
    aoSalvar({
      apelido: campos.apelido.trim(),
      rua: campos.rua.trim(),
      numero: /^s\/?n$/i.test(numero) ? 'S/N' : numero,
      complemento: campos.complemento.trim(),
      bairro: comporBairro(campos),
      cep: formatarCep(campos.cep),
    })
  }

  return (
    <form onSubmit={enviar} noValidate className="formulario-endereco acima-3" aria-busy={processando || busca.carregando}>
      <div className="endereco-metade">
        <Campo rotulo="Nome do endereço" erro={erros['end-apelido']} id="end-apelido">
          <input id="end-apelido" name="apelido" maxLength={LIMITE_APELIDO} value={campos.apelido} onChange={(e) => atualizar('apelido', e.target.value)} placeholder="Casa" disabled={processando} />
        </Campo>
      </div>
      <div className="endereco-metade endereco-cep">
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
          {busca.mensagem ?? 'Rua, bairro, cidade e estado são preenchidos pelo CEP.'}
        </p>
      </div>
      <div className="endereco-largo">
        <Campo rotulo="Rua" erro={erros['end-rua']} id="end-rua">
          <input ref={ruaRef} id="end-rua" name="rua" maxLength={LIMITE_RUA} value={campos.rua} onChange={(e) => atualizar('rua', e.target.value)} placeholder="Rua da Aurora" autoComplete="address-line1" disabled={processando} />
        </Campo>
      </div>
      <div className="endereco-curto">
        <Campo rotulo="Número" erro={erros['end-numero']} id="end-numero">
          <input ref={numeroRef} id="end-numero" name="numero" maxLength={LIMITE_NUMERO} value={campos.numero} onChange={(e) => atualizar('numero', e.target.value)} placeholder="240 ou S/N" disabled={processando} />
        </Campo>
      </div>
      <div className="endereco-metade">
        <Campo rotulo="Complemento (opcional)" erro={erros['end-complemento']} id="end-complemento">
          <input id="end-complemento" name="complemento" maxLength={LIMITE_COMPLEMENTO} value={campos.complemento} onChange={(e) => atualizar('complemento', e.target.value)} placeholder="Apto 302, bloco B" autoComplete="address-line2" disabled={processando} />
        </Campo>
      </div>
      <div className="endereco-metade">
        <Campo rotulo="Bairro" erro={erros['end-bairro']} id="end-bairro">
          <input id="end-bairro" name="bairro" maxLength={LIMITE_BAIRRO} value={campos.bairro} onChange={(e) => atualizar('bairro', e.target.value)} placeholder="Boa Vista" disabled={processando} />
        </Campo>
      </div>
      <div className="endereco-largo">
        <Campo rotulo="Cidade" erro={erros['end-cidade']} id="end-cidade">
          <input id="end-cidade" name="cidade" maxLength={LIMITE_CIDADE} value={campos.cidade} onChange={(e) => atualizar('cidade', e.target.value)} placeholder="Recife" autoComplete="address-level2" disabled={processando} />
        </Campo>
      </div>
      <div className="endereco-curto">
        <SeletorEstado id="end-uf" value={campos.uf} erro={erros['end-uf']} onChange={(valor) => atualizar('uf', valor)} />
      </div>
      <div className="acoes-linha endereco-acoes">
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
