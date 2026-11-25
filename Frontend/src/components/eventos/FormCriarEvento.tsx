'use client'

import Link from 'next/link'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Campo, Retrato } from '@/components/ui/Basicos'
import Seletor from '@/components/ui/Seletor'
import { avisar } from '@/components/feedback/Avisos'
import { validarCEP, validarObrigatorio } from '@/utils/validacao'
import MapaEventosCliente from '@/components/eventos/MapaEventosCliente'
import { criarEvento, type SubmissaoEvento } from '@/services/api/eventos.servico'
import { gerarSlugEvento } from '@/components/eventos/eventosLocais'
import { coordenadasValidas } from '@/utils/eventos'
import { errosDeCampoDaSubmissao, mensagemErroSubmissao, TEXTO_PENDENCIA } from '@/components/eventos/mensagensSubmissao'
import { hojeNoFusoDoEvento, montarHorario, montarPeriodo, problemasDasDatas } from '@/components/eventos/periodoEvento'
import { municipiosPE, rotuloTipoEvento } from '@/constants/eventos'
import { useBuscaCep } from '@/hooks/useBuscaCep'
import { formatarCep, type EnderecoPorCep } from '@/utils/cep'
import { geocodificarEndereco } from '@/utils/geocodificacao'
import type { Ponto, TipoEvento } from '@/types/dominio'
import { useDados } from '@/store/dados'

const idPorCampo: Record<string, string> = {
  nome: 'evento-nome',
  tipo: 'evento-tipo',
  organizador: 'evento-organizador',
  descricao: 'evento-descricao',
  site: 'evento-site',
  dataInicio: 'evento-data-inicio',
  dataFim: 'evento-data-fim',
  horarioInicio: 'evento-horario-inicio',
  horarioFim: 'evento-horario-fim',
  entrada: 'evento-entrada',
  local: 'evento-local',
  cep: 'evento-cep',
  cidade: 'evento-cidade',
  rua: 'evento-rua',
  numero: 'evento-numero',
  bairro: 'evento-bairro',
  complemento: 'evento-complemento',
  referencia: 'evento-referencia',
  endereco: 'evento-rua',
  mapa: 'evento-mapa',
  participantes: 'participantes',
  contatoNome: 'evento-contato-nome',
  contatoTelefone: 'evento-contato-telefone',
  contatoEmail: 'evento-contato-email',
}

const TAMANHO_MAXIMO_ENTRADA = 255
const CENTRO_PADRAO: Ponto = { lat: -8.0631, lng: -34.8711 }

type SituacaoMapa = 'ocioso' | 'buscando' | 'exato' | 'aproximado' | 'nao-encontrado' | 'erro' | 'manual'

const mensagemDoMapa: Record<SituacaoMapa, string> = {
  ocioso: 'Preencha o endereço e localize no mapa. Depois, clique no mapa para ajustar o ponto, se precisar.',
  buscando: 'Localizando o endereço…',
  exato: 'Endereço localizado. Confira o pino e clique no mapa para ajustar, se precisar.',
  aproximado: 'Encontramos só a rua ou a cidade. Clique no mapa para marcar a entrada do evento.',
  'nao-encontrado': 'Não encontramos esse endereço. Confira os dados ou clique no mapa para marcar o ponto.',
  erro: 'Não foi possível consultar o mapa agora. Clique no mapa para marcar o ponto.',
  manual: 'Ponto marcado no mapa.',
}

function focarPrimeiroErro(problemas: Record<string, string>) {
  const primeiraChave = Object.keys(idPorCampo).find((chave) => chave in problemas)
  if (primeiraChave) document.getElementById(idPorCampo[primeiraChave])?.focus()
}

const MARCAS_DE_ACENTO = /\p{Mn}/gu

function normalizarTexto(valor: string) {
  return valor.normalize('NFD').replace(MARCAS_DE_ACENTO, '').toLowerCase().trim()
}

function formatarTelefone(valor: string) {
  const digitos = valor.replace(/\D/g, '').slice(0, 11)
  if (digitos.length <= 2) return digitos ? `(${digitos}` : ''
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
}

