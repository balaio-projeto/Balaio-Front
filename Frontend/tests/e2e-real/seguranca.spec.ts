import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { carimbo, estadoDataset } from './apoio/navegador'
import { contaComSessao, exigir, sessaoAdmin, SessaoApi, tokenInterno, URL_CATALOG_INTERNO, URL_GATEWAY } from './apoio/pilha'
import { CONTAS, FOTO_PECA_PNG_BASE64, PECAS } from './dados/dataset'

type Caso = { metodo: string; caminho: string; corpo?: unknown }

const PROTEGIDAS: Caso[] = [
  { metodo: 'GET', caminho: '/usuario' },
  { metodo: 'GET', caminho: '/usuario/enderecos' },
  { metodo: 'GET', caminho: '/pedidos' },
  { metodo: 'POST', caminho: '/checkout', corpo: {} },
  { metodo: 'POST', caminho: '/pecas', corpo: {} },
  { metodo: 'GET', caminho: '/artesao/vendas' },
  { metodo: 'GET', caminho: '/artesao/painel/resumo' },
  { metodo: 'POST', caminho: '/eventos', corpo: {} },
  { metodo: 'GET', caminho: '/admin/eventos' },
  { metodo: 'GET', caminho: '/admin/curadoria' },
  { metodo: 'PATCH', caminho: `/admin/contas/${randomUUID()}/papel`, corpo: { papel: 'organizador' } },
]

const status = async (sessao: SessaoApi, caso: Caso) => (await sessao.requisitar(caso.metodo, caso.caminho, caso.corpo)).status

