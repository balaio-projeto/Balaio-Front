'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { Campo, Retrato } from '@/components/ui/Basicos'
import Seletor from '@/components/ui/Seletor'
import { avisar } from '@/components/feedback/Avisos'
import { validarObrigatorio } from '@/utils/validacao'
import MapaEventosCliente from '@/components/eventos/MapaEventosCliente'
import { criarEvento, type SubmissaoEvento } from '@/services/api/eventos.servico'
import { gerarSlugEvento } from '@/components/eventos/eventosLocais'
import { coordenadasValidas } from '@/utils/eventos'
import { errosDeCampoDaSubmissao, mensagemErroSubmissao, TEXTO_PENDENCIA } from '@/components/eventos/mensagensSubmissao'
import { hojeNoFusoDoEvento, montarHorario, montarPeriodo, problemasDasDatas } from '@/components/eventos/periodoEvento'
import { municipiosPE, rotuloTipoEvento } from '@/constants/eventos'
import type { Ponto, TipoEvento } from '@/types/dominio'
import { useDados } from '@/store/dados'

const idPorCampo: Record<string, string> = {
  nome: 'evento-nome',
  tipo: 'evento-tipo',
  organizador: 'evento-organizador',
  dataInicio: 'evento-data-inicio',
  dataFim: 'evento-data-fim',
  horarioInicio: 'evento-horario-inicio',
  horarioFim: 'evento-horario-fim',
  cidade: 'evento-cidade',
  entrada: 'evento-entrada',
  local: 'evento-local',
  endereco: 'evento-endereco',
  mapa: 'evento-mapa',
  descricao: 'evento-descricao',
  participantes: 'participantes',
}

const TAMANHO_MAXIMO_ENTRADA = 255

function focarPrimeiroErro(problemas: Record<string, string>) {
  const primeiraChave = Object.keys(idPorCampo).find((chave) => chave in problemas)
  if (primeiraChave) document.getElementById(idPorCampo[primeiraChave])?.focus()
}

const opcoesTipoEvento = (Object.keys(rotuloTipoEvento) as TipoEvento[]).map((chave) => ({
  valor: chave,
  rotulo: rotuloTipoEvento[chave],
}))

const opcoesMunicipio = [
  { valor: '', rotulo: 'Escolha o município' },
  ...municipiosPE.map((municipio) => ({ valor: municipio.nome, rotulo: municipio.nome })),
]

