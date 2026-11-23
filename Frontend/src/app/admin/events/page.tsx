import Link from 'next/link'
import LayoutAdmin from '@/components/admin/LayoutAdmin'
import FilaEventos from '@/components/admin/FilaEventos'
import { resumoDaFilaDeEventos } from '@/components/admin/resumoFilaEventos'
import { Migalhas } from '@/components/ui/Basicos'
import EstadoErro from '@/components/feedback/EstadoErro'
import {
  ehEstadoModeracaoEvento, listarEventosEmModeracao, type EstadoModeracaoEvento,
} from '@/services/api/eventos.servico'
import { tokenDaSessao } from '@/services/autenticacao'
import { exigirAdmin } from '@/services/sessao/servidor'

type Props = { searchParams: Promise<{ estado?: string | string[] }> }

const FILTROS: { estado: EstadoModeracaoEvento; rotulo: string }[] = [
  { estado: 'PENDENTE', rotulo: 'Pendentes' },
  { estado: 'APROVADO', rotulo: 'Aprovados' },
  { estado: 'REJEITADO', rotulo: 'Rejeitados' },
]

export default async function ModeracaoEventos({ searchParams }: Props) {
  await exigirAdmin('/admin/events')
  const { estado: pedido } = await searchParams
  const normalizado = (Array.isArray(pedido) ? pedido[0] : pedido)?.toUpperCase()
  const estado: EstadoModeracaoEvento = ehEstadoModeracaoEvento(normalizado) ? normalizado : 'PENDENTE'
  const token = await tokenDaSessao()
  const { dados: eventos, erro } = await listarEventosEmModeracao(token, estado)

  return (
    <LayoutAdmin ativo="eventos">
      <Migalhas trilha={[{ texto: 'Administração', href: '/admin' }, { texto: 'Eventos' }]} />

      <h1 className="titulo-pagina">Moderação de eventos</h1>
      <p className="subtitulo-pagina">
        {eventos ? resumoDaFilaDeEventos(eventos.length, estado) : 'Propostas enviadas pelos organizadores'} · somente
        eventos aprovados aparecem na agenda pública.
      </p>

      <nav className="chips-filtro abaixo-4" aria-label="Filtrar eventos por estado">
        {FILTROS.map((filtro) => (
          <Link
            key={filtro.estado}
            href={filtro.estado === 'PENDENTE' ? '/admin/events' : `/admin/events?estado=${filtro.estado}`}
            className={`chip-filtro${filtro.estado === estado ? ' chip-filtro-ativo' : ''}`}
            aria-current={filtro.estado === estado ? 'page' : undefined}
          >
            {filtro.rotulo}
          </Link>
        ))}
      </nav>

      {erro || !eventos ? <EstadoErro mensagem={erro?.mensagem} /> : <FilaEventos key={estado} iniciais={eventos} estado={estado} />}
    </LayoutAdmin>
  )
}