test.describe('regressão de segurança e consistência pelo gateway', () => {
  test('rotas protegidas recusam visitante com 401', async () => {
    const anonimo = new SessaoApi()
    for (const caso of PROTEGIDAS) expect(await status(anonimo, caso), `${caso.metodo} ${caso.caminho}`).toBe(401)
  })

  test('cada papel recebe 403 fora do seu escopo', async () => {
    const comprador = await contaComSessao(CONTAS.comprador)
    const artesao = await contaComSessao(CONTAS.artesao)
    const organizador = await contaComSessao(CONTAS.organizador)
    const admin = await sessaoAdmin()
    const esperados: [string, SessaoApi, Caso][] = [
      ['comprador', comprador, { metodo: 'POST', caminho: '/pecas', corpo: {} }],
      ['comprador', comprador, { metodo: 'GET', caminho: '/artesao/vendas' }],
      ['comprador', comprador, { metodo: 'GET', caminho: '/admin/eventos' }],
      ['comprador', comprador, { metodo: 'POST', caminho: '/eventos', corpo: {} }],
      ['artesão', artesao, { metodo: 'GET', caminho: '/admin/curadoria' }],
      ['artesão', artesao, { metodo: 'POST', caminho: '/eventos', corpo: {} }],
      ['organizador', organizador, { metodo: 'GET', caminho: '/usuario/enderecos' }],
      ['organizador', organizador, { metodo: 'GET', caminho: '/admin/eventos' }],
      ['organizador', organizador, { metodo: 'POST', caminho: '/pecas', corpo: {} }],
      ['admin', admin, { metodo: 'POST', caminho: '/eventos', corpo: {} }],
      ['admin', admin, { metodo: 'POST', caminho: '/pecas', corpo: {} }],
    ]
    for (const [papel, sessao, caso] of esperados) {
      expect(await status(sessao, caso), `${papel} em ${caso.metodo} ${caso.caminho}`).toBe(403)
    }
    expect((await admin.requisitar('GET', '/admin/eventos?estado=PENDENTE')).status).toBe(200)
    expect((await organizador.requisitar('GET', '/usuario')).status).toBe(200)
    expect((await artesao.requisitar('GET', '/usuario/enderecos')).status).toBe(200)
  })

  test('JWT adulterado e identidade forjada não passam', async () => {
    const comprador = await contaComSessao(CONTAS.comprador)
    const [cabecalho, , assinatura] = comprador.jwt!.split('.')
    const forjado = Buffer.from(JSON.stringify({ sub: randomUUID(), papel: 'admin', exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url')
    const resposta = await fetch(`${URL_GATEWAY}/api/v1/admin/eventos`, { headers: { Authorization: `Bearer ${cabecalho}.${forjado}.${assinatura}` } })
    expect(resposta.status).toBe(401)
    const comCabecalho = await comprador.requisitar('GET', '/admin/eventos', undefined, { 'X-User-Role': 'admin', 'X-Balaio-Papel': 'admin' })
    expect(comCabecalho.status).toBe(403)
  })

  test('isolamento entre contas: pedido alheio não é lido nem alterado', async () => {
    const { pedidos } = estadoDataset()
    const outroComprador = await contaComSessao(CONTAS.compradorConcorrente)
    expect([403, 404]).toContain((await outroComprador.requisitar('GET', `/pedidos/${pedidos.entregueAvaliavel}`)).status)
    expect([403, 404]).toContain((await outroComprador.requisitar('GET', `/pedidos/${pedidos.entregueAvaliavel}/conversa`)).status)
    expect([403, 404, 409]).toContain((await outroComprador.requisitar('POST', `/pedidos/${pedidos.entregueAvaliavel}/avaliacao`, { nota: 1, comentario: 'tentativa de outra conta' })).status)
    const outroArtesao = await contaComSessao({ nome: 'Artesão Intruso E2E', email: `qa-e2e-intruso-${carimbo()}@teste.local`, senha: CONTAS.artesao.senha, perfil: 'artesao' })
    expect([403, 404, 409]).toContain((await outroArtesao.requisitar('PATCH', `/pedidos/${pedidos.confirmadoNoPainel}/estado`, { estado: 'producao' })).status)
    expect([403, 404]).toContain((await outroArtesao.requisitar('PATCH', `/pecas/${PECAS.disponivel.nome.toLowerCase().replaceAll(' ', '-')}`, { preco: 1 })).status)
  })

  test('peça única: duas reservas simultâneas não vendem a mesma peça', async () => {
    const artesao = await contaComSessao(CONTAS.artesao)
    const peca = await exigir<{ slug: string }>(artesao.requisitar('POST', '/pecas', {
      ...PECAS.unica, nome: `Vaso único concorrência ${carimbo()}`, situacao: 'publicada',
      fotos: [{ id: 'f0', nome: 'foto-peca.png', url: `data:image/png;base64,${FOTO_PECA_PNG_BASE64}` }],
    }), [201], 'peça única da concorrência')
    const reservar = (pedidoId: string) => fetch(`${URL_CATALOG_INTERNO}/internal/v1/reservas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Balaio-Service-Token': tokenInterno() },
      body: JSON.stringify({ pedidoId, slug: peca.slug, chave: `e2e-${pedidoId}` }),
    })
    const pedidos = [randomUUID(), randomUUID()]
    const respostas = await Promise.all(pedidos.map(reservar))
    const codigos = respostas.map((resposta) => resposta.status).sort()
    expect(codigos).toEqual([201, 409])
    const perdedora = await respostas.find((resposta) => resposta.status === 409)!.json()
    expect(perdedora.erro.codigo).toBe('PECA_INDISPONIVEL')
    expect((await fetch(`${URL_GATEWAY}/internal/v1/reservas`, { method: 'POST' })).status).not.toBe(201)
    await artesao.requisitar('DELETE', `/pecas/${peca.slug}`)
  })

  test('checkouts simultâneos sem Mercado Pago terminam no 503 documentado, sem pedido duplicado', async () => {
    const { pecas } = estadoDataset()
    const comprador = await contaComSessao(CONTAS.compradorConcorrente)
    const corpo = { itens: [{ slug: pecas.unica.slug, quantidade: 1 }], freteId: 'padrao', meio: 'checkout_pro', endereco: { cep: '01310-100', endereco: 'Avenida Paulista, 1000', cidade: 'São Paulo', estado: 'SP' } }
    const antes = (await comprador.requisitar<unknown[]>('GET', '/pedidos')).corpo?.dados?.length ?? 0
    const respostas = await Promise.all([1, 2].map(() => comprador.requisitar('POST', '/checkout', corpo, { 'Idempotency-Key': randomUUID() })))
    const depois = (await comprador.requisitar<unknown[]>('GET', '/pedidos')).corpo?.dados?.length ?? 0
    if (respostas.every((resposta) => resposta.status === 503)) {
      expect(respostas.map((resposta) => resposta.corpo?.erro?.codigo)).toEqual(['PAGAMENTO_INDISPONIVEL', 'PAGAMENTO_INDISPONIVEL'])
      expect(depois).toBe(antes)
    } else {
      expect(respostas.map((resposta) => resposta.status).sort()).toEqual([201, 409])
    }
  })

  test('frete indisponível e upload inválido são recusados com erro de negócio', async () => {
    const anonimo = new SessaoApi()
    const freteInvalido = await anonimo.requisitar('GET', '/fretes?cep=123&itens=jarra-qa-pronta-entrega:1')
    expect(freteInvalido.status).toBe(400)
    const itensInvalidos = await anonimo.requisitar('GET', '/fretes?cep=01310100&itens=;;')
    expect(itensInvalidos.status).toBe(400)
    const artesao = await contaComSessao(CONTAS.artesao)
    const upload = await artesao.requisitar('POST', '/pecas', {
      ...PECAS.disponivel, nome: `Upload inválido ${carimbo()}`, situacao: 'publicada',
      fotos: [{ id: 'f0', nome: 'nao-imagem.txt', url: `data:text/plain;base64,${Buffer.from('não sou imagem').toString('base64')}` }],
    })
    expect(upload.status).toBe(400)
  })
})
