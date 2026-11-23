export type MensagemSubmissao = { titulo: string; mensagem: string }

export const TEXTO_PENDENCIA = 'Evento enviado para análise. Ele só aparece na agenda pública depois da aprovação de um administrador.'

/** Traduz o código de erro da submissão. 403 não é repetido automaticamente: o usuário decide nova tentativa. */
export function mensagemErroSubmissao(codigo: string | undefined): MensagemSubmissao {
  if (codigo === 'SEM_PERMISSAO') {
    return {
      titulo: 'Permissão ainda não ativa',
      mensagem: 'Sua permissão de organizador não está ativa nesta sessão. Entre novamente para atualizar seu acesso.',
    }
  }
  if (codigo === 'NAO_AUTENTICADO') {
    return { titulo: 'Sessão expirada', mensagem: 'Entre novamente para enviar o evento.' }
  }
  if (codigo === 'EVENTO_JA_EXISTENTE') {
    return { titulo: 'Evento já cadastrado', mensagem: 'Já existe um evento com esse nome. Ajuste o nome e envie de novo.' }
  }
  if (codigo === 'REQUISICAO_INVALIDA') {
    return { titulo: 'Confira os campos destacados', mensagem: 'O servidor recusou alguns dados do evento.' }
  }
  return { titulo: 'Não foi possível enviar', mensagem: 'Tente novamente em instantes.' }
}

const CAMPO_DO_FORMULARIO: Record<string, string> = {
  slug: 'nome',
  nome: 'nome',
  tipo: 'tipo',
  organizador: 'organizador',
  descricao: 'descricao',
  periodo: 'dataInicio',
  horario: 'horarioInicio',
  dataInicio: 'dataInicio',
  dataFim: 'dataFim',
  horarioInicio: 'horarioInicio',
  horarioFim: 'horarioFim',
  entrada: 'entrada',
  cidade: 'cidade',
  local: 'local',
  endereco: 'endereco',
  lat: 'mapa',
  lng: 'mapa',
  artesaos: 'participantes',
  coletivos: 'participantes',
}

const CAMPO_DA_REGRA_DO_SERVIDOR: Record<string, string> = {
  'Datas inicial e final devem ser informadas juntas.': 'dataFim',
  'Data final anterior à data inicial.': 'dataFim',
  'Coordenadas geográficas inválidas.': 'mapa',
}

export const MENSAGEM_EVENTO_REPETIDO = 'Já existe um evento com esse nome. Ajuste o nome e envie de novo.'

export function errosDeCampoDaSubmissao(
  erro: { codigo: string; mensagem?: string; campos?: Record<string, string>; campo?: string } | null | undefined,
): Record<string, string> {
  if (!erro) return {}
  if (erro.codigo === 'EVENTO_JA_EXISTENTE') return { nome: MENSAGEM_EVENTO_REPETIDO }
  const campos = { ...(erro.campos ?? {}) }
  if (erro.campo && !(erro.campo in campos)) campos[erro.campo] = erro.mensagem ?? 'Valor inválido.'
  const erros: Record<string, string> = {}
  const mensagemDaRegra = erro.mensagem ?? ''
  const campoDaRegra = Object.hasOwn(CAMPO_DA_REGRA_DO_SERVIDOR, mensagemDaRegra) ? CAMPO_DA_REGRA_DO_SERVIDOR[mensagemDaRegra] : undefined
  if (campoDaRegra && Object.keys(campos).length === 0) erros[campoDaRegra] = mensagemDaRegra
  for (const [campo, mensagem] of Object.entries(campos)) {
    const chave = CAMPO_DO_FORMULARIO[campo.replace(/\[.*$/, '')]
    if (chave && !(chave in erros)) erros[chave] = mensagem
  }
  return erros
}
