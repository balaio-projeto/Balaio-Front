'use client'

import { Fragment, useRef, useState, type FormEvent } from 'react'
import { Retrato } from '@/components/ui/Basicos'
import { IconeEnviar } from '@/components/ui/Icones'
import { enviarMensagem } from '@/services/api/pedidos.servico'
import { avisar } from '@/components/feedback/Avisos'
import { type Mensagem } from '@/types/dominio'

const FUSO_DA_CONVERSA = 'America/Recife'
export const TAMANHO_MAXIMO_MENSAGEM = 2000
const AVISAR_TAMANHO_A_PARTIR_DE = 1800

export function ContadorMensagem({ id, texto }: { id: string; texto: string }) {
  return (
    <p className="campo-ajuda acima-2" id={id} aria-live="polite">
      {texto.length >= AVISAR_TAMANHO_A_PARTIR_DE && `${texto.length} de ${TAMANHO_MAXIMO_MENSAGEM} caracteres`}
    </p>
  )
}

const formatoChaveDoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_DA_CONVERSA, year: 'numeric', month: '2-digit', day: '2-digit',
})
const formatoHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_DA_CONVERSA, hour: '2-digit', minute: '2-digit' })
const formatoDiaNoAno = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_DA_CONVERSA, day: 'numeric', month: 'long' })
const formatoDiaCompleto = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_DA_CONVERSA, day: 'numeric', month: 'long', year: 'numeric',
})

function instanteDa(mensagem: Mensagem): Date | null {
  if (!mensagem.enviadaEm) return null
  const instante = new Date(mensagem.enviadaEm)
  return Number.isNaN(instante.getTime()) ? null : instante
}

function chaveDoDiaAnterior(chave: string): string {
  const [ano, mes, dia] = chave.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia - 1)).toISOString().slice(0, 10)
}

function rotuloDoDia(instante: Date, hoje: string): string {
  const chave = formatoChaveDoDia.format(instante)
  if (chave === hoje) return 'Hoje'
  if (chave === chaveDoDiaAnterior(hoje)) return 'Ontem'
  return chave.slice(0, 4) === hoje.slice(0, 4) ? formatoDiaNoAno.format(instante) : formatoDiaCompleto.format(instante)
}

type GrupoDeMensagens = { chave: string; instante: Date | null; mensagens: Mensagem[] }

function agruparPorDia(mensagens: Mensagem[]): GrupoDeMensagens[] {
  const grupos: GrupoDeMensagens[] = []
  for (const mensagem of mensagens) {
    const instante = instanteDa(mensagem)
    const chave = instante ? formatoChaveDoDia.format(instante) : 'sem-data'
    const ultimo = grupos.at(-1)
    if (ultimo && ultimo.chave === chave) ultimo.mensagens.push(mensagem)
    else grupos.push({ chave, instante, mensagens: [mensagem] })
  }
  return grupos
}

export function ListaMensagens({ mensagens, minhas }: { mensagens: Mensagem[]; minhas: Mensagem['autor'] }) {
  const [hoje] = useState(() => formatoChaveDoDia.format(new Date()))
  const grupos = agruparPorDia(mensagens)
  const mostrarDias = grupos.some((grupo) => grupo.instante && grupo.chave !== hoje)

  return grupos.map((grupo, indiceGrupo) => (
    <Fragment key={`${grupo.chave}-${indiceGrupo}`}>
      {mostrarDias && grupo.instante && (
        <p className="dado-rotulo" style={{ alignSelf: 'center' }} suppressHydrationWarning>
          {rotuloDoDia(grupo.instante, hoje)}
        </p>
      )}
      {grupo.mensagens.map((m, i) => {
        const instante = instanteDa(m)
        return (
          <div key={m.id ?? i} className={`balao ${m.autor === minhas ? 'balao-meu' : 'balao-deles'}`}>
            {m.texto}
            {instante ? (
              <time className="balao-hora" dateTime={m.enviadaEm} title={`${formatoDiaCompleto.format(instante)}, ${formatoHora.format(instante)}`}>
                {formatoHora.format(instante)}
              </time>
            ) : (
              <span className="balao-hora">{m.hora}</span>
            )}
          </div>
        )
      })}
    </Fragment>
  ))
}

