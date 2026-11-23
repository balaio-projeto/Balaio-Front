import { Estrelas } from '@/components/ui/Basicos'
import type { Reputacao } from '@/types/dominio'

const NOTAS_DA_MAIOR_PARA_A_MENOR = [5, 4, 3, 2, 1]

function rotuloAvaliacoes(quantidade: number): string {
  return `${quantidade} ${quantidade === 1 ? 'avaliação' : 'avaliações'}`
}

export default function DistribuicaoNotas({ reputacao }: { reputacao: Reputacao }) {
  const quantidades = NOTAS_DA_MAIOR_PARA_A_MENOR.map((nota) => ({
    nota,
    quantidade: Math.max(0, Number(reputacao.distribuicao?.[String(nota)] ?? 0) || 0),
  }))
  const total = reputacao.total > 0 ? reputacao.total : quantidades.reduce((soma, item) => soma + item.quantidade, 0)
  if (total <= 0) return null

  return (
    <section className="secao" aria-labelledby="distribuicao-notas-titulo">
      <h2 className="secao-titulo" id="distribuicao-notas-titulo">Avaliações dos compradores</h2>
      <div className="cartao">
        {reputacao.media != null && reputacao.media > 0 && (
          <p className="linha-flex abaixo-4" style={{ gap: 8 }}>
            <Estrelas nota={reputacao.media} />
            <span className="autoria">média de {rotuloAvaliacoes(total)}</span>
          </p>
        )}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
          {quantidades.map(({ nota, quantidade }) => {
            const percentual = Math.round((quantidade / total) * 100)
            return (
              <li key={nota} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) 72px', alignItems: 'center', gap: 12 }}>
                <span className="so-leitor">
                  {nota} {nota === 1 ? 'estrela' : 'estrelas'}: {rotuloAvaliacoes(quantidade)}, {percentual}%
                </span>
                <span className="autoria" aria-hidden>{nota} {nota === 1 ? 'estrela' : 'estrelas'}</span>
                <span aria-hidden style={{ height: 8, borderRadius: 999, background: 'var(--linha)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${percentual}%`, borderRadius: 999, background: 'var(--amarelo)' }} />
                </span>
                <span className="autoria" aria-hidden style={{ textAlign: 'right' }}>{quantidade} · {percentual}%</span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
