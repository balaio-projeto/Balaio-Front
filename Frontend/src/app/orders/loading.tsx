import Pagina from '@/components/layout/Pagina'
import EstadoCarregando from '@/components/feedback/EstadoCarregando'

export default function Carregando() {
  return (
    <Pagina esqueleto>
      <EstadoCarregando rotulo="Carregando seus pedidos…" cartoes={3} />
    </Pagina>
  )
}
