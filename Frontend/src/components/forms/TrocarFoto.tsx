'use client'

import { useId, useRef, useState } from 'react'
import { Retrato } from '@/components/ui/Basicos'
import { avisar } from '@/components/feedback/Avisos'
import { FORMATOS_FOTO, lerComoDataUrl, TAMANHO_MAXIMO_FOTO_MB, validarFoto } from '@/utils/foto'
import { imagemBase } from '@/utils/imagem'

type Props = {
  imagemInicial?: string
  rotulo: string
  desabilitado?: boolean
} & ({
  nome?: string
  aoEnviar?: never
  aoRemover?: never
} | {
  nome?: never
  aoEnviar: (arquivo: File) => Promise<string | null>
  aoRemover: () => Promise<string | null>
})

export default function TrocarFoto({ imagemInicial, rotulo, nome, desabilitado, aoEnviar, aoRemover }: Props) {
  const idErro = useId()
  const [previa, definirPrevia] = useState(imagemInicial)
  const [enviando, definirEnviando] = useState(false)
  const emVoo = useRef(false)
  const [erro, definirErro] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  async function escolher(arquivo: File | undefined) {
    if (!arquivo || emVoo.current || desabilitado) return
    const problema = validarFoto(arquivo)
    definirErro(problema)
    if (entrada.current) entrada.current.value = ''
    if (problema) {
      avisar.erro('Foto recusada', problema)
      return
    }
    await executar(async () => {
      if (aoEnviar) return aoEnviar(arquivo)
      definirPrevia(await lerComoDataUrl(arquivo))
      avisar.info('Foto escolhida', nome ? 'Ela é salva junto com o formulário.' : undefined)
      return null
    })
  }

  async function executar(operacao: () => Promise<string | null>) {
    if (emVoo.current || desabilitado) return
    emVoo.current = true
    definirEnviando(true)
    definirErro(null)
    try {
      const problema = await operacao()
      definirErro(problema)
      if (problema) avisar.erro('Foto não atualizada', problema)
    } catch {
      definirErro('Não foi possível atualizar a foto. Tente novamente.')
    } finally {
      emVoo.current = false
      definirEnviando(false)
    }
  }

  return (
    <div className="bloco-artesao abaixo-4">
      <Retrato imagem={aoEnviar ? imagemInicial : previa} />
      <div className="encolhivel">
        <p style={{ fontWeight: 600 }}>{rotulo}</p>
        <p className="campo-ajuda">
          JPG, PNG ou WebP de até {TAMANHO_MAXIMO_FOTO_MB} MB.
        </p>
        <button
          type="button"
          disabled={enviando || desabilitado}
          className="botao botao-fantasma acima-2"
          onClick={() => entrada.current?.click()}
          aria-describedby={erro ? idErro : undefined}
        >
          {enviando ? 'Atualizando foto…' : 'Trocar foto'}
        </button>
        {aoRemover && imagemInicial && imagemInicial !== imagemBase && (
          <button type="button" className="botao botao-fantasma acima-2" disabled={enviando || desabilitado}
            onClick={() => void executar(aoRemover)}>Remover foto</button>
        )}
        {erro && (
          <p className="campo-erro acima-2" id={idErro} role="alert">
            {erro}
          </p>
        )}
        <input
          ref={entrada}
          type="file"
          aria-label={rotulo}
          disabled={enviando || desabilitado}
          accept={FORMATOS_FOTO.join(',')}
          className="so-leitor"
          tabIndex={-1}
          onChange={(evento) => void escolher(evento.target.files?.[0])}
        />
        {nome && <input type="hidden" name={nome} value={previa ?? ''} />}
      </div>
    </div>
  )
}