export default function FormCriarEvento() {
  const { artesaos, coletivos, erro: erroParticipantes } = useDados()
  const [salvando, definirSalvando] = useState(false)
  const [nome, definirNome] = useState('')
  const [tipo, definirTipo] = useState<TipoEvento>('feira')
  const [organizador, definirOrganizador] = useState('')
  const [dataInicio, definirDataInicio] = useState('')
  const [dataFim, definirDataFim] = useState('')
  const [horarioInicio, definirHorarioInicio] = useState('')
  const [horarioFim, definirHorarioFim] = useState('')
  const [entrada, definirEntrada] = useState('Gratuita')
  const [cidade, definirCidade] = useState('')
  const [local, definirLocal] = useState('')
  const [endereco, definirEndereco] = useState('')
  const [descricao, definirDescricao] = useState('')
  const [pino, definirPino] = useState<Ponto | null>(null)
  const [artesaosEscolhidos, definirArtesaosEscolhidos] = useState<string[]>([])
  const [coletivosEscolhidos, definirColetivosEscolhidos] = useState<string[]>([])
  const [erros, definirErros] = useState<Record<string, string>>({})
  const [enviado, definirEnviado] = useState<string | null>(null)

  const municipio = municipiosPE.find((m) => m.nome === cidade)
  const centroEscolha = municipio ? { lat: municipio.lat, lng: municipio.lng } : undefined
  const totalParticipantes = artesaosEscolhidos.length + coletivosEscolhidos.length
  const hoje = hojeNoFusoDoEvento()
  const previaPeriodo = montarPeriodo(dataInicio, dataFim)
  const previaHorario = montarHorario(horarioInicio, horarioFim)

  function limparErro(chave: string) {
    definirErros((atuais) => {
      if (!(chave in atuais)) return atuais
      const resto = { ...atuais }
      delete resto[chave]
      return resto
    })
  }

  function escolherDataInicio(valor: string) {
    definirDataInicio(valor)
    limparErro('dataInicio')
    if (valor && (!dataFim || dataFim < valor)) {
      definirDataFim(valor)
      limparErro('dataFim')
    }
  }

  function escolherCidade(nomeCidade: string) {
    definirCidade(nomeCidade)
    limparErro('cidade')
    const escolhido = municipiosPE.find((m) => m.nome === nomeCidade)
    definirPino(escolhido ? { lat: escolhido.lat, lng: escolhido.lng } : null)
  }

  function alternarArtesao(slug: string) {
    limparErro('participantes')
    definirArtesaosEscolhidos((atuais) =>
      atuais.includes(slug) ? atuais.filter((s) => s !== slug) : [...atuais, slug],
    )
  }

  function alternarColetivo(slug: string) {
    limparErro('participantes')
    definirColetivosEscolhidos((atuais) =>
      atuais.includes(slug) ? atuais.filter((s) => s !== slug) : [...atuais, slug],
    )
  }

  function limparFormulario() {
    definirNome('')
    definirTipo('feira')
    definirOrganizador('')
    definirDataInicio('')
    definirDataFim('')
    definirHorarioInicio('')
    definirHorarioFim('')
    definirEntrada('Gratuita')
    definirCidade('')
    definirLocal('')
    definirEndereco('')
    definirDescricao('')
    definirPino(null)
    definirArtesaosEscolhidos([])
    definirColetivosEscolhidos([])
    definirErros({})
    definirEnviado(null)
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (salvando) return

    const problemas: Record<string, string> = {}
    const conferencias: [string, string | null][] = [
      ['nome', validarObrigatorio(nome, 'Dê um nome ao evento, como "Feira de Cerâmica de Tracunhaém"')],
      ['organizador', validarObrigatorio(organizador, 'Diga quem organiza: associação, prefeitura ou grupo')],
      ['cidade', validarObrigatorio(cidade, 'Escolha o município onde o evento acontece')],
      ['local', validarObrigatorio(local, 'Informe o local, como "Pátio de Eventos Luiz Gonzaga"')],
      ['descricao', validarObrigatorio(descricao, 'Conte o que vai acontecer no evento')],
      ['entrada', entrada.trim().length > TAMANHO_MAXIMO_ENTRADA
        ? `Resuma a entrada em até ${TAMANHO_MAXIMO_ENTRADA} caracteres` : null],
      ['participantes', totalParticipantes === 0 ? 'Marque pelo menos um artesão ou coletivo participante' : null],
    ]
    for (const [chave, problema] of conferencias) {
      if (problema) problemas[chave] = problema
    }
    Object.assign(problemas, problemasDasDatas({ dataInicio, dataFim, horarioInicio, horarioFim }, hoje))

    if (Object.keys(problemas).length > 0) {
      definirErros(problemas)
      focarPrimeiroErro(problemas)
      avisar.erro('Confira os campos destacados', 'Alguns dados do evento ainda estão faltando.')
      return
    }

    const referencia = pino ?? centroEscolha
    if (!coordenadasValidas(referencia)) {
      const problemaMapa = { mapa: 'Marque no mapa o ponto exato do evento' }
      definirErros(problemaMapa)
      focarPrimeiroErro(problemaMapa)
      avisar.erro('Confira o ponto no mapa', 'O local marcado não tem coordenadas válidas.')
      return
    }

    const submissao: SubmissaoEvento = {
      slug: gerarSlugEvento(nome),
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
      cidade,
      local: local.trim(),
      endereco: endereco.trim() || `${cidade}, Pernambuco`,
      lat: referencia.lat,
      lng: referencia.lng,
      artesaos: artesaosEscolhidos,
      coletivos: coletivosEscolhidos,
    }

    definirSalvando(true)
    const resposta = await criarEvento(submissao)
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
            Criar outro evento
          </button>
        </div>
      </section>
    )
  }

  return (
    <form className="cartao" onSubmit={enviar} noValidate>
      <h2 className="secao-titulo">Dados do evento</h2>
      {erroParticipantes && <p role="alert">{erroParticipantes}</p>}

      <Campo rotulo="Nome do evento" id="evento-nome" erro={erros.nome}>
        <input
          id="evento-nome"
          type="text"
          placeholder='Como "Feira de Cerâmica de Tracunhaém"'
          value={nome}
          onChange={(e) => {
            definirNome(e.target.value)
            limparErro('nome')
          }}
        />
      </Campo>

      <div className="grade-dois">
        <Campo rotulo="Tipo de evento" id="evento-tipo" erro={erros.tipo}>
          <Seletor
            id="evento-tipo"
            opcoes={opcoesTipoEvento}
            value={tipo}
            onChange={(valor) => {
              definirTipo(valor as TipoEvento)
              limparErro('tipo')
            }}
          />
        </Campo>
        <Campo
          rotulo="Quem organiza"
          id="evento-organizador"
          ajuda="Associação, prefeitura ou grupo responsável"
          erro={erros.organizador}
        >
          <input
            id="evento-organizador"
            type="text"
            placeholder="Como 'Associação dos Ceramistas'"
            value={organizador}
            onChange={(e) => {
              definirOrganizador(e.target.value)
              limparErro('organizador')
            }}
          />
        </Campo>
      </div>

      <div className="grade-dois">
        <Campo rotulo="Começa em" id="evento-data-inicio" erro={erros.dataInicio}>
          <input
            id="evento-data-inicio"
            type="date"
            min={hoje}
            value={dataInicio}
            onChange={(e) => escolherDataInicio(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Termina em" id="evento-data-fim" ajuda="Para evento de um dia, repita a data de início" erro={erros.dataFim}>
          <input
            id="evento-data-fim"
            type="date"
            min={dataInicio || hoje}
            value={dataFim}
            onChange={(e) => {
              definirDataFim(e.target.value)
              limparErro('dataFim')
            }}
          />
        </Campo>
      </div>

      <div className="grade-dois">
        <Campo rotulo="Abre às (opcional)" id="evento-horario-inicio" erro={erros.horarioInicio}>
          <input
            id="evento-horario-inicio"
            type="time"
            value={horarioInicio}
            onChange={(e) => {
              definirHorarioInicio(e.target.value)
              limparErro('horarioInicio')
              limparErro('horarioFim')
            }}
          />
        </Campo>
        <Campo rotulo="Fecha às (opcional)" id="evento-horario-fim" erro={erros.horarioFim}>
          <input
            id="evento-horario-fim"
            type="time"
            value={horarioFim}
            onChange={(e) => {
              definirHorarioFim(e.target.value)
              limparErro('horarioFim')
            }}
          />
        </Campo>
      </div>

      {previaPeriodo && (
        <p className="campo-ajuda abaixo-4">
          Na agenda vai aparecer: <strong>{previaPeriodo}{previaHorario ? ` · ${previaHorario}` : ''}</strong>
        </p>
      )}

      <div className="grade-dois">
        <Campo rotulo="Município" id="evento-cidade" erro={erros.cidade}>
          <Seletor id="evento-cidade" opcoes={opcoesMunicipio} value={cidade} onChange={escolherCidade} />
        </Campo>
        <Campo
          rotulo="Entrada"
          id="evento-entrada"
          ajuda={`Deixe 'Gratuita' se não houver cobrança. Até ${TAMANHO_MAXIMO_ENTRADA} caracteres.`}
          erro={erros.entrada}
        >
          <input
            id="evento-entrada"
            type="text"
            maxLength={TAMANHO_MAXIMO_ENTRADA}
            value={entrada}
            onChange={(e) => {
              definirEntrada(e.target.value)
              limparErro('entrada')
            }}
          />
        </Campo>
      </div>

      <Campo rotulo="Local" id="evento-local" erro={erros.local}>
        <input
          id="evento-local"
          type="text"
          placeholder="Como 'Pátio de Eventos Luiz Gonzaga'"
          value={local}
          onChange={(e) => {
            definirLocal(e.target.value)
            limparErro('local')
          }}
        />
      </Campo>

      <Campo rotulo="Endereço (opcional)" id="evento-endereco" erro={erros.endereco}>
        <input
          id="evento-endereco"
          type="text"
          placeholder="Rua, número e bairro"
          value={endereco}
          onChange={(e) => {
            definirEndereco(e.target.value)
            limparErro('endereco')
          }}
        />
      </Campo>

      <div className="campo" id="evento-mapa" tabIndex={-1}>
        <span className="campo-rotulo">Ponto exato no mapa</span>
        <span className="campo-ajuda">
          {cidade
            ? 'O pino começa no centro do município. Clique no mapa para marcar o endereço exato.'
            : 'Escolha o município para posicionar o pino, ou clique direto no mapa.'}
        </span>
        <div className="mapa-eventos mapa-eventos-escolha">
          <MapaEventosCliente
            aoEscolher={(ponto) => {
              definirPino(ponto)
              limparErro('mapa')
            }}
            escolhido={pino}
            centro={centroEscolha}
            zoom={13}
            rotulo="Mapa para marcar o local exato do evento"
          />
        </div>
        {erros.mapa && (
          <p className="campo-erro acima-2" role="status">
            {erros.mapa}
          </p>
        )}
      </div>

      <Campo rotulo="O que vai acontecer" id="evento-descricao" erro={erros.descricao}>
        <textarea
          id="evento-descricao"
          placeholder="Conte o que o público vai encontrar: exposição, venda direta, oficinas, apresentações..."
          value={descricao}
          onChange={(e) => {
            definirDescricao(e.target.value)
            limparErro('descricao')
          }}
        />
      </Campo>

      <fieldset id="participantes" tabIndex={-1} className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="campo-rotulo">Quem vai participar?</legend>
        <span className="campo-ajuda">Marque os artesãos e coletivos da plataforma confirmados no evento.</span>
        <div className="lista-participantes">
          {artesaos.map((artesao) => (
            <label key={artesao.slug} className="opcao-participante">
              <input
                type="checkbox"
                id={`participante-${artesao.slug}`}
                checked={artesaosEscolhidos.includes(artesao.slug)}
                onChange={() => alternarArtesao(artesao.slug)}
              />
              <Retrato imagem={artesao.imagem} />
              <span className="encolhivel">
                <span className="texto-forte">{artesao.nome}</span>
                <span className="autoria">{artesao.atelie}</span>
              </span>
            </label>
          ))}
          {coletivos.map((coletivo) => (
            <label key={coletivo.slug} className="opcao-participante">
              <input
                type="checkbox"
                id={`participante-${coletivo.slug}`}
                checked={coletivosEscolhidos.includes(coletivo.slug)}
                onChange={() => alternarColetivo(coletivo.slug)}
              />
              <Retrato imagem={coletivo.imagem} />
              <span className="encolhivel">
                <span className="texto-forte">{coletivo.nome}</span>
                <span className="autoria">Coletivo · {coletivo.territorio}</span>
              </span>
            </label>
          ))}
        </div>
        {erros.participantes && (
          <p className="campo-erro acima-2" role="status">
            {erros.participantes}
          </p>
        )}
        {totalParticipantes > 0 && (
          <p className="campo-ajuda acima-2">
            {totalParticipantes} {totalParticipantes === 1 ? 'participante marcado' : 'participantes marcados'}.
          </p>
        )}
      </fieldset>

      <div className="acoes-linha acoes-empilhaveis acima-4">
        <button disabled={salvando || !!erroParticipantes} type="submit" className="botao botao-primario">
          Enviar para análise
        </button>
        <Link href="/events" className="botao botao-fantasma">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
