import LayoutAdmin from '@/components/admin/LayoutAdmin'
import FormNovoColetivo from '@/components/admin/FormNovoColetivo'
import EstadoErro from '@/components/feedback/EstadoErro'
import { Migalhas } from '@/components/ui/Basicos'
import { listarArtesaos } from '@/services/api/artesaos.servico'

export const dynamic = 'force-dynamic'

export default async function NovoColetivo() {
  const { dados: artesaos, erro } = await listarArtesaos()
  const opcoes = (artesaos ?? [])
    .map(({ slug, nome, atelie, territorio }) => ({ slug, nome, atelie, territorio }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return (
    <LayoutAdmin ativo="coletivos">
      <Migalhas trilha={[{ texto: 'Administração', href: '/admin' }, { texto: 'Cadastrar coletivo' }]} />

      <h1 className="titulo-pagina">Cadastrar coletivo</h1>
      <p className="subtitulo-pagina">
        Associações e cooperativas reúnem artesãos de um mesmo território. O coletivo ganha uma página pública com a
        história, as parcerias e as peças de quem participa.
      </p>

      {erro || !artesaos ? (
        <EstadoErro mensagem={erro?.mensagem ?? 'Não foi possível carregar os artesãos para escolher os integrantes.'} />
      ) : (
        <FormNovoColetivo artesaos={opcoes} />
      )}
    </LayoutAdmin>
  )
}
