import { lerMetadadosDoVideo } from '@/utils/midiaVideo'
import {
  atualizarVideo, criarRascunho, enviarArquivoDoVideo, enviarCapaDoVideo, removerVideo, type NovoVideo,
} from './videos.servico'

export type EtapaPublicacao = 'preparando' | 'enviando' | 'publicando'
export type CamposDoVideo = Omit<NovoVideo, 'duracao'>
export type DestinoDoVideo = 'publicar' | 'rascunho'

export type ResultadoPublicacao =
  | { tipo: 'concluida'; capaGerada: boolean }
  | { tipo: 'arquivoIlegivel' }
  | { tipo: 'falhou'; titulo: string; mensagem?: string }
  | { tipo: 'ficouRascunho'; mensagem?: string }

export async function publicarVideo(
  arquivo: File,
  campos: CamposDoVideo,
  destino: DestinoDoVideo,
  aoMudarEtapa: (etapa: EtapaPublicacao) => void,
): Promise<ResultadoPublicacao> {
  aoMudarEtapa('preparando')
  const metadados = await lerMetadadosDoVideo(arquivo).catch(() => null)
  if (!metadados) return { tipo: 'arquivoIlegivel' }

  const rascunho = await criarRascunho({ ...campos, duracao: metadados.duracao })
  if (rascunho.erro || !rascunho.dados) {
    return { tipo: 'falhou', titulo: 'Não foi possível salvar', mensagem: rascunho.erro?.mensagem }
  }
  const id = rascunho.dados.id

  aoMudarEtapa('enviando')
  const envio = await enviarArquivoDoVideo(id, arquivo, metadados.duracao)
  if (envio.erro) {
    const desfeito = await removerVideo(id)
    return {
      tipo: 'falhou',
      titulo: 'O vídeo não foi enviado',
      mensagem: desfeito.erro
        ? `${envio.erro.mensagem} Um rascunho sem arquivo ficou no seu painel; remova-o por lá.`
        : envio.erro.mensagem,
    }
  }

  const capaGerada = metadados.capa ? !(await enviarCapaDoVideo(id, metadados.capa)).erro : false

  if (destino === 'publicar') {
    aoMudarEtapa('publicando')
    const publicado = await atualizarVideo(id, { situacao: 'publicada' })
    if (publicado.erro) return { tipo: 'ficouRascunho', mensagem: publicado.erro.mensagem }
  }
  return { tipo: 'concluida', capaGerada }
}
