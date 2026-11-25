'use client'

import Link from 'next/link'
import { Retrato } from '@/components/ui/Basicos'
import { IconeNovaAba, IconeSetaDireita } from '@/components/ui/Icones'
import { enderecoDoEvento, linkDeRota } from '@/utils/eventos'
import MapaEventosCliente from '@/components/eventos/MapaEventosCliente'
import { rotuloTipoEvento } from '@/constants/eventos'
import type { Evento } from '@/types/dominio'
import { useDados } from '@/store/dados'

export default function DetalheEvento({ evento }: { evento: Evento }) {
  const { artesaos, coletivos } = useDados()
  const artesaosDoEvento = evento.artesaos
    .map((slug) => artesaos.find((a) => a.slug === slug))
    .filter((artesao): artesao is NonNullable<typeof artesao> => Boolean(artesao))
  const coletivosDoEvento = evento.coletivos
    .map((slug) => coletivos.find((c) => c.slug === slug))
    .filter((coletivo): coletivo is NonNullable<typeof coletivo> => Boolean(coletivo))
  const semParticipantes = artesaosDoEvento.length === 0 && coletivosDoEvento.length === 0
  const endereco = enderecoDoEvento(evento)

  return (
    <>
      <div className="linha-flex abaixo-3">
        <span className="selo selo-neutro">{rotuloTipoEvento[evento.tipo]}</span>
      </div>

      <h1 className="titulo-pagina">{evento.nome}</h1>
      <p className="subtitulo-pagina">
        {evento.periodo} · {evento.cidade}, Pernambuco
      </p>

      <div className="duas-colunas">
        <div>
          <section className="cartao abaixo-5">
            <h2 className="secao-titulo">Sobre o evento</h2>
            <p className="texto-suave abaixo-4" style={{ whiteSpace: 'pre-line' }}>{evento.descricao}</p>
            <dl className="detalhes-evento">
              <div>
                <dt>Quando</dt>
                <dd>{evento.periodo}</dd>
              </div>
              <div>
                <dt>Horário</dt>
                <dd>{evento.horario || 'A confirmar'}</dd>
              </div>
              <div>
                <dt>Entrada</dt>
                <dd>{evento.entrada}</dd>
              </div>
              <div>
                <dt>Organização</dt>
                <dd>{evento.organizador}</dd>
              </div>
            </dl>
            {evento.site && (
              <a className="botao botao-secundario acima-4" href={evento.site} target="_blank" rel="noopener noreferrer">
                Mais informações
                <IconeNovaAba tamanho={16} />
              </a>
            )}
          </section>

          <section className="cartao">
            <h2 className="secao-titulo">Quem vai estar lá</h2>
            {semParticipantes ? (
              <p className="texto-suave">Os participantes ainda serão confirmados pelo organizador.</p>
            ) : (
              <div className="grade-participantes">
                {artesaosDoEvento.map((artesao) => (
                  <Link key={artesao.slug} href={`/artisans/${artesao.slug}`} className="cartao-participante">
                    <Retrato imagem={artesao.imagem} />
                    <span className="encolhivel">
                      <span className="texto-forte">{artesao.nome}</span>
                      <span className="autoria">
                        {artesao.atelie} · {artesao.territorio}
                      </span>
                    </span>
                  </Link>
                ))}
                {coletivosDoEvento.map((coletivo) => (
                  <Link key={coletivo.slug} href={`/collectives/${coletivo.slug}`} className="cartao-participante">
                    <Retrato imagem={coletivo.imagem} />
                    <span className="encolhivel">
                      <span className="texto-forte">{coletivo.nome}</span>
                      <span className="autoria">Coletivo · {coletivo.territorio}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="cartao">
          <h2 className="secao-titulo">Onde vai ser</h2>
          <div className="mapa-eventos mapa-eventos-mini abaixo-4">
            <MapaEventosCliente
              eventos={[
                {
                  slug: evento.slug,
                  nome: evento.nome,
                  cidade: evento.cidade,
                  periodo: evento.periodo,
                  lat: evento.lat,
                  lng: evento.lng,
                },
              ]}
              zoom={16}
              rotulo={`Mapa com o local do evento: ${evento.local}`}
            />
          </div>
          <dl className="detalhes-evento detalhes-evento-local">
            <div>
              <dt>Local</dt>
              <dd>{evento.local}</dd>
            </div>
            <div>
              <dt>Endereço</dt>
              <dd>
                {endereco.logradouro}
                <span className="detalhes-evento-regiao">{endereco.regiao}</span>
              </dd>
            </div>
            {endereco.referencia && (
              <div>
                <dt>Ponto de referência</dt>
                <dd>{endereco.referencia}</dd>
              </div>
            )}
          </dl>
          <a className="botao botao-secundario botao-largo acima-4" href={linkDeRota(evento)} target="_blank" rel="noopener noreferrer">
            Traçar rota no Google Maps
            <IconeSetaDireita />
          </a>
        </aside>
      </div>
    </>
  )
}
