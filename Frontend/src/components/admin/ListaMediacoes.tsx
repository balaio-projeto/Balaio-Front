'use client'

import { useEffect, useRef, useState } from 'react'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { avisar } from '@/components/feedback/Avisos'
import { IconeAviso } from '@/components/ui/Icones'
import {
  DECISOES_DE_MEDIACAO, cancelarMediacao, decidirMediacao as registrarDecisao, ehDecisaoDeMediacao,
  iniciarAnaliseDaMediacao, reprocessarEntregaDaMediacao,
  type DecisaoMediacao,
} from '@/services/api/mediacoes.servico'
import { type Mediacao } from '@/types/dominio'
import { CLASSE_DO_SELO_DA_MEDIACAO, mediacaoAceitaCancelamento } from '@/components/pedido/situacaoMediacao'
import { codigoDoPedido } from '@/utils/pedido'

export default function ListaMediacoes({ iniciais }: { iniciais: Mediacao[] }) {
  const [lista, definirLista] = useState<Mediacao[]>(iniciais)
  const [abertas, definirAbertas] = useState<string[]>([])
  const [processando, definirProcessando] = useState<string[]>([])
  const [confirmandoEncerramento, definirConfirmandoEncerramento] = useState<string | null>(null)
  const emAndamento = useRef(new Set<string>())

  function comecar(id: string): boolean {
    if (emAndamento.current.has(id)) return false
    emAndamento.current.add(id)
    definirProcessando((atuais) => [...atuais, id])
    return true
  }

  function terminar(id: string) {
    emAndamento.current.delete(id)
    definirProcessando((atuais) => atuais.filter((item) => item !== id))
  }

  useEffect(() => {
    definirLista(iniciais)
  }, [iniciais])

  async function abrirMediacao(m: Mediacao) {
    if (m.emAnalise || m.estado === 'emAnalise' || abertas.includes(m.id) || !comecar(m.id)) return
    try {
      const resposta = await iniciarAnaliseDaMediacao(m.id)
      if (resposta.erro || !resposta.dados) { avisar.erro('Não foi possível atualizar', resposta.erro?.mensagem); return }
      definirLista((atual) => atual.map((item) => item.id === m.id ? resposta.dados! : item))
      definirAbertas((atuais) => [...new Set([...atuais, m.id])])
      avisar.info('Mediação em análise', 'Registre a decisão quando houver elementos suficientes.')
    } catch {
      avisar.erro('Não foi possível atualizar', 'Tente novamente.')
    } finally {
      terminar(m.id)
    }
  }

  async function decidirMediacao(m: Mediacao, decisao: DecisaoMediacao) {
    if (!comecar(m.id)) return
    try {
      const resposta = await registrarDecisao(m.id, decisao)
      if (resposta.erro || !resposta.dados) {
        avisar.erro('Não foi possível registrar a decisão', resposta.erro?.mensagem)
        return
      }
      const atualizada = resposta.dados
      definirLista((atual) => atual.map((item) => item.id === m.id ? atualizada : item))
      avisar.info('Decisão registrada', atualizada.estado === 'decisao_pendente'
        ? 'O comando ao serviço de pedidos está pendente de confirmação.' : 'O serviço de pedidos recebeu a decisão.')
    } catch {
      avisar.erro('Não foi possível registrar a decisão', 'Tente novamente.')
    } finally {
      terminar(m.id)
    }
  }

  async function reenviarDecisao(m: Mediacao) {
    if (!comecar(m.id)) return
    try {
      const resposta = await reprocessarEntregaDaMediacao(m.id)
      if (resposta.erro || !resposta.dados) {
        avisar.erro('Não foi possível reenviar a decisão', resposta.erro?.mensagem)
        return
      }
      const atualizada = resposta.dados
      definirLista((atual) => atual.map((item) => item.id === m.id ? atualizada : item))
      if (atualizada.estado === 'falha_entrega') {
        avisar.erro('O serviço de pedidos recusou a decisão de novo', atualizada.ultimoErro ?? undefined)
      } else {
        avisar.info('Decisão reenviada', atualizada.estado === 'decisao_pendente'
          ? 'O comando ao serviço de pedidos está pendente de confirmação.' : 'O serviço de pedidos recebeu a decisão.')
      }
    } catch {
      avisar.erro('Não foi possível reenviar a decisão', 'Tente novamente.')
    } finally {
      terminar(m.id)
    }
  }

  async function encerrarSemDecisao(m: Mediacao) {
    if (!comecar(m.id)) return
    try {
      const resposta = await cancelarMediacao(m.id)
      if (resposta.erro || !resposta.dados) {
        avisar.erro('Não foi possível encerrar a mediação', resposta.erro?.mensagem)
        return
      }
      definirLista((atual) => atual.filter((item) => item.id !== m.id))
      definirConfirmandoEncerramento(null)
      avisar.info('Mediação encerrada sem decisão', 'O comprador pode abrir uma nova mediação para este pedido.')
    } catch {
      avisar.erro('Não foi possível encerrar a mediação', 'Tente novamente.')
    } finally {
      terminar(m.id)
    }
  }

  function encerramento(m: Mediacao) {
    if (!mediacaoAceitaCancelamento(m)) return null
    if (confirmandoEncerramento !== m.id) {
      return (
        <button type="button" className="botao botao-fantasma botao-compacto" disabled={processando.includes(m.id)}
          onClick={() => definirConfirmandoEncerramento(m.id)}>
          Encerrar sem decisão
        </button>
      )
    }
    return (
      <div className="cancelamento-confirmacao" role="region" aria-labelledby={`encerrar-${m.id}`}>
        <span className="cancelamento-confirmacao-icone" aria-hidden="true">
          <IconeAviso tamanho={20} />
        </span>
        <div>
          <h3 id={`encerrar-${m.id}`}>Encerrar sem decisão?</h3>
          <p>A mediação sai da lista e o pedido não é alterado. O comprador poderá abrir uma nova mediação depois.</p>
          <div className="cancelamento-acoes">
            <button type="button" className="botao botao-fantasma botao-compacto" disabled={processando.includes(m.id)}
              onClick={() => definirConfirmandoEncerramento(null)}>
              Voltar
            </button>
            <button type="button" className="botao botao-perigo botao-compacto" disabled={processando.includes(m.id)}
              onClick={() => void encerrarSemDecisao(m)}>
              {processando.includes(m.id) ? 'Encerrando…' : 'Confirmar encerramento'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (lista.length === 0) {
    return (
      <EstadoVazio
        icone={<IconeAviso tamanho={34} />}
        titulo="Nenhuma mediação aberta"
      />
    )
  }

  return (
    <ul className="lista-curadoria">
      {lista.map((m) => {
        const emAnalise = m.emAnalise || m.estado === 'emAnalise' || abertas.includes(m.id)
        const decidida = m.estado === 'decidida'
        const pendente = m.estado === 'decisao_pendente'
        const falhou = m.estado === 'falha_entrega'
        return (
          <li className="cartao-curadoria" key={m.id}>
            <header className="cartao-curadoria-topo">
              <span className={`selo ${CLASSE_DO_SELO_DA_MEDIACAO[decidida ? 'decidida' : falhou ? 'falha' : pendente ? 'aplicando' : emAnalise ? 'analise' : 'aguardando']} cartao-disputa-selo`}>
                <span className="selo-ponto" />
                {decidida ? 'Decidida' : pendente ? 'Decisão pendente' : falhou ? 'Falha na entrega' : emAnalise ? 'Em análise' : 'Aguardando abertura'}
              </span>
              <span className="dado-rotulo cartao-disputa-pedido">
                {m.id} · aberta {m.aberta}
              </span>
            </header>

            <div className="cartao-curadoria-corpo">
              <p className="cartao-curadoria-peca">{m.assunto}</p>
              <p className="autoria cartao-disputa-pedido">
                {m.partes} · pedido {codigoDoPedido(m.pedido)}
              </p>
              {m.relato && <p className="texto-suave acima-2" style={{ whiteSpace: 'pre-line' }}>{m.relato}</p>}
            </div>

            <footer className="acoes-linha acoes-empilhaveis cartao-curadoria-acoes">
              {falhou ? (
                <>
                  <p className="campo-ajuda">
                    {`O serviço de pedidos não aplicou a decisão (${m.decisao ? DECISOES_DE_MEDIACAO[m.decisao] : 'registrada'}).`}
                    {m.ultimoErro ? ` Motivo: ${m.ultimoErro}.` : ''}
                  </p>
                  <button type="button" className="botao botao-primario" disabled={processando.includes(m.id)} onClick={() => void reenviarDecisao(m)}>
                    Reenviar ao serviço de pedidos
                  </button>
                </>
              ) : decidida || pendente ? (
                <p className="campo-ajuda">{pendente
                  ? `Entrega ao serviço de pedidos em processamento${m.tentativas ? ` (${m.tentativas} ${m.tentativas === 1 ? 'tentativa' : 'tentativas'})` : ''}.`
                  : `Decisão: ${m.decisao ? DECISOES_DE_MEDIACAO[m.decisao] : 'registrada'}`}</p>
              ) : emAnalise ? (
                <form onSubmit={(evento) => { evento.preventDefault(); const dados = new FormData(evento.currentTarget); const decisao = dados.get('decisao'); if (ehDecisaoDeMediacao(decisao)) void decidirMediacao(m, decisao) }}>
                  <label htmlFor={`decisao-${m.id}`}>Decisão</label>
                  <select id={`decisao-${m.id}`} name="decisao" required defaultValue="">
                    <option value="" disabled>Selecione</option>
                    {Object.entries(DECISOES_DE_MEDIACAO).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>{rotulo}</option>
                    ))}
                  </select>
                  <button type="submit" className="botao botao-primario" disabled={processando.includes(m.id)}>Registrar decisão</button>
                </form>
              ) : (
                <button type="button" className="botao botao-primario" disabled={processando.includes(m.id)} onClick={() => abrirMediacao(m)}>
                  Abrir mediação
                </button>
              )}
              {encerramento(m)}
            </footer>
          </li>
        )
      })}
    </ul>
  )
}
