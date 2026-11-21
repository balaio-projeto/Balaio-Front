'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Retrato } from '@/components/ui/Basicos'
import { IconeEnviar } from '@/components/ui/Icones'
import { enviarMensagem } from '@/services/api/pedidos.servico'
import { avisar } from '@/components/feedback/Avisos'
import { type Mensagem } from '@/types/dominio'

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
        {mensagens.map((m, i) => (
          <div key={i} className={`balao ${m.autor === 'comprador' ? 'balao-meu' : 'balao-deles'}`}>
            {m.texto}
            <span className="balao-hora">{m.hora}</span>
          </div>
        ))}
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
          onChange={(evento) => definirRascunho(evento.target.value)}
        />
        <button disabled={salvando} type="submit" className="botao botao-primario" style={{ padding: '0 16px' }} aria-label="Enviar mensagem">
          <IconeEnviar />
        </button>
      </form>
    </aside>
  )
}