type Props = {
  pedidoId: string
  iniciais: Mensagem[]
  erroCarregamento?: string
  atelie?: string
  imagem?: string
  id?: string
}

export default function ConversaPedido({ iniciais, atelie, imagem, id, pedidoId, erroCarregamento }: Props) {
  const [salvando, definirSalvando] = useState(false)
  const [mensagens, definirMensagens] = useState(iniciais)
  const [rascunho, definirRascunho] = useState('')
  const [erroEnvio, definirErroEnvio] = useState<string | null>(null)
  const envioEmAndamento = useRef(false)
  const tentativaPendente = useRef<{ texto: string; chave: string } | null>(null)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const rascunhoEnviado = rascunho
    const texto = rascunho.trim()
    if (!texto || envioEmAndamento.current) return
    if (texto.length > TAMANHO_MAXIMO_MENSAGEM) {
      definirErroEnvio(`A mensagem pode ter até ${TAMANHO_MAXIMO_MENSAGEM} caracteres.`)
      return
    }
    if (tentativaPendente.current?.texto !== texto) tentativaPendente.current = { texto, chave: crypto.randomUUID() }
    envioEmAndamento.current = true
    definirSalvando(true)
    definirErroEnvio(null)
    try {
      const resposta = await enviarMensagem(pedidoId, { texto }, tentativaPendente.current.chave)
      if (resposta.erro || !resposta.dados) {
        const mensagem = resposta.erro?.mensagem ?? 'Tente novamente em instantes.'
        definirErroEnvio(mensagem)
        avisar.erro('Mensagem não enviada', mensagem)
        return
      }
      const enviada = resposta.dados
      definirMensagens((atuais) => atuais.some((atual) => atual.id === enviada.id && enviada.id)
        ? atuais : [...atuais, enviada])
      tentativaPendente.current = null
      definirRascunho((atual) => atual === rascunhoEnviado ? '' : atual)
    } finally {
      envioEmAndamento.current = false
      definirSalvando(false)
    }
  }

  return (
    <aside className="cartao painel-conversa" id={id}>
      <div className="linha-flex" style={{ paddingBottom: 14, borderBottom: '1px solid var(--linha)' }}>
        <Retrato imagem={imagem} tamanho={44} />
        <div className="encolhivel">
          <p className="texto-forte">{atelie}</p>
          <p className="autoria">Conversa deste pedido</p>
        </div>
      </div>

      <div className="conversa">
        {erroCarregamento && <p role="alert">Não foi possível carregar a conversa: {erroCarregamento}</p>}
        <ListaMensagens mensagens={mensagens} minhas="comprador" />
      </div>

      {erroEnvio && <p className="campo-erro acima-3" role="alert">{erroEnvio} Sua mensagem foi mantida.</p>}

      <form className="conversa-envio" onSubmit={enviar}>
        <label className="so-leitor" htmlFor="mensagem">
          Escreva sua mensagem
        </label>
        <input
          id="mensagem"
          className="campo-select"
          placeholder="Escreva sua mensagem..."
          style={{ flex: 1, minHeight: 48 }}
          value={rascunho}
          maxLength={TAMANHO_MAXIMO_MENSAGEM}
          aria-describedby="mensagem-contador"
          onChange={(evento) => definirRascunho(evento.target.value)}
        />
        <button disabled={salvando} type="submit" className="botao botao-primario" style={{ padding: '0 16px' }} aria-label="Enviar mensagem">
          <IconeEnviar />
        </button>
      </form>
      <ContadorMensagem id="mensagem-contador" texto={rascunho} />
    </aside>
  )
}
