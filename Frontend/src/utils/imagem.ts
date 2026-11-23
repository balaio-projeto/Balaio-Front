const PREFIXO_DAS_IMAGENS_DE_DEMONSTRACAO = '/fotos/'

function caminhoDe(endereco: string): string {
  try { return new URL(endereco, 'http://balaio.local').pathname }
  catch { return endereco }
}

export function imagemReal(imagem?: string | null): string | undefined {
  const valor = imagem?.trim()
  if (!valor) return undefined
  return caminhoDe(valor).startsWith(PREFIXO_DAS_IMAGENS_DE_DEMONSTRACAO) ? undefined : valor
}
