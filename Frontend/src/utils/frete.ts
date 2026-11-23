import type { OpcaoFrete } from '@/types/dominio'

export const PROVEDOR_FRETE_FIXO = 'fixo_demonstrativo'
export const PROVEDOR_MELHOR_ENVIO_SANDBOX = 'melhor_envio_sandbox'
export const PROVEDOR_MELHOR_ENVIO = 'melhor_envio'

export function cepParaCotacao(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '')
  return digitos.length === 8 ? digitos : null
}

export function chaveDaCotacao(cep: string, itens: { slug: string; quantidade: number }[]): string {
  const itensOrdenados = [...itens].sort((a, b) => a.slug.localeCompare(b.slug)).map((item) => `${item.slug}:${item.quantidade}`)
  return `${cep}|${itensOrdenados.join(',')}`
}

export function itensDaChave(chave: string): { cep: string; itens: { slug: string; quantidade: number }[] } {
  const [cep, lista = ''] = chave.split('|')
  const itens = lista.split(',').filter(Boolean).map((parte) => {
    const [slug, quantidade] = parte.split(':')
    return { slug, quantidade: Number(quantidade) }
  })
  return { cep, itens }
}

export function opcaoEscolhida(opcoes: OpcaoFrete[], idAtual: string | null): OpcaoFrete | undefined {
  return opcoes.find((opcao) => opcao.id === idAtual) ?? opcoes[0]
}

export function origemDaCotacao(opcoes: OpcaoFrete[]): string | null {
  const provedor = opcoes[0]?.provedor
  if (provedor === PROVEDOR_MELHOR_ENVIO_SANDBOX) return 'Valores cotados no Melhor Envio Sandbox (ambiente de teste) para o CEP informado.'
  if (provedor === PROVEDOR_MELHOR_ENVIO) return 'Valores cotados no Melhor Envio para o CEP informado.'
  if (provedor === PROVEDOR_FRETE_FIXO) return 'Valor demonstrativo fixo: a cotação real não está configurada neste ambiente.'
  return null
}
