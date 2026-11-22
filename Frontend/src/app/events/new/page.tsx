import { redirect } from 'next/navigation'
import Link from 'next/link'
import Pagina from '@/components/layout/Pagina'
import { Migalhas } from '@/components/ui/Basicos'
import FormCriarEvento from '@/components/eventos/FormCriarEvento'
import { lerSessao } from '@/services/sessao/servidor'
import { destinoInicial, podeOrganizarEventos, rotaDeLogin } from '@/services/sessao/cookie'

export default async function NovoEvento() {
  const sessao = await lerSessao()
  if (!sessao) redirect(rotaDeLogin('/events/new'))

  if (!podeOrganizarEventos(sessao)) {
    return (
      <Pagina>
        <Migalhas
          trilha={[
            { texto: 'Início', href: '/' },
            { texto: 'Eventos', href: '/events' },
            { texto: 'Organizar um evento' },
          ]}
        />
        <section className="cartao">
          <h1 className="titulo-pagina">Acesso negado</h1>
          <p className="texto-suave abaixo-4">
            Somente contas de organizador de eventos podem enviar eventos. Se você deveria ter esse acesso, fale com a
            equipe do Balaio.
          </p>
          <div className="acoes-linha acoes-empilhaveis">
            <Link href={destinoInicial(sessao)} className="botao botao-secundario">
              Ir para minha área
            </Link>
          </div>
        </section>
      </Pagina>
    )
  }

  return (
    <Pagina>
      <Migalhas
        trilha={[
          { texto: 'Início', href: '/' },
          { texto: 'Eventos', href: '/events' },
          { texto: 'Organizar um evento' },
        ]}
      />

      <h1 className="titulo-pagina">Organize um evento</h1>
      <p className="subtitulo-pagina">
        Envie sua feira, festival ou oficina. A equipe analisa antes da publicação: o evento aparece na agenda e no
        mapa somente depois da aprovação.
      </p>

      <div className="duas-colunas">
        <FormCriarEvento />

        <aside className="cartao">
          <h2 className="secao-titulo">Como funciona</h2>
          <ol className="lista-passos-evento">
            <li>
              <strong>Conte o essencial.</strong> Nome, datas, município e local. O público decide se vai com essas
              quatro informações.
            </li>
            <li>
              <strong>Marque o ponto no mapa.</strong> Ao escolher o município, o pino aparece no centro da cidade.
              Clique no mapa para levá-lo até a entrada do evento.
            </li>
            <li>
              <strong>Aguarde a análise.</strong> Depois da aprovação, os artesãos e coletivos marcados aparecem na página
              do evento com link para as lojas deles.
            </li>
          </ol>
          <p className="texto-suave acima-4">
            O evento aparece na vitrine para quem está perto: a distância é calculada a partir da localização de cada
            visitante.
          </p>
        </aside>
      </div>
    </Pagina>
  )
}
