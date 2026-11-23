import Pagina from '@/components/layout/Pagina'
import EstadoCarregando from '@/components/feedback/EstadoCarregando'

export default function Carregando() {
  return (
    <Pagina esqueleto>
      <EstadoCarregando rotulo="Carregando a vitrine…" cartoes={9} />
    </Pagina>
  )
}
