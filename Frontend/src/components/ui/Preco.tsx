import { emReais, partirReais } from '@/utils/formato'

export default function Preco({ valor, className }: { valor: number; className?: string }) {
  const { sinal, inteiro, centavos } = partirReais(valor)
  return (
    <span className={className ? `preco-com-centavos ${className}` : 'preco-com-centavos'}>
      <span className="so-leitor">{emReais(valor)}</span>
      <span aria-hidden>
        {sinal}R$ {inteiro}
        <sup className="preco-centavos">{centavos}</sup>
      </span>
    </span>
  )
}
