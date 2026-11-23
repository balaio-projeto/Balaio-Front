'use client'

import { useState } from 'react'
import { avisar } from '@/components/feedback/Avisos'
import { validarCEP } from '@/utils/validacao'
import { emReais } from '@/utils/formato'
import { cotarFretes } from '@/services/api/pedidos.servico'
import { origemDaCotacao } from '@/utils/frete'
import type { OpcaoFrete } from '@/types/dominio'

export default function CalculoFrete({ territorio, slug }: { territorio: string; slug: string }) {
  const [cep, definirCep] = useState('')
  const [erro, definirErro] = useState<string | null>(null)
  const [carregando, definirCarregando] = useState(false)
  const [opcoesFrete, definirOpcoes] = useState<OpcaoFrete[] | null>(null)

  async function calcular() {
    const problema = validarCEP(cep)
    definirErro(problema)
    definirOpcoes(null)
    if (problema) {
      avisar.erro(problema)
      return
    }
    definirCarregando(true)
    const resposta = await cotarFretes(cep, [{ slug, quantidade: 1 }])
    definirCarregando(false)
    if (resposta.erro || !resposta.dados) {
      const mensagem = resposta.erro?.mensagem ?? 'Não foi possível cotar o frete agora.'
      definirErro(mensagem)
      avisar.erro(mensagem)
      return
    }
    if (!resposta.dados.length) definirErro('Nenhuma opção de entrega disponível para este CEP.')
    definirOpcoes(resposta.dados)
  }

  return (
    <div className="cartao abaixo-4">
      <p className="campo-rotulo abaixo-3">Calcular frete de origem</p>
      <div className="linha-flex">
        <label className="so-leitor" htmlFor="cep">
          CEP de entrega
        </label>
        <input
          id="cep"
          className="campo-select"
          placeholder="Digite seu CEP (ex: 50000-000)"
          style={{ flex: '1 1 180px', minHeight: 48 }}
          inputMode="numeric"
          maxLength={9}
          value={cep}
          onChange={(evento) => definirCep(evento.target.value)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? 'cep-erro' : undefined}
        />
        <button type="button" className="botao botao-secundario" disabled={carregando} onClick={() => void calcular()}>
          {carregando ? 'Calculando…' : 'Calcular'}
        </button>
      </div>
      {erro && (
        <p className="campo-erro acima-2" id="cep-erro" role="status">
          {erro}
        </p>
      )}
      {opcoesFrete && opcoesFrete.length > 0 && (
        <div className="acima-3" role="status">
          {opcoesFrete.map((opcao) => (
            <p className="resumo" key={opcao.id}>
              <span>
                {opcao.nome} · {opcao.prazo}
              </span>
              <strong>{emReais(opcao.valor)}</strong>
            </p>
          ))}
          <p className="campo-ajuda">{origemDaCotacao(opcoesFrete)}</p>
        </div>
      )}
      <p className="campo-ajuda acima-3">Sai diretamente da oficina do artesão em {territorio}.</p>
    </div>
  )
}
