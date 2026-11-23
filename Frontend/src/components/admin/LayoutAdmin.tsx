import type { ReactNode } from 'react'
import Pagina from '@/components/layout/Pagina'
import MenuDrawer from '@/components/navegacao/MenuDrawer'
import MenuAdminLateral from '@/components/admin/MenuAdminLateral'
import type { ChaveAdmin } from '@/components/admin/itensAdmin'
import { contarMediacoesEmAberto, listarMediacoes } from '@/services/api/mediacoes.servico'
import { listarFilaCuradoria } from '@/services/api/curadoria.servico'
import AvisoTrocaSenhaAdmin, { CODIGO_TROCA_SENHA_OBRIGATORIA } from '@/components/admin/AvisoTrocaSenhaAdmin'
import { listarEventosEmModeracao } from '@/services/api/eventos.servico'
import { tokenDaSessao } from '@/services/autenticacao'
import { exigirAdmin } from '@/services/sessao/servidor'

type Props = { ativo: ChaveAdmin; children: ReactNode }

export default async function LayoutAdmin({ ativo, children }: Props) {
  await exigirAdmin('/admin')
  const token = await tokenDaSessao()
  const [{ dados: fila, erro: erroFila }, { dados: mediacoes }, { dados: eventosPendentes }] = await Promise.all([
    listarFilaCuradoria(token), listarMediacoes(token), listarEventosEmModeracao(token),
  ])
  const contagens = { curadoria: fila?.length ?? 0, mediacoes: contarMediacoesEmAberto(mediacoes ?? []), eventos: eventosPendentes?.length ?? 0 }
  return (
    <Pagina>
      <MenuDrawer titulo="Curadoria" rotulo="Menu da curadoria">
        <MenuAdminLateral ativo={ativo} contagens={contagens} />
      </MenuDrawer>
      <div className="painel-layout">
        <MenuAdminLateral ativo={ativo} contagens={contagens} />
        <div className="encolhivel">
          {erroFila?.codigo === CODIGO_TROCA_SENHA_OBRIGATORIA && <AvisoTrocaSenhaAdmin />}
          {children}
        </div>
      </div>
    </Pagina>
  )
}
