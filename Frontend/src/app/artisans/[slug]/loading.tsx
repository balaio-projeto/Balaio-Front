import Pagina from '@/components/layout/Pagina'
import EstadoCarregando from '@/components/feedback/EstadoCarregando'

export default function Carregando() {
  return (
    <Pagina esqueleto>
      <EstadoCarregando rotulo="Carregando o perfil do artesão…" cartoes={6} />
    </Pagina>
  )
}
