const { createServer } = require('node:http')
const { generateKeyPairSync, sign, verify, randomUUID } = require('node:crypto')
const chaves = generateKeyPairSync('rsa', { modulusLength: 3072 })
const eventos = []
const contas = new Map()
const sacolas = new Map()
const perfis = new Map()
const imagens = new Map()
const preferencias = new Map()
function perfilDaConta(conta) {
  if (!perfis.has(conta.id)) perfis.set(conta.id, {
    id: conta.id, slug: `artesao-${conta.id}`, nome: conta.nome, atelie: `Atelie de ${conta.nome}`,
    historia: '', territorio: '', tecnica: '', imagem: '/fotos/ImagemBase.webp',
    obrasComercializadas: 0, avaliacaoMedia: 0, selo: false,
  })
  return perfis.get(conta.id)
}
let configuracao = {}
const SENHA_TESTE = 'SenhaDeTeste123!'
for (const papel of ['comprador', 'artesao', 'admin']) {
  const email = `${papel}@auth.test`
  contas.set(email, { id: randomUUID(), nome: `Conta real ${papel}`, email, papel, perfil: papel === 'admin' ? undefined : papel, imagem: '', senha: SENHA_TESTE })
}
const publico = (conta) => { const dados = { ...conta }; delete dados.senha; return dados }
const json = (res, status, dados, codigo) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify({ dados, erro: codigo ? { codigo, mensagem: codigo === 'CREDENCIAIS_INVALIDAS' ? 'E-mail ou senha inválidos.' : 'Não foi possível concluir a solicitação.' } : null }))
}
function emitir(conta) {
  const iat = Math.floor(Date.now() / 1000)
  const partes = [Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: conta.id, papel: conta.papel, iss: 'balaio-browser-test', aud: 'api', iat, exp: iat + 3600, jti: randomUUID() })).toString('base64url')]
  const token = `${partes.join('.')}.${sign('RSA-SHA256', Buffer.from(partes.join('.')), chaves.privateKey).toString('base64url')}`
  return token
}
function validar(req) {
  const token = req.headers.authorization?.replace(/^Bearer /, '') ?? /(?:^|;)\s*balaio_sessao=([^;]+)/.exec(req.headers.cookie ?? '')?.[1]
  if (!token || configuracao.expirar) return null
  try {
    const [cabecalho, payload, assinatura] = token.split('.')
    if (!verify('RSA-SHA256', Buffer.from(`${cabecalho}.${payload}`), chaves.publicKey, Buffer.from(assinatura, 'base64url'))) return null
    const claims = JSON.parse(Buffer.from(payload, 'base64url'))
    if (claims.exp <= Date.now() / 1000) return null
    return [...contas.values()].find((conta) => conta.id === claims.sub)
  } catch { return null }
}
const cookie = (token, expirar = false) => `balaio_sessao=${token}; Path=/api/v1; HttpOnly; SameSite=Lax; Max-Age=${expirar ? 0 : 3600}`
const gateway = createServer(async (req, res) => {
  const partes = []
  for await (const parte of req) partes.push(Buffer.from(parte))
  const corpo = Buffer.concat(partes)
  const multipart = req.headers['content-type']?.startsWith('multipart/form-data')
  const dados = corpo.length && !multipart ? JSON.parse(corpo.toString()) : {}
  if (req.url === '/__test/config') { configuracao = { ...configuracao, ...dados }; return json(res, 200, true) }
  if (req.url === '/__test/reset') { configuracao = {}; eventos.length = 0; sacolas.clear(); perfis.clear(); imagens.clear(); preferencias.clear(); return json(res, 200, true) }
  if (req.url === '/__test/eventos') return json(res, 200, eventos)
  if (req.url === '/__test/saude') return json(res, 200, true)
  eventos.push({ destino: 'gateway', caminho: req.url, metodo: req.method, bearer: Boolean(req.headers.authorization) })
  if (/^\/api\/v1\/artesaos\/[^/]+\/configuracoes$/.test(req.url)) {
    const conta = validar(req)
    if (!conta || !req.headers.authorization) return json(res, 401, null, 'NAO_AUTENTICADO')
    if (conta.papel !== 'artesao' || req.url !== `/api/v1/artesaos/artesao-${conta.id}/configuracoes`)
      return json(res, 403, null, 'SEM_PERMISSAO')
    const atual = preferencias.get(conta.id) ?? { cepOrigem: '', prazoPadraoDias: 1, aceitaEncomendas: false, encomendasPausadas: false, chavePix: '' }
    if (req.method === 'PATCH') {
      Object.assign(atual, dados)
      preferencias.set(conta.id, atual)
    }
    return json(res, 200, atual)
  }
  if ((req.method === 'PATCH' && (req.url === '/api/v1/usuario' || req.url.startsWith('/api/v1/conta/')))
      || (req.method === 'POST' && req.url === '/api/v1/auth/alterar-senha')) {
    const conta = validar(req)
    if (!conta) return json(res, 401, null, 'NAO_AUTENTICADO')
    if (req.url.startsWith('/api/v1/conta/') && req.url !== `/api/v1/conta/${conta.id}`) return json(res, 403, null, 'SEM_PERMISSAO')
    if (req.url === '/api/v1/auth/alterar-senha') {
      if (dados.senhaAtual !== conta.senha) return json(res, 400, null, 'ALTERACAO_SENHA_INVALIDA')
      conta.senha = dados.novaSenha
      return json(res, 200, { alterada: true })
    }
    if (dados.email && contas.has(dados.email) && dados.email !== conta.email) return json(res, 409, null, 'EMAIL_EM_USO')
    contas.delete(conta.email)
    if (dados.nome) conta.nome = dados.nome
    if (dados.email) conta.email = dados.email
    contas.set(conta.email, conta)
    return json(res, 200, publico(conta))
  }
  if (configuracao.sacolaTeste) {
    const caminho = new URL(req.url, 'http://127.0.0.1').pathname
    const peca = { slug: 'peca-valida', nome: 'Peça válida', preco: 50, desconto: 0,
      disponibilidade: 'disponivel', artesao: 'atelie-qa', territorio: 'CE', imagem: '',
      tecnica: 'Cerâmica & Barro', categoria: 'Casa', tipo: 'Cerâmica', historia: ['Peça de teste.'] }
    if (req.method === 'GET' && caminho === '/api/v1/pecas') return json(res, 200, [peca])
    if (req.method === 'GET' && caminho.startsWith('/api/v1/pecas/'))
      return caminho.endsWith('/peca-valida') ? json(res, 200, peca) : json(res, 404, null, 'RECURSO_NAO_ENCONTRADO')
    if (req.method === 'GET' && caminho === '/api/v1/fretes')
      return json(res, 200, [{ id: 'padrao', nome: 'Entrega regional', prazo: '10 dias', valor: 38.90 }])
    if (caminho === '/api/v1/estado/sacola') {
      const conta = validar(req)
      if (!conta) return json(res, 401, null, 'NAO_AUTENTICADO')
      if (req.method === 'GET') return json(res, 200, sacolas.get(conta.id) ?? [])
      if (req.method === 'PUT') {
        if (dados.sacola?.some((item) => item.slug !== 'peca-valida')) return json(res, 409, null, 'PECA_INDISPONIVEL')
        sacolas.set(conta.id, dados.sacola)
        return json(res, 200, dados.sacola)
      }
    }
    if (req.method === 'POST' && caminho === '/api/v1/sacola/revalidar') {
      const conta = validar(req)
      if (!conta) return json(res, 401, null, 'NAO_AUTENTICADO')
      if (configuracao.falhaRevalidacao) return json(res, 503, null, 'CATALOGO_INDISPONIVEL')
      const itens = (sacolas.get(conta.id) ?? []).map((item) => ({ ...item,
        precoAtual: configuracao.pecaIndisponivel ? null : (configuracao.precoRevalidado ?? 50),
        disponibilidade: configuracao.pecaIndisponivel ? 'indisponivel' : 'disponivel',
        situacao: configuracao.pecaIndisponivel ? 'indisponivel' : 'disponivel' }))
      return json(res, 200, { itens, podeProsseguir: itens.length > 0 && !configuracao.pecaIndisponivel,
        revalidadoEm: new Date().toISOString() })
    }
    if (req.method === 'POST' && caminho === '/api/v1/checkout')
      return json(res, 202, { id: randomUUID(), checkoutUrl: 'https://sandbox.mercadopago.com/checkout/pay?pref_id=qa' })
  }
  if (/^\/api\/v1\/arquivos\/perfis\/[^/]+$/.test(req.url) && ['GET', 'HEAD'].includes(req.method)) {
    const arquivo = imagens.get(req.url)
    if (!arquivo || ![...perfis.values()].some((perfil) => perfil.imagem === req.url)) return json(res, 404, null, 'MIDIA_NAO_ENCONTRADA')
    res.writeHead(200, { 'Content-Type': arquivo.tipo, 'Content-Length': arquivo.bytes.length,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    res.end(req.method === 'HEAD' ? undefined : arquivo.bytes)
    return
  }
  if (req.method === 'GET' && /^\/api\/v1\/artesaos\/[^/]+$/.test(req.url)) {
    const perfil = [...perfis.values()].find((item) => req.url.endsWith('/' + item.slug))
    return perfil ? json(res, 200, perfil) : json(res, 404, null, 'RECURSO_NAO_ENCONTRADO')
  }
  if (req.url.startsWith('/api/v1/artesao/me') || (req.method === 'PATCH' && /^\/api\/v1\/artesaos\/[^/]+$/.test(req.url))) {
    const conta = validar(req)
    if (!conta) return json(res, 401, null, 'NAO_AUTENTICADO')
    if (conta.papel !== 'artesao') return json(res, 403, null, 'SEM_PERMISSAO')
    const perfil = perfilDaConta(conta)
    if (req.url === '/api/v1/artesao/me' && req.method === 'GET') return json(res, 200, perfil)
    if (req.url === '/api/v1/artesao/me/imagem') {
      if (configuracao.falhaImagem) return json(res, 503, null, 'STORAGE_INDISPONIVEL')
      if (req.method === 'PUT') {
        const form = await new Request('http://fixture.test/upload', { method: 'PUT', headers: { 'Content-Type': req.headers['content-type'] }, body: corpo }).formData()
        const arquivo = form.get('arquivo')
        if (!arquivo || !arquivo.size) return json(res, 400, null, 'ARQUIVO_INVALIDO')
        if (arquivo.size > 2 * 1024 * 1024) return json(res, 413, null, 'ARQUIVO_MUITO_GRANDE')
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) return json(res, 415, null, 'FORMATO_NAO_SUPORTADO')
        perfil.imagem = `/api/v1/arquivos/perfis/${randomUUID()}`
        imagens.set(perfil.imagem, { tipo: arquivo.type, bytes: Buffer.from(await arquivo.arrayBuffer()) })
      } else if (req.method === 'DELETE') perfil.imagem = '/fotos/ImagemBase.webp'
      else return json(res, 405, null, 'METODO_NAO_PERMITIDO')
      return json(res, 200, perfil)
    }
    if (req.method === 'PATCH' && (req.url === '/api/v1/artesao/me' || req.url.endsWith('/' + perfil.slug))) {
      for (const campo of ['nome', 'atelie', 'historia', 'territorio', 'tecnica']) if (typeof dados[campo] === 'string') perfil[campo] = dados[campo]
      return json(res, 200, perfil)
    }
    return json(res, 403, null, 'SEM_PERMISSAO')
  }
  if (req.method === 'GET' && req.url === '/api/v1/usuario') {
    const conta = validar(req)
    if (configuracao.statusUsuario) return json(res, configuracao.statusUsuario, null, 'SEM_PERMISSAO')
    return conta ? json(res, 200, publico(conta)) : json(res, 401, null, 'NAO_AUTENTICADO')
  }
  if (req.method === 'POST' && req.url === '/api/v1/auth/logout') {
    if (configuracao.falhaLogout) return json(res, 503, null, 'INDISPONIVEL')
    res.setHeader('Set-Cookie', cookie('', true))
    return json(res, 200, { encerrada: true })
  }
  if (req.method === 'POST' && ['/api/v1/auth/login', '/api/v1/auth/entrar', '/api/v1/auth/cadastro'].includes(req.url)) {
    const cadastro = req.url.endsWith('/cadastro')
    const email = String(dados.email ?? '').trim().toLowerCase()
    if (cadastro) {
      if (!['comprador', 'artesao'].includes(dados.perfil) || String(dados.senha).length < 12) return json(res, 400, null, 'REQUISICAO_INVALIDA')
      if (contas.has(email)) return json(res, 409, null, 'EMAIL_EM_USO')
      contas.set(email, { id: randomUUID(), nome: dados.nome, email, papel: dados.perfil, perfil: dados.perfil, imagem: '', senha: dados.senha })
    }
    const conta = contas.get(email)
    if (!conta || conta.senha !== dados.senha) return json(res, 401, null, 'CREDENCIAIS_INVALIDAS')
    res.setHeader('Set-Cookie', cookie(emitir(conta)))
    return json(res, cadastro ? 201 : 200, publico(conta))
  }
  json(res, 404, null, 'RECURSO_NAO_ENCONTRADO')
})
gateway.listen(18080, '127.0.0.1')
