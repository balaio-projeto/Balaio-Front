import { Retrato } from '@/components/ui/Basicos'
import type { CompradorDoPedido as Comprador } from '@/types/dominio'
import { imagemReal } from '@/utils/imagem'
import { nomeDoComprador } from '@/utils/pedido'

export default function CompradorDoPedido({ comprador, tamanho = 32 }: { comprador?: Comprador | null; tamanho?: number }) {
  return (
    <span className="linha-flex encolhivel" style={{ gap: 8, flexWrap: 'nowrap' }}>
      <Retrato imagem={imagemReal(comprador?.imagem)} tamanho={tamanho} />
      <span className="encolhivel">{nomeDoComprador(comprador)}</span>
    </span>
  )
}
