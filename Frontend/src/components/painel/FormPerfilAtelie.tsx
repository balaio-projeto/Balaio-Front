'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import { Campo } from '@/components/ui/Basicos'
import { avisar } from '@/components/feedback/Avisos'
import SeletorComOutro from '@/components/forms/SeletorComOutro'
import TrocarFoto from '@/components/forms/TrocarFoto'
import { IconeAviso, IconeSetaDireita } from '@/components/ui/Icones'
import { avisarArtesaoAtualizado } from '@/hooks/useArtesaoLogado'
import { atualizarArtesao, enviarImagemPerfil, removerImagemPerfil, type PerfilArtesao } from '@/services/api/artesaos.servico'
import ConfirmacaoSalvo, { horarioAgora, type EstadoSalvo } from '@/components/painel/ConfirmacaoSalvo'
import { camposAlterados, listarRotulos } from '@/utils/alteracoes'
import type { Artesao } from '@/types/dominio'
import { validarObrigatorio } from '@/utils/validacao'
import { useSessao } from '@/store/sessao'

const rotulosPerfil: Record<keyof PerfilArtesao, string> = {
  imagem: 'Foto',
  atelie: 'Nome do ateliê',
  nome: 'Nome de artesão',
  historia: 'História',
  territorio: 'Território',
  tecnica: 'Técnica principal',
}

type CampoTextoPerfil = Exclude<keyof PerfilArtesao, 'imagem'>

const LIMITES_PERFIL: Record<CampoTextoPerfil, number> = {
  atelie: 240,
  nome: 240,
  historia: 2000,
  territorio: 120,
  tecnica: 120,
}

const ID_DO_CAMPO: Record<CampoTextoPerfil, string> = {
  atelie: 'cfg-atelie',
  nome: 'cfg-nome',
  historia: 'cfg-historia',
  territorio: 'cfg-territorio',
  tecnica: 'cfg-tecnica',
}

function ehCampoTextoPerfil(campo: string): campo is CampoTextoPerfil {
  return campo in ID_DO_CAMPO
}

function errosDoServidor(campos: Record<string, string> | undefined): { porCampo: Record<string, string>; gerais: string[] } {
  const porCampo: Record<string, string> = {}
  const gerais: string[] = []
  for (const [campo, mensagem] of Object.entries(campos ?? {})) {
    if (ehCampoTextoPerfil(campo)) {
      porCampo[ID_DO_CAMPO[campo]] = /size|tamanho/i.test(mensagem)
        ? `Use até ${LIMITES_PERFIL[campo]} caracteres.`
        : mensagem
    }
    else gerais.push(campo === 'imagem' ? `Foto: ${mensagem}` : mensagem)
  }
  return { porCampo, gerais }
}

function perfilDe(artesao: Artesao): PerfilArtesao {
  const { imagem, atelie, nome, historia, territorio, tecnica } = artesao
  return {
    imagem,
    atelie: atelie.trim(),
    nome: nome.trim(),
    historia: historia.trim(),
    territorio: territorio.trim(),
    tecnica: tecnica.trim() as PerfilArtesao['tecnica'],
  }
}

type Props = {
  artesao: Artesao
  tecnicas: string[]
  territorios: string[]
}

