import Link from 'next/link'
import { Retrato } from '@/components/ui/Basicos'
import type { ConversaArtesao } from '@/types/dominio'
import { imagemReal } from '@/utils/imagem'
import { codigoDoPedido, nomeDoComprador, rotaPedidoDoArtesao } from '@/utils/pedido'

export function nomeDaPessoaDaConversa(fio: Pick<ConversaArtesao, 'pessoa' | 'comprador'>): string {
  return fio.comprador ? nomeDoComprador(fio.comprador) : nomeDoComprador({ nome: fio.pessoa })
}

export default function CaixaConversas({ fios }: { fios: ConversaArtesao[] }) {
  return (
    <ul className="lista-fios" aria-label="Conversas dos seus pedidos">
      {fios.map((f) => {
        const pessoa = nomeDaPessoaDaConversa(f)
        const codigo = f.codigo ?? codigoDoPedido(f.id)
        return (
          <li key={f.id}>
            <Link
              href={rotaPedidoDoArtesao(f.id, true)}
              id={`fio-${f.id}`}
              className={`fio${f.naoLida ? ' fio-nao-lido' : ''}`}
              aria-label={`Conversa com ${pessoa} sobre o pedido ${codigo}${f.naoLida ? ', mensagem nova' : ''}`}
            >
              <Retrato imagem={imagemReal(f.comprador?.imagem ?? f.retrato)} tamanho={44} />
              <span className="encolhivel" style={{ flex: 1, display: 'block' }}>
                <span className="linha-flex linha-entre" style={{ gap: 10 }}>
                  <span style={{ fontWeight: 600 }}>{pessoa}</span>
                  <span className="dado-rotulo">{f.quando}</span>
                </span>
                <span className="territorio" style={{ textTransform: 'none', letterSpacing: 0, display: 'block' }}>
                  Pedido {codigo}
                </span>
                <span className="previa" style={{ display: 'block' }}>
                  {f.previa}
                </span>
              </span>
              {f.naoLida && <span className="menu-marcador menu-marcador-alerta">nova</span>}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
