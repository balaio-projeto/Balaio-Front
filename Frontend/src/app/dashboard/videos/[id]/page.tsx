import { notFound } from 'next/navigation'
import FormEditarVideo from '@/components/forms/FormEditarVideo'
import { Migalhas } from '@/components/ui/Basicos'
import ImagemComFallback from '@/components/ui/ImagemComFallback'
import { pecasPainelArtesao } from '@/services/api/pecas.servico'
import { obterVideo } from '@/services/api/videos.servico'
import { exigirArtesao } from '@/services/autenticacao'
import { IconePlay } from '@/components/ui/Icones'

type Props = { params: Promise<{ id: string }> }

export default async function EditarVideo({ params }: Props) {
  const { artesao, token } = await exigirArtesao()
  const { id } = await params
  const [{ dados: video, erro }, { dados: pecasArtesao }] = await Promise.all([
    obterVideo(id, token),
    pecasPainelArtesao(artesao.slug, token),
  ])
  if (erro?.status === 404 || erro?.status === 400) notFound()
  if (erro) throw new Error(erro.mensagem)
  if (!video || video.artesao !== artesao.slug) notFound()
  const pecas = (pecasArtesao ?? []).map((peca) => ({ slug: peca.slug, nome: peca.nome }))

  return (
    <>
      <Migalhas
        trilha={[
          { texto: 'Painel do artesão', href: '/dashboard' },
          { texto: 'Vídeos', href: '/dashboard/videos' },
          { texto: 'Editar vídeo' },
        ]}
      />
      <h1 className="titulo-pagina">Editar vídeo</h1>
      <div className="editar-video-capa">
        <div className="video-painel-capa">
          <ImagemComFallback src={video.capa} alt="" loading="lazy" semImagem={<span className="capa-video-vazia" aria-hidden><IconePlay tamanho={28} /></span>} />
        </div>
        <p className="autoria">O arquivo do vídeo não pode ser trocado aqui. Para usar outro, publique um novo vídeo.</p>
      </div>
      <FormEditarVideo key={video.id} video={video} pecas={pecas} />
    </>
  )
}

