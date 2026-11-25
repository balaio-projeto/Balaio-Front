import LayoutAdmin from '@/components/admin/LayoutAdmin'
import FiltrosAdmin from '@/components/admin/FiltrosAdmin'
import GerenciarOrganizadores from '@/components/admin/GerenciarOrganizadores'
import PaginacaoAdmin from '@/components/admin/PaginacaoAdmin'
import { Migalhas } from '@/components/ui/Basicos'
import { listarContasAdmin, type FiltroPapelConta } from '@/services/api/contasAdmin.servico'
import { tokenDaSessao } from '@/services/autenticacao'
import { exigirAdmin } from '@/services/sessao/servidor'
import { hrefAdmin, lerFiltrosContas, parametrosContas, TAMANHO_PAGINA_ADMIN } from '@/utils/filtrosAdmin'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const PAPEIS: { papel: FiltroPapelConta; rotulo: string }[] = [
  { papel: 'todos', rotulo: 'Todos' },
  { papel: 'comprador', rotulo: 'Compradores' },
  { papel: 'organizador', rotulo: 'Organizadores' },
]

export default async function Organizadores({ searchParams }: Props) {
  await exigirAdmin('/admin/accounts')
  const filtros = lerFiltrosContas(await searchParams)
  const token = await tokenDaSessao()
  const resposta = await listarContasAdmin({ ...filtros, tamanho: TAMANHO_PAGINA_ADMIN }, token)
  const parametros = parametrosContas(filtros)

  return (
    <LayoutAdmin ativo="organizadores">
      <Migalhas trilha={[{ texto: 'Administração', href: '/admin' }, { texto: 'Organizadores' }]} />

      <h1 className="titulo-pagina">Organizadores</h1>
      <p className="subtitulo-pagina">Organizadores enviam eventos para a agenda.</p>

      <FiltrosAdmin
        caminho="/admin/accounts"
        rotuloChips="Filtrar contas por papel"
        chips={PAPEIS.map(({ papel, rotulo }) => ({
          rotulo,
          href: hrefAdmin('/admin/accounts', parametrosContas({ papel, busca: filtros.busca })),
          ativo: papel === filtros.papel,
        }))}
        busca={filtros.busca}
        rotuloBusca="Buscar conta por nome ou e-mail"
        dica="Nome ou e-mail"
        ocultos={{ papel: parametros.papel }}
        hrefLimpar={hrefAdmin('/admin/accounts', { papel: parametros.papel })}
      />

      <GerenciarOrganizadores
        key={hrefAdmin('/admin/accounts', { ...parametros, pagina: filtros.pagina })}
        contasIniciais={resposta.dados ?? []}
        erro={resposta.erro}
        total={resposta.paginacao?.total ?? resposta.dados?.length ?? 0}
        busca={filtros.busca}
      />

      {!resposta.erro && resposta.paginacao && (
        <PaginacaoAdmin
          paginacao={resposta.paginacao}
          caminho="/admin/accounts"
          parametros={parametros}
          rotulo="Páginas da lista de contas"
        />
      )}
    </LayoutAdmin>
  )
}
