'use client'

import EstadoVazio from '@/components/feedback/EstadoVazio'
import { IconeAviso } from '@/components/ui/Icones'

export default function Erro({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="conteudo">
      <div className="container" style={{ paddingTop: 40 }}>
        <EstadoVazio
          icone={<IconeAviso tamanho={34} />}
          titulo="Algo deu errado por aqui"
          descricao="A página encontrou um problema inesperado. Tente de novo se continuar, volte para o início."
          acao={
            <button type="button" className="botao botao-primario" onClick={() => retry()}>
              Tentar novamente
            </button>
          }
        />
      </div>
    </main>
  )
}
