'use client'

import Link from 'next/link'
import type { EnderecoUsuario } from '@/types/dominio'
import { formatarLogradouro } from '@/utils/cep'

export const OUTRO_ENDERECO = '__outro__'

export default function SeletorEnderecoSalvo({
  enderecos,
  selecionado,
  aoSelecionar,
}: {
  enderecos: EnderecoUsuario[]
  selecionado: string
  aoSelecionar: (id: string) => void
}) {
  if (!enderecos.length) return null
  return (
    <fieldset className="opcoes abaixo-4">
      <legend className="campo-rotulo">Endereços salvos</legend>
      {enderecos.map((endereco) => (
        <label className="opcao opcao-topo" key={endereco.id}>
          <input
            type="radio"
            name="endereco-salvo"
            value={endereco.id}
            checked={selecionado === endereco.id}
            onChange={() => aoSelecionar(endereco.id)}
          />
          <span className="encolhivel">
            <span className="linha-flex" style={{ gap: 8, fontWeight: 600 }}>
              {endereco.apelido}
              {endereco.principal && <span className="selo selo-neutro">Principal</span>}
            </span>
            <span className="campo-ajuda">{[formatarLogradouro(endereco), endereco.bairro, `CEP ${endereco.cep}`].join(' · ')}</span>
          </span>
        </label>
      ))}
      <label className="opcao opcao-topo">
        <input
          type="radio"
          name="endereco-salvo"
          value={OUTRO_ENDERECO}
          checked={selecionado === OUTRO_ENDERECO}
          onChange={() => aoSelecionar(OUTRO_ENDERECO)}
        />
        <span className="encolhivel">
          <span className="linha-flex" style={{ fontWeight: 600 }}>Usar outro endereço</span>
          <span className="campo-ajuda">Vale só para esta compra.</span>
        </span>
      </label>
      <Link href="/account/addresses" className="botao-texto">Gerenciar endereços</Link>
    </fieldset>
  )
}
