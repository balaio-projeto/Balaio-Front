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
  return { titulo: 'Não foi possível enviar', mensagem: 'Tente novamente em instantes.' }
}
