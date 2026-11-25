import { Migalhas } from '@/components/ui/Basicos'
import FormPerfilAtelie from '@/components/painel/FormPerfilAtelie'
import FormEnvioProducao from '@/components/painel/FormEnvioProducao'
import FormRecebimento from '@/components/painel/FormRecebimento'
import CartaoSelo from '@/components/painel/CartaoSelo'
import { IconeAviso } from '@/components/ui/Icones'
import EstadoErro from '@/components/feedback/EstadoErro'
import { obterConfiguracoes } from '@/services/api/artesaos.servico'
import { obterMeuSelo } from '@/services/api/curadoria.servico'
import { obterReferencias } from '@/services/api/referencias.servico'
import { exigirArtesao } from '@/services/autenticacao'

export default async function Configuracoes() {
  const { artesao, token } = await exigirArtesao()
  const [refs, { dados: configuracoes, erro: erroConfiguracoes }, { dados: estadoSelo, erro: erroSelo }] = await Promise.all([
    obterReferencias(),
    obterConfiguracoes(artesao.slug, token),
    obterMeuSelo(token),
  ])
  const tecnicas = refs.dados?.tecnicas ?? []
  const territorios = refs.dados?.territorios ?? []

  return (
    <>
      <Migalhas trilha={[{ texto: 'Painel do artesão', href: '/dashboard' }, { texto: 'Configurações da oficina' }]} />
      <h1 className="titulo-pagina">Configurações da oficina</h1>

      <div className="duas-colunas">
        <div>
          <FormPerfilAtelie artesao={artesao} tecnicas={tecnicas} territorios={territorios} />

          {configuracoes ? <FormEnvioProducao slug={artesao.slug} configuracoes={configuracoes} />
            : <EstadoErro mensagem={erroConfiguracoes?.mensagem ?? 'Não foi possível carregar as configurações de envio e recebimento.'} />}
        </div>

        <aside>
          {estadoSelo && !erroSelo ? <CartaoSelo key={`${estadoSelo.selo}-${estadoSelo.solicitacao?.id}-${estadoSelo.solicitacao?.situacao}`} estadoInicial={estadoSelo} />
            : <EstadoErro mensagem={erroSelo?.mensagem ?? 'Não foi possível consultar a solicitação do selo. Tente novamente.'} />}

          {configuracoes && <FormRecebimento slug={artesao.slug} chavePix={configuracoes.chavePix} />}

          <p className="aviso">
            <IconeAviso />
            <span>
              Você não precisa de CNPJ para vender. Se um comprador pedir nota fiscal, a plataforma emite em nome
              do ateliê.
            </span>
          </p>
        </aside>
      </div>
    </>
  )
}
