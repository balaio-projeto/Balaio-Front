'use client'

import Link from 'next/link'
import { Migalhas } from '@/components/ui/Basicos'
import { IconeCalendario, IconeMapa } from '@/components/ui/Icones'
import ListaEscalonada from '@/components/ui/ListaEscalonada'
import EstadoErro from '@/components/feedback/EstadoErro'
import EstadoCarregando from '@/components/feedback/EstadoCarregando'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import MapaEventosCliente from '@/components/eventos/MapaEventosCliente'
import { notaDeLocalizacao, useEventosProximos } from '@/hooks/useEventosProximos'
import { rotuloTipoEvento } from '@/constants/eventos'
import { distanciaLegivel, resumoParticipantes } from '@/utils/eventos'
import { useSessao } from '@/store/sessao'
import { podeOrganizarEventos } from '@/services/sessao/cookie'

export default function AgendaEventos() {
  const { ordenados, pontos, posicao, origem, carregando, erro } = useEventosProximos()
  const { sessao } = useSessao()

  if (carregando) return <EstadoCarregando />
  if (erro) return <EstadoErro mensagem={erro} />

  return (
    <>
      <div className="agenda-cabeca">
        <Migalhas trilha={[{ texto: 'Início', href: '/' }, { texto: 'Eventos' }]} />
        <h1 className="titulo-pagina">Agenda de eventos</h1>
        <p className="mapa-nota">{notaDeLocalizacao(origem)}</p>
      </div>

      <section className="mapa-agenda" aria-label="Mapa da agenda de eventos">
        <div className="mapa-eventos mapa-eventos-agenda">
          <MapaEventosCliente
            eventos={pontos}
            usuario={origem === 'navegador' ? posicao : null}
            comLinks
            rotulo="Mapa com todos os eventos da agenda"
          />
        </div>
      </section>

      {podeOrganizarEventos(sessao) && (
      <div className="acoes-linha acoes-empilhaveis agenda-acao">
        <Link href="/events/new" className="botao botao-primario">
          <IconeCalendario />
          Organizar um evento
        </Link>
      </div>
      )}

      <h2 className="secao-titulo">Todos os eventos, do mais perto ao mais longe</h2>
      {ordenados.length === 0 && (
        <EstadoVazio
          icone={<IconeCalendario tamanho={34} />}
          titulo="Nenhum evento na agenda"
          descricao="Ainda não há feiras, festivais ou oficinas aprovados. Os próximos aparecem aqui depois da análise da equipe."
        />
      )}
      <ListaEscalonada como="ol" className="grade-eventos">
        {ordenados.map(({ evento, distancia }) => (
          <li key={evento.slug}>
            <Link href={`/events/${evento.slug}`} className="cartao-evento cartao-evento-agenda">
              <span className="cartao-evento-selos">
                <span className="selo selo-neutro">{rotuloTipoEvento[evento.tipo]}</span>
                <span className="chip-distancia">
                  <IconeMapa tamanho={13} />
                  {distanciaLegivel(distancia)}
                </span>
              </span>
              <span className="cartao-evento-nome">{evento.nome}</span>
              <span className="cartao-evento-meta">
                {evento.cidade} · {evento.local}
              </span>
              <span className="cartao-evento-meta">{evento.periodo}</span>
              <span className="cartao-evento-rodape">
                <span className="cartao-evento-meta">{resumoParticipantes(evento)}</span>
                <span className="cartao-evento-meta cartao-evento-entrada">{evento.entrada}</span>
              </span>
            </Link>
          </li>
        ))}
      </ListaEscalonada>
    </>
  )
}