export default function FormPerfilAtelie({ artesao, tecnicas, territorios }: Props) {
  const roteador = useRouter()
  const { sessao } = useSessao()
  const [erros, definirErros] = useState<Record<string, string>>({})
  const [erroEnvio, definirErroEnvio] = useState<string | null>(null)
  const [salvando, definirSalvando] = useState(false)
  const [atualizandoFoto, definirAtualizandoFoto] = useState(false)
  const emVoo = useRef(false)
  const [salvo, definirSalvo] = useState<PerfilArtesao>(() => perfilDe(artesao))
  const [confirmacao, definirConfirmacao] = useState<EstadoSalvo>(null)
  const [tamanhoHistoria, definirTamanhoHistoria] = useState(artesao.historia.length)

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (emVoo.current) return
    const dados = new FormData(evento.currentTarget)
    const texto = (campo: string) => String(dados.get(campo) ?? '').trim()
    const proximosErros: Record<string, string> = {}

    const problemaAtelie = validarObrigatorio(texto('atelie'), 'Dê um nome ao seu ateliê')
    if (problemaAtelie) proximosErros['cfg-atelie'] = problemaAtelie
    const problemaNome = validarObrigatorio(texto('nome'), 'Digite como você assina as peças')
    if (problemaNome) proximosErros['cfg-nome'] = problemaNome
    for (const [campo, limite] of Object.entries(LIMITES_PERFIL) as [CampoTextoPerfil, number][]) {
      const idCampo = ID_DO_CAMPO[campo]
      if (!proximosErros[idCampo] && texto(campo).length > limite) {
        proximosErros[idCampo] = `Use até ${limite} caracteres. Agora são ${texto(campo).length}.`
      }
    }

    definirErros(proximosErros)
    definirErroEnvio(null)
    definirConfirmacao(null)
    const primeiro = Object.keys(proximosErros)[0]
    if (primeiro) {
      document.getElementById(primeiro)?.focus()
      avisar.erro('Confira os campos destacados')
      return
    }

    const atual: PerfilArtesao = {
      imagem: salvo.imagem,
      atelie: texto('atelie'),
      nome: texto('nome'),
      historia: texto('historia'),
      territorio: texto('territorio'),
      tecnica: texto('tecnica') as PerfilArtesao['tecnica'],
    }
    const alteracoes = camposAlterados(salvo, atual)
    if (Object.keys(alteracoes).length === 0) {
      definirConfirmacao({ tipo: 'sem-mudancas' })
      return
    }

    emVoo.current = true
    definirSalvando(true)
    const { dados: atualizado, erro } = await atualizarArtesao(artesao.slug, alteracoes)
    emVoo.current = false
    definirSalvando(false)

    if (!atualizado) {
      const { porCampo, gerais } = errosDoServidor(erro?.campos)
      const primeiroCampo = Object.keys(porCampo)[0]
      definirErros(porCampo)
      definirErroEnvio(gerais.length > 0
        ? gerais.join(' ')
        : primeiroCampo ? 'Confira os campos destacados.' : erro?.mensagem ?? 'Não foi possível salvar agora.')
      if (primeiroCampo) document.getElementById(primeiroCampo)?.focus()
      avisar.erro('Perfil não salvo', 'O que você digitou continua no formulário.')
      return
    }

    definirSalvo(perfilDe(atualizado))
    definirConfirmacao({ tipo: 'salvo', horario: horarioAgora(), campos: listarRotulos(alteracoes, rotulosPerfil) })
    if (sessao) avisarArtesaoAtualizado(atualizado, sessao.id)
    avisar.sucesso('Perfil do ateliê salvo', 'Quem visitar sua loja já vê a nova versão.')
    roteador.refresh()
  }

  async function atualizarFoto(arquivo?: File): Promise<string | null> {
    if (emVoo.current) return 'Aguarde a operação em andamento.'
    emVoo.current = true
    definirAtualizandoFoto(true)
    try {
      const { dados: atualizado, erro } = await (arquivo ? enviarImagemPerfil(arquivo) : removerImagemPerfil())
      if (!atualizado) return erro?.mensagem ?? 'Não foi possível atualizar a foto.'
      // Preserva os campos de texto ainda não salvos; atualiza somente a foto confirmada.
      definirSalvo((anterior) => ({ ...anterior, imagem: atualizado.imagem }))
      if (sessao) avisarArtesaoAtualizado(atualizado, sessao.id)
      avisar.sucesso(arquivo ? 'Foto atualizada' : 'Foto removida')
      roteador.refresh()
      return null
    } finally {
      emVoo.current = false
      definirAtualizandoFoto(false)
    }
  }

  return (
    <form className="cartao abaixo-5" onSubmit={salvar} noValidate>
      <h2 className="secao-titulo">Identidade do ateliê</h2>

      <ConfirmacaoSalvo estado={confirmacao} />

      {erroEnvio && (
        <p className="auth-erro" role="alert">
          <IconeAviso tamanho={18} />
          <span>{erroEnvio}</span>
        </p>
      )}

      <TrocarFoto imagemInicial={salvo.imagem} rotulo="Foto do ateliê" desabilitado={salvando}
        aoEnviar={(arquivo) => atualizarFoto(arquivo)} aoRemover={() => atualizarFoto()} />

      <Campo rotulo="Nome do ateliê" erro={erros['cfg-atelie']} id="cfg-atelie">
        <input id="cfg-atelie" name="atelie" maxLength={LIMITES_PERFIL.atelie} defaultValue={artesao.atelie} />
      </Campo>

      <Campo
        rotulo="Seu nome de artesão"
        ajuda="É como sua assinatura aparece nas peças."
        erro={erros['cfg-nome']}
        id="cfg-nome"
      >
        <input id="cfg-nome" name="nome" maxLength={LIMITES_PERFIL.nome} defaultValue={artesao.nome} />
      </Campo>

      <Campo
        rotulo="Sua história"
        ajuda={`É o texto que aparece no topo do seu perfil. Conte de onde vem o ofício. ${tamanhoHistoria} de ${LIMITES_PERFIL.historia} caracteres.`}
        erro={erros['cfg-historia']}
        id="cfg-historia"
      >
        <textarea
          id="cfg-historia"
          name="historia"
          maxLength={LIMITES_PERFIL.historia}
          defaultValue={artesao.historia}
          onChange={(evento) => definirTamanhoHistoria(evento.target.value.length)}
        />
      </Campo>

      <div className="grade-dois">
        <Campo rotulo="Território" erro={erros['cfg-territorio']} id="cfg-territorio">
          <SeletorComOutro
            id="cfg-territorio"
            name="territorio"
            opcoes={territorios}
            valorInicial={artesao.territorio}
            rotuloOutro="Outro território…"
            tituloModal="Qual é o seu território?"
            ajudaModal="Nome da cidade ou região onde fica o seu ateliê"
            exemploModal="Ex.: Bezerros, Agreste"
          />
        </Campo>
        <Campo rotulo="Técnica principal" erro={erros['cfg-tecnica']} id="cfg-tecnica">
          <SeletorComOutro
            id="cfg-tecnica"
            name="tecnica"
            opcoes={tecnicas}
            valorInicial={artesao.tecnica}
            rotuloOutro="Outra técnica…"
            tituloModal="Qual é a sua técnica?"
            ajudaModal="Como você chama o que faz"
            exemploModal="Ex.: Trançado de palha"
          />
        </Campo>
      </div>

      <div className="acoes-linha">
        <button type="submit" className="botao botao-primario" disabled={salvando || atualizandoFoto}>
          {salvando ? 'Salvando…' : 'Salvar identidade'}
        </button>
        <Link href={`/artisans/${artesao.slug}`} className="botao botao-fantasma">
          Ver minha loja
          <IconeSetaDireita />
        </Link>
      </div>
    </form>
  )
}
