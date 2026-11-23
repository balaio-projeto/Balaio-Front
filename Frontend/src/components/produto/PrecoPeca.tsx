import Preco from '@/components/ui/Preco'
import type { Peca } from '@/types/dominio'
import { emReais, precoComDesconto } from '@/utils/formato'

export default function PrecoPeca({
  peca,
  tamanho = 'cartao',
}: {
  peca: Pick<Peca, 'preco' | 'desconto'>
  tamanho?: 'cartao' | 'pagina'
}) {
  const desconto = Math.min(100, Math.max(0, Math.round(peca.desconto ?? 0)))
  const temDesconto = desconto > 0
  const precoFinal = temDesconto ? precoComDesconto(peca) : peca.preco

  return (
    <div className={`preco-peca preco-peca-${tamanho}`}>
      <span className="preco-peca-linha">
        <Preco valor={precoFinal} className="preco-peca-atual" />
        {temDesconto && (
          <>
            <s className="preco-riscado preco-peca-cheio">
              <span className="so-leitor">Preço cheio: </span>
              {emReais(peca.preco)}
            </s>
            <span className="selo-desconto-preco">
              -{desconto}%<span className="so-leitor"> de desconto do artesão</span>
            </span>
          </>
        )}
      </span>
      {temDesconto && <span className="economia">Você economiza {emReais(peca.preco - precoFinal)}</span>}
    </div>
  )
}
