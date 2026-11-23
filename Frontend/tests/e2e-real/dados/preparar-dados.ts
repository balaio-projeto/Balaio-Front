import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { contaComSessao, exigir, inserirPedidoPago, pedidoExiste, sessaoAdmin, type SessaoApi, type UsuarioApi } from '../apoio/pilha'
import { CONTAS, ENDERECO_COMPRADOR, EVENTO_PENDENTE, FOTO_PECA_PNG_BASE64, PECAS, PEDIDOS, RASTREIO_DATASET } from './dataset'

type PecaApi = { slug: string; nome: string; disponibilidade: string; preco: number; situacao?: string; fotos?: { url: string }[] }
type EnderecoApi = { id: string; apelido: string }
type AtelieApi = { slug: string }

export type EstadoDataset = {
  artesao: { id: string; slug: string }
  comprador: { id: string }
  compradorConcorrente: { id: string }
  organizador: { id: string }
  pecas: Record<keyof typeof PECAS, { slug: string; preco: number }>
  pedidos: typeof PEDIDOS
  eventoPendente: string
}

export const ARQUIVO_ESTADO = path.resolve(__dirname, '../../../test-results/e2e-real/dados.json')

async function garantirPecas(artesao: SessaoApi, slugAtelie: string) {
  const existentes = await exigir<PecaApi[]>(artesao.requisitar('GET', `/artesaos/${encodeURIComponent(slugAtelie)}/pecas/painel`), [200], 'painel de peças do artesão')
  const resultado = {} as EstadoDataset['pecas']
  for (const [chave, peca] of Object.entries(PECAS) as [keyof typeof PECAS, (typeof PECAS)[keyof typeof PECAS]][]) {
    let atual = existentes.find((item) => item.nome === peca.nome)
    if (!atual) {
      atual = await exigir<PecaApi>(artesao.requisitar('POST', '/pecas', {
        ...peca,
        situacao: 'publicada',
        fotos: [{ id: 'f0', nome: 'foto-peca.png', url: `data:image/png;base64,${FOTO_PECA_PNG_BASE64}` }],
      }), [201], `cadastro da peça ${peca.nome}`)
    } else if (atual.situacao && atual.situacao !== 'publicada') {
      await artesao.requisitar('POST', `/pecas/${encodeURIComponent(atual.slug)}/reativacao`, {})
    }
    resultado[chave] = { slug: atual.slug, preco: peca.preco }
  }
  return resultado
}

async function garantirEndereco(comprador: SessaoApi) {
  const enderecos = await exigir<EnderecoApi[]>(comprador.requisitar('GET', '/usuario/enderecos'), [200], 'endereços do comprador')
  if (enderecos.some((endereco) => endereco.apelido === ENDERECO_COMPRADOR.apelido)) return
  await exigir(comprador.requisitar('POST', '/usuario/enderecos', ENDERECO_COMPRADOR), [201, 200], 'cadastro do endereço do comprador')
}

async function garantirOrganizador(admin: SessaoApi) {
  const organizador = await contaComSessao(CONTAS.organizador)
  if (organizador.usuario?.papel !== 'organizador') {
    await exigir(admin.requisitar('PATCH', `/admin/contas/${organizador.usuario!.id}/papel`, { papel: 'organizador' }), [204], 'promoção a organizador')
    await exigir(organizador.entrar(CONTAS.organizador.email, CONTAS.organizador.senha), [200], 'login do organizador após a promoção')
  }
  return organizador
}

async function garantirEventoPendente(organizador: SessaoApi, slugAtelie: string) {
  const resposta = await organizador.requisitar('POST', '/eventos', { ...EVENTO_PENDENTE, artesaos: [slugAtelie] })
  if (![201, 200, 409].includes(resposta.status)) {
    throw new Error(`submissão do evento pendente: HTTP ${resposta.status} ${JSON.stringify(resposta.corpo?.erro)}`)
  }
}

function garantirPedidos(estado: Omit<EstadoDataset, 'pedidos' | 'eventoPendente'>) {
  const base = { compradorId: estado.comprador.id, artesaoId: estado.artesao.id, slug: estado.pecas.disponivel.slug, preco: estado.pecas.disponivel.preco, disponibilidade: 'disponivel' }
  if (!pedidoExiste(PEDIDOS.entregueAvaliavel)) inserirPedidoPago({ ...base, id: PEDIDOS.entregueAvaliavel, estado: 'entregue', rastreio: RASTREIO_DATASET })
  if (!pedidoExiste(PEDIDOS.confirmadoNoPainel)) inserirPedidoPago({ ...base, id: PEDIDOS.confirmadoNoPainel, estado: 'confirmado' })
}

export async function prepararDados(): Promise<EstadoDataset> {
  const admin = await sessaoAdmin()
  const artesao = await contaComSessao(CONTAS.artesao)
  const atelie = await exigir<AtelieApi>(artesao.requisitar('GET', '/artesao/me'), [200], 'ateliê do artesão')
  const comprador = await contaComSessao(CONTAS.comprador)
  const compradorConcorrente = await contaComSessao(CONTAS.compradorConcorrente)
  const organizador = await garantirOrganizador(admin)
  const pecas = await garantirPecas(artesao, atelie.slug)
  await garantirEndereco(comprador)
  await garantirEventoPendente(organizador, atelie.slug)
  const id = (sessao: SessaoApi) => (sessao.usuario as UsuarioApi).id
  const parcial = {
    artesao: { id: id(artesao), slug: atelie.slug },
    comprador: { id: id(comprador) },
    compradorConcorrente: { id: id(compradorConcorrente) },
    organizador: { id: id(organizador) },
    pecas,
  }
  garantirPedidos(parcial)
  const estado: EstadoDataset = { ...parcial, pedidos: PEDIDOS, eventoPendente: EVENTO_PENDENTE.slug }
  mkdirSync(path.dirname(ARQUIVO_ESTADO), { recursive: true })
  writeFileSync(ARQUIVO_ESTADO, JSON.stringify(estado, null, 2))
  return estado
}

if (require.main === module) {
  prepararDados()
    .then((estado) => console.log(JSON.stringify(estado, null, 2)))
    .catch((erro) => { console.error(erro instanceof Error ? erro.message : erro); process.exit(1) })
}
