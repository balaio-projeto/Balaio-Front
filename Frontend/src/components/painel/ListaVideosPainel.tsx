import EstadoVazio from '@/components/feedback/EstadoVazio'
import AcoesVideo from '@/components/painel/AcoesVideo'
import SeloVideo from '@/components/painel/SeloVideo'
import { dataCurta, estadoDoVideo } from '@/components/painel/estadoVideo'
import { IconePlay } from '@/components/ui/Icones'
import ImagemComFallback from '@/components/ui/ImagemComFallback'
import type { Video } from '@/types/dominio'
import { emMilhares } from '@/utils/formato'

const DURACAO_DESCONHECIDA = '0:00'

function resumoDosVideos(videos: Video[]): string {
  const contar = (estado: ReturnType<typeof estadoDoVideo>) => videos.filter((video) => estadoDoVideo(video) === estado).length
  const publicados = contar('publicada')
  const rascunhos = contar('rascunho')
  const suspensos = contar('suspensa')
  return [
    publicados > 0 && (publicados === 1 ? '1 publicado' : `${publicados} publicados`),
    rascunhos > 0 && (rascunhos === 1 ? '1 rascunho' : `${rascunhos} rascunhos`),
    suspensos > 0 && (suspensos === 1 ? '1 suspenso' : `${suspensos} suspensos`),
  ].filter(Boolean).join(' · ')
}

export default function ListaVideosPainel({
  videos,
  nomesDasPecas,
}: {
  videos: Video[]
  nomesDasPecas: Map<string, string>
}) {
  if (videos.length === 0) {
    return (
      <EstadoVazio
        icone={<IconePlay tamanho={34} />}
        titulo="Você ainda não tem vídeos"
        descricao="Os vídeos publicados aparecem aqui e no Ateliê ao vivo."
      />
    )
  }

  return (
    <>
      <p className="autoria abaixo-3">{resumoDosVideos(videos)}</p>
      <ul className="lista-videos-painel escalonado">
        {videos.map((video) => {
          const estado = estadoDoVideo(video)
          const rascunho = estado === 'rascunho'
          const suspenso = estado === 'suspensa'
          const peca = video.peca ? nomesDasPecas.get(video.peca) : undefined
          return (
            <li className="video-painel" key={video.id}>
              <div className="video-painel-capa">
                <ImagemComFallback src={video.capa} alt="" loading="lazy" semImagem={<span className="capa-video-vazia" aria-hidden><IconePlay tamanho={28} /></span>} />
                {video.duracao !== DURACAO_DESCONHECIDA && <span className="video-painel-duracao">{video.duracao}</span>}
              </div>

              <div className="video-painel-info">
                <div className="video-painel-topo">
                  <SeloVideo estado={estado} />
                  {estado === 'publicada' && <span className="dado-rotulo">{video.publicadoEm}</span>}
                  {suspenso && video.suspensao && (
                    <span className="dado-rotulo">desde {dataCurta(video.suspensao.suspensoEm)}</span>
                  )}
                </div>
                {suspenso && video.suspensao && (
                  <div className="video-suspensao" role="note">
                    <strong>Retirado do ar pela administração</strong>
                    <p>Motivo: {video.suspensao.motivo}</p>
                    <p className="autoria">Você pode editar o vídeo; ele volta a aparecer quando a administração reativar.</p>
                  </div>
                )}
                <p className="video-painel-legenda">{video.legenda}</p>
                {peca && <p className="autoria">Peça: {peca}</p>}
                <p className="autoria">
                  {rascunho
                    ? 'Ainda não aparece no Ateliê ao vivo.'
                    : suspenso
                      ? 'Não aparece no Ateliê ao vivo enquanto estiver suspenso.'
                      : `${emMilhares(video.visualizacoes)} visualizações · ${emMilhares(video.curtidas)} curtidas · ${emMilhares(video.comentarios)} comentários`}
                </p>
                <AcoesVideo id={video.id} publicado={estado === 'publicada'} />
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
