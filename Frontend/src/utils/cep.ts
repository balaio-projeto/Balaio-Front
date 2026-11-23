import { validarEstado } from './validacao'

export type EnderecoPorCep = { cep: string; rua: string; bairro: string; cidade: string; uf: string }

export type ResultadoConsultaCep =
  | { situacao: 'encontrado'; endereco: EnderecoPorCep }
  | { situacao: 'inexistente' }
  | { situacao: 'invalido' }
  | { situacao: 'erro' }

export type SituacaoBuscaCep = 'ocioso' | 'carregando' | 'encontrado' | 'inexistente' | 'erro'

export type PartesDoBairro = { bairro: string; cidade: string; uf: string }

const DIGITOS_DO_CEP = 8
const ENDERECO_VIACEP = 'https://viacep.com.br/ws'
const PRAZO_VIACEP_MS = 8000

export function normalizarCep(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, DIGITOS_DO_CEP)
}

export function cepCompleto(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '')
  return digitos.length === DIGITOS_DO_CEP && !/^0+$/.test(digitos) ? digitos : null
}

export function formatarCep(valor: string): string {
  const digitos = normalizarCep(valor)
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

export function mapearViaCep(resposta: unknown): EnderecoPorCep | null {
  if (!resposta || typeof resposta !== 'object' || Array.isArray(resposta)) return null
  const dados = resposta as Record<string, unknown>
  if (dados.erro === true || dados.erro === 'true') return null
  const cep = cepCompleto(texto(dados.cep))
  const cidade = texto(dados.localidade)
  const uf = texto(dados.uf).toUpperCase()
  if (!cep || !cidade || validarEstado(uf)) return null
  return { cep: formatarCep(cep), rua: texto(dados.logradouro), bairro: texto(dados.bairro), cidade, uf }
}

export function comporBairro({ bairro, cidade, uf }: PartesDoBairro): string {
  return [bairro, cidade, uf.toUpperCase()].map((parte) => parte.trim()).filter(Boolean).join(', ')
}

export function separarBairro(valor: string): PartesDoBairro {
  const partes = valor.split(',').map((parte) => parte.trim()).filter(Boolean)
  const uf = (partes.at(-1) ?? '').toUpperCase()
  if (partes.length >= 2 && !validarEstado(uf)) {
    return { bairro: partes.slice(0, -2).join(', '), cidade: partes.at(-2) ?? '', uf }
  }
  return { bairro: partes.join(', '), cidade: '', uf: '' }
}

export type EntregaDoCheckout = { cep: string; endereco: string; cidade: string; estado: string }

export function entregaDoEnderecoSalvo(endereco: { rua: string; bairro: string; cep: string }): EntregaDoCheckout {
  const partes = separarBairro(endereco.bairro)
  return {
    cep: endereco.cep,
    endereco: [endereco.rua.trim(), partes.bairro].filter(Boolean).join(', '),
    cidade: partes.cidade,
    estado: partes.uf,
  }
}

export function entregaPeloCep(atual: EntregaDoCheckout, encontrado: EnderecoPorCep): EntregaDoCheckout {
  const logradouro = [encontrado.rua, encontrado.bairro].filter(Boolean).join(', ')
  return { cep: encontrado.cep, endereco: logradouro || atual.endereco, cidade: encontrado.cidade, estado: encontrado.uf }
}

export function mensagemDaBuscaCep(situacao: SituacaoBuscaCep): string | null {
  switch (situacao) {
    case 'carregando': return 'Buscando o endereço pelo CEP…'
    case 'encontrado': return 'Endereço preenchido pelo CEP. Confira e informe o número.'
    case 'inexistente': return 'CEP não encontrado. Confira os números ou preencha o endereço manualmente.'
    case 'erro': return 'Não foi possível consultar o CEP agora. Preencha o endereço manualmente.'
    default: return null
  }
}

export async function consultarViaCep(
  valor: string,
  opcoes: { buscar?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ResultadoConsultaCep> {
  const cep = cepCompleto(valor)
  if (!cep) return { situacao: 'invalido' }
  const buscar = opcoes.buscar ?? fetch
  try {
    const resposta = await buscar(`${ENDERECO_VIACEP}/${cep}/json/`, {
      headers: { Accept: 'application/json' },
      signal: opcoes.signal ?? AbortSignal.timeout(PRAZO_VIACEP_MS),
    })
    if (resposta.status === 400) return { situacao: 'inexistente' }
    if (!resposta.ok) return { situacao: 'erro' }
    const corpo: unknown = await resposta.json().catch(() => null)
    if (corpo && typeof corpo === 'object' && 'erro' in corpo) return { situacao: 'inexistente' }
    const endereco = mapearViaCep(corpo)
    return endereco ? { situacao: 'encontrado', endereco } : { situacao: 'erro' }
  } catch {
    return { situacao: 'erro' }
  }
}
