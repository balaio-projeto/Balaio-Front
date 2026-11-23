'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import TrocarFoto from '@/components/forms/TrocarFoto'
import { avisar } from '@/components/feedback/Avisos'
import { avisarArtesaoAtualizado } from '@/hooks/useArtesaoLogado'
import { obterMeuAtelie } from '@/services/api/artesaos.servico'
import { enviarImagemUsuario, removerImagemUsuario } from '@/services/api/conta.servico'
import type { RespostaApi } from '@/services/api/tipos'
import { sessaoDoUsuario } from '@/services/sessao/cookie'
import { useSessao } from '@/store/sessao'
import { lerComoDataUrl } from '@/utils/foto'
import type { Usuario } from '@/types/dominio'

export default function FotoDaConta({ usuario }: { usuario: Usuario }) {
  const roteador = useRouter()
  const { sessao, iniciarSessao } = useSessao()
  const [imagem, definirImagem] = useState(usuario.imagem)
  const [previa, definirPrevia] = useState<string | undefined>()

  async function aplicar(operacao: Promise<RespostaApi<Usuario>>, sucesso: string): Promise<string | null> {
    const { dados: atualizado, erro } = await operacao
    if (!atualizado) return erro?.mensagem ?? 'Não foi possível atualizar a foto.'
    definirImagem(atualizado.imagem)
    const sessaoAtualizada = sessaoDoUsuario(atualizado) ?? (sessao && { ...sessao, imagem: atualizado.imagem })
    if (sessaoAtualizada) iniciarSessao(sessaoAtualizada)
    if ((atualizado.papel ?? atualizado.perfil) === 'artesao' && sessaoAtualizada) {
      const { dados: atelie } = await obterMeuAtelie()
      if (atelie) avisarArtesaoAtualizado(atelie, sessaoAtualizada.id)
    }
    avisar.sucesso(sucesso)
    roteador.refresh()
    return null
  }

  async function enviarFoto(arquivo: File): Promise<string | null> {
    definirPrevia(await lerComoDataUrl(arquivo).catch(() => undefined))
    try {
      return await aplicar(enviarImagemUsuario(arquivo), 'Foto atualizada')
    } finally {
      definirPrevia(undefined)
    }
  }

  return (
    <section className="cartao">
      <TrocarFoto
        imagemInicial={previa ?? imagem}
        rotulo={usuario.papel === 'artesao' ? 'Foto do perfil e do ateliê' : 'Foto do perfil'}
        aoEnviar={enviarFoto}
        aoRemover={() => aplicar(removerImagemUsuario(), 'Foto removida')}
      />
    </section>
  )
}