function siteNormalizado(valor: string) {
  const limpo = valor.trim()
  if (!limpo) return ''
  return /^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`
}

function siteValido(valor: string) {
  if (!valor) return true
  try {
    const url = new URL(valor)
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.')
  } catch {
    return false
  }
}

const opcoesTipoEvento = (Object.keys(rotuloTipoEvento) as TipoEvento[]).map((chave) => ({
  valor: chave,
  rotulo: rotuloTipoEvento[chave],
}))

function Secao({ numero, titulo, descricao, children }: { numero: number; titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <fieldset className="form-evento-secao">
      <legend className="form-evento-legenda">
        <span className="form-evento-numero" aria-hidden>{numero}</span>
        {titulo}
      </legend>
      {descricao && <p className="form-evento-descricao">{descricao}</p>}
      <div className="form-evento-grade">{children}</div>
    </fieldset>
  )
}

export default function FormCriarEvento() {
  const { artesaos, coletivos, erro: erroParticipantes } = useDados()
  const [salvando, definirSalvando] = useState(false)
  const emVoo = useRef(false)
  const slugDaSubmissao = useRef<string | null>(null)
  const [nome, definirNome] = useState('')
  const [tipo, definirTipo] = useState<TipoEvento>('feira')
  const [organizador, definirOrganizador] = useState('')
  const [descricao, definirDescricao] = useState('')
  const [site, definirSite] = useState('')
  const [dataInicio, definirDataInicio] = useState('')
  const [dataFim, definirDataFim] = useState('')
  const [horarioInicio, definirHorarioInicio] = useState('')
  const [horarioFim, definirHorarioFim] = useState('')
  const [entrada, definirEntrada] = useState('Gratuita')
  const [local, definirLocal] = useState('')
  const [cep, definirCep] = useState('')
  const [cidade, definirCidade] = useState('')
  const [rua, definirRua] = useState('')
  const [numero, definirNumero] = useState('')
  const [bairro, definirBairro] = useState('')
  const [complemento, definirComplemento] = useState('')
  const [referencia, definirReferencia] = useState('')
  const [pino, definirPino] = useState<Ponto | null>(null)
  const [situacaoMapa, definirSituacaoMapa] = useState<SituacaoMapa>('ocioso')
  const [contatoNome, definirContatoNome] = useState('')
  const [contatoTelefone, definirContatoTelefone] = useState('')
  const [contatoEmail, definirContatoEmail] = useState('')
  const [artesaosEscolhidos, definirArtesaosEscolhidos] = useState<string[]>([])
  const [coletivosEscolhidos, definirColetivosEscolhidos] = useState<string[]>([])
  const [erros, definirErros] = useState<Record<string, string>>({})
  const [enviado, definirEnviado] = useState<string | null>(null)
  const numeroRef = useRef<HTMLInputElement>(null)
  const consultaMapa = useRef(0)
  const busca = useBuscaCep(preencherPeloCep)

  const municipio = municipiosPE.find((m) => normalizarTexto(m.nome) === normalizarTexto(cidade))
  const centroMapa = pino ?? (municipio ? { lat: municipio.lat, lng: municipio.lng } : CENTRO_PADRAO)
  const totalParticipantes = artesaosEscolhidos.length + coletivosEscolhidos.length
  const hoje = hojeNoFusoDoEvento()
  const previaPeriodo = montarPeriodo(dataInicio, dataFim)
  const previaHorario = montarHorario(horarioInicio, horarioFim)

  function limparErro(...chaves: string[]) {
    definirErros((atuais) => {
      if (!chaves.some((chave) => chave in atuais)) return atuais
      const resto = { ...atuais }
      for (const chave of chaves) delete resto[chave]
      return resto
    })
  }

  function marcarEnderecoAlterado() {
    if (situacaoMapa !== 'manual') definirSituacaoMapa('ocioso')
  }

  async function localizarNoMapa(dados?: { rua: string; numero: string; bairro: string; cidade: string }) {
    const alvo = dados ?? { rua, numero, bairro, cidade }
    if (!alvo.cidade.trim()) {
      definirErros((atuais) => ({ ...atuais, cidade: 'Informe a cidade para localizar o endereço' }))
      return
    }
    const consulta = ++consultaMapa.current
    definirSituacaoMapa('buscando')
    const resultado = await geocodificarEndereco({ ...alvo, cep })
    if (consulta !== consultaMapa.current) return
    if (resultado.situacao !== 'encontrado') {
      definirSituacaoMapa(resultado.situacao)
      return
    }
    definirPino(resultado.ponto)
    limparErro('mapa')
    definirSituacaoMapa(resultado.precisao === 'endereco' ? 'exato' : 'aproximado')
  }

  function preencherPeloCep(encontrado: EnderecoPorCep) {
    limparErro('cep', 'cidade', 'rua', 'bairro')
    if (encontrado.uf !== 'PE') {
      definirErros((atuais) => ({ ...atuais, cep: 'Informe um CEP de Pernambuco' }))
      return
    }
    const proximaRua = encontrado.rua || rua
    const proximoBairro = encontrado.bairro || bairro
    definirCidade(encontrado.cidade)
    definirRua(proximaRua)
    definirBairro(proximoBairro)
    marcarEnderecoAlterado()
    numeroRef.current?.focus()
    if (numero.trim()) void localizarNoMapa({ rua: proximaRua, numero, bairro: proximoBairro, cidade: encontrado.cidade })
  }

  function escolherDataInicio(valor: string) {
    definirDataInicio(valor)
    limparErro('dataInicio')
    if (valor && (!dataFim || dataFim < valor)) {
      definirDataFim(valor)
      limparErro('dataFim')
    }
  }

  function alternar(lista: string[], slug: string) {
    return lista.includes(slug) ? lista.filter((s) => s !== slug) : [...lista, slug]
  }

  function limparFormulario() {
    slugDaSubmissao.current = null
    definirNome('')
    definirTipo('feira')
    definirOrganizador('')
    definirDescricao('')
    definirSite('')
    definirDataInicio('')
    definirDataFim('')
    definirHorarioInicio('')
    definirHorarioFim('')
    definirEntrada('Gratuita')
    definirLocal('')
    definirCep('')
    busca.esquecerCep()
    definirCidade('')
    definirRua('')
    definirNumero('')
    definirBairro('')
    definirComplemento('')
    definirReferencia('')
    definirPino(null)
    definirSituacaoMapa('ocioso')
    definirContatoNome('')
    definirContatoTelefone('')
    definirContatoEmail('')
    definirArtesaosEscolhidos([])
    definirColetivosEscolhidos([])
    definirErros({})
    definirEnviado(null)
  }

  function validar(): Record<string, string> {
    const problemas: Record<string, string> = {}
    const digitosTelefone = contatoTelefone.replace(/\D/g, '')
    const conferencias: [string, string | null][] = [
      ['nome', validarObrigatorio(nome, 'Dê um nome ao evento')],
      ['organizador', validarObrigatorio(organizador, 'Informe quem organiza o evento')],
      ['descricao', validarObrigatorio(descricao, 'Descreva o que vai acontecer no evento')],
      ['site', siteValido(siteNormalizado(site)) ? null : 'Informe um link válido, como https://instagram.com/feira'],
      ['entrada', entrada.trim().length > TAMANHO_MAXIMO_ENTRADA ? `Use até ${TAMANHO_MAXIMO_ENTRADA} caracteres` : null],
      ['local', validarObrigatorio(local, 'Informe o nome do local')],
      ['cep', cep.trim() ? validarCEP(cep) : null],
      ['cidade', validarObrigatorio(cidade, 'Informe a cidade')],
      ['rua', validarObrigatorio(rua, 'Informe a rua')],
      ['numero', validarObrigatorio(numero, 'Informe o número ou S/N')],
      ['bairro', validarObrigatorio(bairro, 'Informe o bairro')],
      ['mapa', coordenadasValidas(pino ?? undefined) ? null : 'Localize o endereço ou clique no mapa para marcar o ponto'],
      ['participantes', totalParticipantes === 0 ? 'Marque pelo menos um artesão ou coletivo' : null],
      ['contatoNome', validarObrigatorio(contatoNome, 'Informe o nome do responsável')],
      ['contatoTelefone', digitosTelefone.length < 10 ? 'Informe um telefone com DDD' : null],
      ['contatoEmail', contatoEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contatoEmail.trim()) ? 'Informe um e-mail válido' : null],
    ]
    for (const [chave, problema] of conferencias) if (problema) problemas[chave] = problema
    Object.assign(problemas, problemasDasDatas({ dataInicio, dataFim, horarioInicio, horarioFim }, hoje))
    return problemas
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (emVoo.current) return

    const problemas = validar()
    if (Object.keys(problemas).length > 0) {
      definirErros(problemas)
      focarPrimeiroErro(problemas)
      avisar.erro('Confira os campos destacados')
      return
    }

    const numeroFinal = /^s\/?n$/i.test(numero.trim()) ? 'S/N' : numero.trim()
    const logradouro = `${rua.trim()}, ${numeroFinal}${complemento.trim() ? ` - ${complemento.trim()}` : ''}`
    slugDaSubmissao.current ??= gerarSlugEvento(nome)
    const submissao: SubmissaoEvento = {
      slug: slugDaSubmissao.current,
      nome: nome.trim(),
      tipo,
      organizador: organizador.trim(),
      descricao: descricao.trim(),
      periodo: montarPeriodo(dataInicio, dataFim),
      horario: montarHorario(horarioInicio, horarioFim),
      dataInicio,
      dataFim,
      horarioInicio: horarioInicio || null,
      horarioFim: horarioFim || null,
      entrada: entrada.trim() || 'Gratuita',
      cidade: cidade.trim(),
      local: local.trim(),
      endereco: `${logradouro} - ${bairro.trim()}`,
      cep: cep.trim() ? formatarCep(cep) : null,
      rua: rua.trim(),
      numero: numeroFinal,
      bairro: bairro.trim(),
      complemento: complemento.trim() || null,
      referencia: referencia.trim() || null,
      site: siteNormalizado(site) || null,
      lat: pino!.lat,
      lng: pino!.lng,
      artesaos: artesaosEscolhidos,
      coletivos: coletivosEscolhidos,
      contatoNome: contatoNome.trim(),
      contatoTelefone: formatarTelefone(contatoTelefone),
      contatoEmail: contatoEmail.trim() || null,
    }

    emVoo.current = true
    definirSalvando(true)
    const resposta = await criarEvento(submissao)
    emVoo.current = false
    definirSalvando(false)
    if (resposta.erro) {
      const aviso = mensagemErroSubmissao(resposta.erro.codigo)
      const doServidor = errosDeCampoDaSubmissao(resposta.erro)
      if (Object.keys(doServidor).length > 0) {
        definirErros(doServidor)
        focarPrimeiroErro(doServidor)
      }
      avisar.erro(aviso.titulo, aviso.mensagem)
      return
    }
    avisar.sucesso('Evento enviado para análise')
    definirEnviado(submissao.nome)
  }

  if (enviado !== null) {
    return (
      <section className="cartao">
        <span className="selo abaixo-3">
          <span className="selo-ponto" />
          Pendente de análise
        </span>
        <h2 className="secao-titulo">Evento enviado!</h2>
        <p className="texto-suave abaixo-4">
          “{enviado}” foi recebido. {TEXTO_PENDENCIA}
        </p>
        <div className="acoes-linha acoes-empilhaveis">
          <Link href="/events" className="botao botao-secundario">
            Ver a agenda pública
          </Link>
          <button type="button" className="botao botao-fantasma" onClick={limparFormulario}>
            Enviar outro evento
          </button>
        </div>
      </section>
    )
  }

  return (
    <form className="cartao form-evento" onSubmit={enviar} noValidate aria-busy={salvando}>
      {erroParticipantes && <p className="aviso abaixo-4" role="alert">{erroParticipantes}</p>}

      <Secao numero={1} titulo="Sobre o evento">
        <div className="evento-inteiro">
          <Campo rotulo="Nome do evento" id="evento-nome" erro={erros.nome}>
            <input id="evento-nome" type="text" maxLength={150} placeholder="Feira de Cerâmica de Tracunhaém" value={nome}
              onChange={(e) => { definirNome(e.target.value); limparErro('nome') }} />
          </Campo>
        </div>
        <div className="evento-metade">
          <Campo rotulo="Tipo de evento" id="evento-tipo" erro={erros.tipo}>
            <Seletor id="evento-tipo" opcoes={opcoesTipoEvento} value={tipo}
              onChange={(valor) => { definirTipo(valor as TipoEvento); limparErro('tipo') }} />
          </Campo>
        </div>
        <div className="evento-metade">
          <Campo rotulo="Quem organiza" id="evento-organizador" erro={erros.organizador}>
            <input id="evento-organizador" type="text" maxLength={150} placeholder="Associação dos Ceramistas" value={organizador}
              onChange={(e) => { definirOrganizador(e.target.value); limparErro('organizador') }} />
          </Campo>
        </div>
        <div className="evento-inteiro">
          <Campo rotulo="Descrição" id="evento-descricao" erro={erros.descricao}>
            <textarea id="evento-descricao" rows={4} placeholder="Exposição e venda direta, oficinas, apresentações…" value={descricao}
              onChange={(e) => { definirDescricao(e.target.value); limparErro('descricao') }} />
          </Campo>
        </div>
        <div className="evento-inteiro">
          <Campo rotulo="Site ou rede social (opcional)" id="evento-site" erro={erros.site}>
            <input id="evento-site" type="url" inputMode="url" maxLength={300} placeholder="instagram.com/feiradetracunhaem" value={site}
              onChange={(e) => { definirSite(e.target.value); limparErro('site') }} />
          </Campo>
        </div>
      </Secao>

      <Secao numero={2} titulo="Quando">
        <div className="evento-metade">
          <Campo rotulo="Data de início" id="evento-data-inicio" erro={erros.dataInicio}>
            <input id="evento-data-inicio" type="date" min={hoje} value={dataInicio} onChange={(e) => escolherDataInicio(e.target.value)} />
          </Campo>
        </div>
        <div className="evento-metade">
          <Campo rotulo="Data de término" id="evento-data-fim" erro={erros.dataFim}>
            <input id="evento-data-fim" type="date" min={dataInicio || hoje} value={dataFim}
              onChange={(e) => { definirDataFim(e.target.value); limparErro('dataFim') }} />
          </Campo>
        </div>
        <div className="evento-metade">
          <Campo rotulo="Abertura (opcional)" id="evento-horario-inicio" erro={erros.horarioInicio}>
            <input id="evento-horario-inicio" type="time" value={horarioInicio}
              onChange={(e) => { definirHorarioInicio(e.target.value); limparErro('horarioInicio', 'horarioFim') }} />
          </Campo>
        </div>
        <div className="evento-metade">
          <Campo rotulo="Encerramento (opcional)" id="evento-horario-fim" erro={erros.horarioFim}>
            <input id="evento-horario-fim" type="time" value={horarioFim}
              onChange={(e) => { definirHorarioFim(e.target.value); limparErro('horarioFim') }} />
          </Campo>
        </div>
        <div className="evento-inteiro">
          <Campo rotulo="Entrada" id="evento-entrada" erro={erros.entrada}>
            <input id="evento-entrada" type="text" maxLength={TAMANHO_MAXIMO_ENTRADA} value={entrada}
              onChange={(e) => { definirEntrada(e.target.value); limparErro('entrada') }} />
          </Campo>
        </div>
        {previaPeriodo && (
          <p className="evento-inteiro form-evento-previa">
            Na agenda: <strong>{previaPeriodo}{previaHorario ? ` · ${previaHorario}` : ''}</strong>
          </p>
        )}
      </Secao>

      <Secao numero={3} titulo="Onde">
        <div className="evento-inteiro">
          <Campo rotulo="Nome do local" id="evento-local" erro={erros.local}>
            <input id="evento-local" type="text" maxLength={150} placeholder="Pátio de Eventos Luiz Gonzaga" value={local}
              onChange={(e) => { definirLocal(e.target.value); limparErro('local') }} />
          </Campo>
        </div>
        <div className="evento-curto">
          <Campo rotulo="CEP (opcional)" id="evento-cep" ajuda={busca.mensagem ?? undefined} erro={erros.cep}>
            <input id="evento-cep" inputMode="numeric" autoComplete="postal-code" maxLength={9} placeholder="55880-000" value={cep}
              onChange={(e) => {
                const valor = formatarCep(e.target.value)
                definirCep(valor)
                limparErro('cep')
                void busca.buscarCep(valor)
              }} />
          </Campo>
        </div>
        <div className="evento-largo">
          <Campo rotulo="Cidade" id="evento-cidade" erro={erros.cidade}>
            <input id="evento-cidade" type="text" maxLength={150} list="evento-cidades" placeholder="Tracunhaém" value={cidade}
              onChange={(e) => { definirCidade(e.target.value); limparErro('cidade'); marcarEnderecoAlterado() }} />
          </Campo>
          <datalist id="evento-cidades">
            {municipiosPE.map((m) => <option key={m.nome} value={m.nome} />)}
          </datalist>
        </div>
        <div className="evento-largo">
          <Campo rotulo="Rua" id="evento-rua" erro={erros.rua ?? erros.endereco}>
            <input id="evento-rua" type="text" maxLength={200} placeholder="Rua da Matriz" value={rua}
              onChange={(e) => { definirRua(e.target.value); limparErro('rua', 'endereco'); marcarEnderecoAlterado() }} />
          </Campo>
        </div>
        <div className="evento-curto">
          <Campo rotulo="Número" id="evento-numero" erro={erros.numero}>
            <input ref={numeroRef} id="evento-numero" type="text" maxLength={20} placeholder="120 ou S/N" value={numero}
              onChange={(e) => { definirNumero(e.target.value); limparErro('numero'); marcarEnderecoAlterado() }}
              onBlur={() => { if (rua.trim() && cidade.trim() && numero.trim() && situacaoMapa === 'ocioso') void localizarNoMapa() }} />
          </Campo>
        </div>
        <div className="evento-metade">
          <Campo rotulo="Bairro" id="evento-bairro" erro={erros.bairro}>
            <input id="evento-bairro" type="text" maxLength={120} placeholder="Centro" value={bairro}
              onChange={(e) => { definirBairro(e.target.value); limparErro('bairro'); marcarEnderecoAlterado() }} />
          </Campo>
        </div>
        <div className="evento-metade">
          <Campo rotulo="Complemento (opcional)" id="evento-complemento" erro={erros.complemento}>
            <input id="evento-complemento" type="text" maxLength={120} placeholder="Galpão 2" value={complemento}
              onChange={(e) => { definirComplemento(e.target.value); limparErro('complemento') }} />
          </Campo>
        </div>
        <div className="evento-inteiro">
          <Campo rotulo="Ponto de referência (opcional)" id="evento-referencia" erro={erros.referencia}>
            <input id="evento-referencia" type="text" maxLength={200} placeholder="Em frente à Igreja Matriz" value={referencia}
              onChange={(e) => { definirReferencia(e.target.value); limparErro('referencia') }} />
          </Campo>
        </div>

        <div className="evento-inteiro campo" id="evento-mapa" tabIndex={-1}>
          <div className="form-evento-mapa-topo">
            <span className="campo-rotulo">Localização no mapa</span>
            <button type="button" className="botao botao-compacto botao-secundario" disabled={situacaoMapa === 'buscando'}
              onClick={() => void localizarNoMapa()}>
              {situacaoMapa === 'buscando' ? 'Localizando…' : 'Localizar endereço'}
            </button>
          </div>
          <div className="mapa-eventos mapa-eventos-escolha">
            <MapaEventosCliente
              aoEscolher={(ponto) => { definirPino(ponto); limparErro('mapa'); definirSituacaoMapa('manual') }}
              escolhido={pino}
              centro={centroMapa}
              zoom={pino ? 17 : 13}
              rotulo="Mapa para marcar o local exato do evento"
            />
          </div>
          <p className={situacaoMapa === 'nao-encontrado' || situacaoMapa === 'erro' ? 'aviso acima-2' : 'campo-ajuda acima-2'} role="status" aria-live="polite">
            {mensagemDoMapa[situacaoMapa]}
          </p>
          {erros.mapa && <p className="campo-erro" role="alert">{erros.mapa}</p>}
        </div>
      </Secao>

      <Secao numero={4} titulo="Participantes">
        <fieldset id="participantes" tabIndex={-1} className="evento-inteiro form-evento-participantes">
          <legend className="so-leitor">Artesãos e coletivos confirmados</legend>
          <div className="lista-participantes">
            {artesaos.map((artesao) => (
              <label key={artesao.slug} className="opcao-participante">
                <input type="checkbox" id={`participante-${artesao.slug}`} checked={artesaosEscolhidos.includes(artesao.slug)}
                  onChange={() => { limparErro('participantes'); definirArtesaosEscolhidos((atuais) => alternar(atuais, artesao.slug)) }} />
                <Retrato imagem={artesao.imagem} />
                <span className="encolhivel">
                  <span className="texto-forte">{artesao.nome}</span>
                  <span className="autoria">{artesao.atelie}</span>
                </span>
              </label>
            ))}
            {coletivos.map((coletivo) => (
              <label key={coletivo.slug} className="opcao-participante">
                <input type="checkbox" id={`participante-${coletivo.slug}`} checked={coletivosEscolhidos.includes(coletivo.slug)}
                  onChange={() => { limparErro('participantes'); definirColetivosEscolhidos((atuais) => alternar(atuais, coletivo.slug)) }} />
                <Retrato imagem={coletivo.imagem} />
                <span className="encolhivel">
                  <span className="texto-forte">{coletivo.nome}</span>
                  <span className="autoria">Coletivo · {coletivo.territorio}</span>
                </span>
              </label>
            ))}
          </div>
          {erros.participantes && <p className="campo-erro acima-2" role="alert">{erros.participantes}</p>}
          {totalParticipantes > 0 && (
            <p className="campo-ajuda acima-2">
              {totalParticipantes} {totalParticipantes === 1 ? 'participante marcado' : 'participantes marcados'}
            </p>
          )}
        </fieldset>
      </Secao>

      <Secao numero={5} titulo="Contato do responsável" descricao="Visível só para a equipe do Balaio, para confirmar os dados do evento.">
        <div className="evento-metade">
          <Campo rotulo="Nome" id="evento-contato-nome" erro={erros.contatoNome}>
            <input id="evento-contato-nome" type="text" maxLength={120} autoComplete="name" value={contatoNome}
              onChange={(e) => { definirContatoNome(e.target.value); limparErro('contatoNome') }} />
          </Campo>
        </div>
        <div className="evento-metade">
          <Campo rotulo="Telefone" id="evento-contato-telefone" erro={erros.contatoTelefone}>
            <input id="evento-contato-telefone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(81) 99999-0000" value={contatoTelefone}
              onChange={(e) => { definirContatoTelefone(formatarTelefone(e.target.value)); limparErro('contatoTelefone') }} />
          </Campo>
        </div>
        <div className="evento-inteiro">
          <Campo rotulo="E-mail (opcional)" id="evento-contato-email" erro={erros.contatoEmail}>
            <input id="evento-contato-email" type="email" autoComplete="email" maxLength={160} value={contatoEmail}
              onChange={(e) => { definirContatoEmail(e.target.value); limparErro('contatoEmail') }} />
          </Campo>
        </div>
      </Secao>

      <div className="acoes-linha acoes-empilhaveis form-evento-acoes">
        <button disabled={salvando || !!erroParticipantes} type="submit" className="botao botao-primario">
          {salvando ? 'Enviando…' : 'Enviar para análise'}
        </button>
        <Link href="/events" className="botao botao-fantasma">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
