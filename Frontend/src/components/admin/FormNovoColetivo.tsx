'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import { avisar } from '@/components/feedback/Avisos'
import { Campo } from '@/components/ui/Basicos'
import { cadastrarColetivo, type NovoColetivo } from '@/services/api/coletivos.servico'
import type { ErroApi } from '@/services/api/tipos'

export type ArtesaoParaColetivo = { slug: string; nome: string; atelie: string; territorio: string }

type CampoColetivo = 'nome' | 'slug' | 'territorio' | 'fundado' | 'historia' | 'apoio' | 'membros'
type ErrosColetivo = Partial<Record<CampoColetivo, string>>

const FORMATO_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const ACENTOS = /[\u0300-\u036f]/g
const LIMITES = { nome: 240, slug: 90, territorio: 120, fundado: 40, historia: 2000 } as const
const ORDEM_DOS_CAMPOS: CampoColetivo[] = ['nome', 'slug', 'territorio', 'fundado', 'historia', 'apoio', 'membros']
const CAMPOS_DO_SERVIDOR = new Set<string>(ORDEM_DOS_CAMPOS)

function slugDoNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(ACENTOS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITES.slug)
    .replace(/-+$/, '')
}

function linhasPreenchidas(texto: string): string[] {
  return [...new Set(texto.split('\n').map((linha) => linha.trim()).filter(Boolean))]
}

function validar(dados: NovoColetivo): ErrosColetivo {
  const erros: ErrosColetivo = {}
  if (!dados.nome) erros.nome = 'Informe o nome do coletivo'
  else if (dados.nome.length > LIMITES.nome) erros.nome = `Use até ${LIMITES.nome} caracteres`
  if (!dados.slug) erros.slug = 'Informe o endereço do coletivo'
  else if (dados.slug.length > LIMITES.slug) erros.slug = `Use até ${LIMITES.slug} caracteres`
  else if (!FORMATO_SLUG.test(dados.slug)) erros.slug = 'Use só letras minúsculas sem acento, números e hífens entre as palavras'
  if (dados.territorio.length > LIMITES.territorio) erros.territorio = `Use até ${LIMITES.territorio} caracteres`
  if (dados.fundado.length > LIMITES.fundado) erros.fundado = `Use até ${LIMITES.fundado} caracteres`
  if (dados.historia.length > LIMITES.historia) erros.historia = `Use até ${LIMITES.historia} caracteres`
  return erros
}

function errosDaResposta(erro: ErroApi): ErrosColetivo {
  const doServidor = Object.fromEntries(
    Object.entries(erro.campos ?? {}).filter(([campo]) => CAMPOS_DO_SERVIDOR.has(campo)),
  ) as ErrosColetivo
  if (erro.campo && CAMPOS_DO_SERVIDOR.has(erro.campo)) doServidor[erro.campo as CampoColetivo] = erro.mensagem
  if (erro.status === 409) doServidor.slug = 'Já existe um coletivo com este endereço. Escolha outro.'
  if (erro.status === 400 && /artes[aã]o inexistente/i.test(erro.mensagem)) doServidor.membros = erro.mensagem
  return doServidor
}

export default function FormNovoColetivo({ artesaos }: { artesaos: ArtesaoParaColetivo[] }) {
  const roteador = useRouter()
  const [nome, definirNome] = useState('')
  const [slug, definirSlug] = useState('')
  const [slugEditado, definirSlugEditado] = useState(false)
  const [territorio, definirTerritorio] = useState('')
  const [fundado, definirFundado] = useState('')
  const [historia, definirHistoria] = useState('')
  const [apoio, definirApoio] = useState('')
  const [membros, definirMembros] = useState<string[]>([])
  const [filtro, definirFiltro] = useState('')
  const [erros, definirErros] = useState<ErrosColetivo>({})
  const [enviando, definirEnviando] = useState(false)
  const envioEmAndamento = useRef(false)

  const termo = filtro.trim().toLowerCase()
  const artesaosFiltrados = termo
    ? artesaos.filter((artesao) => [artesao.nome, artesao.atelie, artesao.territorio, artesao.slug]
      .some((texto) => texto.toLowerCase().includes(termo)))
    : artesaos

  function limparErro(campo: CampoColetivo) {
    definirErros((atuais) => {
      if (!atuais[campo]) return atuais
      const restantes = { ...atuais }
      delete restantes[campo]
      return restantes
    })
  }

  function mostrarErros(novos: ErrosColetivo) {
    definirErros(novos)
    const primeiro = ORDEM_DOS_CAMPOS.find((campo) => novos[campo])
    if (primeiro) document.getElementById(`coletivo-${primeiro}`)?.focus()
  }

  function alternarMembro(slugDoArtesao: string) {
    definirMembros((atuais) => atuais.includes(slugDoArtesao)
      ? atuais.filter((atual) => atual !== slugDoArtesao)
      : [...atuais, slugDoArtesao])
    limparErro('membros')
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (envioEmAndamento.current) return

    const dados: NovoColetivo = {
      nome: nome.trim(),
      slug: slug.trim(),
      territorio: territorio.trim(),
      fundado: fundado.trim(),
      historia: historia.trim(),
      apoio: linhasPreenchidas(apoio),
      membros,
    }
    const problemas = validar(dados)
    if (Object.keys(problemas).length > 0) {
      mostrarErros(problemas)
      avisar.erro('Confira os campos destacados')
      return
    }

    envioEmAndamento.current = true
    definirEnviando(true)
    let concluido = false
    try {
      const resposta = await cadastrarColetivo(dados)
      if (resposta.erro || !resposta.dados) {
        const porCampo = resposta.erro ? errosDaResposta(resposta.erro) : {}
        if (Object.keys(porCampo).length > 0) mostrarErros(porCampo)
        avisar.erro('Não foi possível cadastrar o coletivo', resposta.erro?.status === 403
          ? 'Só a administração pode cadastrar coletivos.'
          : resposta.erro?.mensagem)
        return
      }
      concluido = true
      avisar.sucesso('Coletivo cadastrado', resposta.dados.nome)
      roteador.push(`/collectives/${encodeURIComponent(resposta.dados.slug)}`)
    } catch {
      avisar.erro('Não foi possível cadastrar o coletivo', 'Tente novamente.')
    } finally {
      if (!concluido) {
        envioEmAndamento.current = false
        definirEnviando(false)
      }
    }
  }

  return (
    <form className="cartao" onSubmit={enviar} noValidate aria-busy={enviando}>
      <fieldset disabled={enviando} className="sem-margem" style={{ border: 0, padding: 0 }}>
        <Campo rotulo="Nome do coletivo" erro={erros.nome} id="coletivo-nome">
          <input
            id="coletivo-nome"
            name="nome"
            maxLength={LIMITES.nome}
            value={nome}
            onChange={(evento) => {
              definirNome(evento.target.value)
              limparErro('nome')
              if (!slugEditado) {
                definirSlug(slugDoNome(evento.target.value))
                limparErro('slug')
              }
            }}
          />
        </Campo>

        <Campo
          rotulo="Endereço na plataforma"
          ajuda={`Aparece em /collectives/${slug || 'nome-do-coletivo'}. Letras minúsculas, números e hífens.`}
          erro={erros.slug}
          id="coletivo-slug"
        >
          <input
            id="coletivo-slug"
            name="slug"
            maxLength={LIMITES.slug}
            autoCapitalize="none"
            spellCheck={false}
            value={slug}
            onChange={(evento) => {
              definirSlug(evento.target.value)
              definirSlugEditado(true)
              limparErro('slug')
            }}
          />
        </Campo>

        <div className="grade-dois">
          <Campo rotulo="Território" erro={erros.territorio} id="coletivo-territorio">
            <input
              id="coletivo-territorio"
              name="territorio"
              maxLength={LIMITES.territorio}
              value={territorio}
              onChange={(evento) => { definirTerritorio(evento.target.value); limparErro('territorio') }}
            />
          </Campo>
          <Campo rotulo="Fundado em" ajuda="Ex.: 1998" erro={erros.fundado} id="coletivo-fundado">
            <input
              id="coletivo-fundado"
              name="fundado"
              maxLength={LIMITES.fundado}
              value={fundado}
              onChange={(evento) => { definirFundado(evento.target.value); limparErro('fundado') }}
            />
          </Campo>
        </div>

        <Campo
          rotulo="História"
          ajuda={`${historia.length} de ${LIMITES.historia} caracteres`}
          erro={erros.historia}
          id="coletivo-historia"
        >
          <textarea
            id="coletivo-historia"
            name="historia"
            maxLength={LIMITES.historia}
            value={historia}
            onChange={(evento) => { definirHistoria(evento.target.value); limparErro('historia') }}
          />
        </Campo>

        <Campo rotulo="Apoio e parcerias" ajuda="Uma instituição por linha." erro={erros.apoio} id="coletivo-apoio">
          <textarea
            id="coletivo-apoio"
            name="apoio"
            value={apoio}
            onChange={(evento) => { definirApoio(evento.target.value); limparErro('apoio') }}
          />
        </Campo>

        <fieldset className="campo" style={{ border: 0, padding: 0 }} aria-describedby={erros.membros ? 'coletivo-membros-erro' : undefined}>
          <legend className="campo-rotulo abaixo-2">
            Integrantes{membros.length > 0 ? ` (${membros.length} ${membros.length === 1 ? 'selecionado' : 'selecionados'})` : ''}
          </legend>
          {artesaos.length === 0 ? (
            <p className="campo-ajuda">Nenhum artesão disponível. O coletivo pode ser cadastrado sem integrantes.</p>
          ) : (
            <>
              <input
                id="coletivo-membros"
                type="search"
                className="campo-select abaixo-2"
                placeholder="Filtrar por nome, ateliê ou território"
                aria-label="Filtrar artesãos"
                value={filtro}
                onChange={(evento) => definirFiltro(evento.target.value)}
              />
              <div className="opcoes" style={{ maxHeight: 280, overflowY: 'auto' }}>
                {artesaosFiltrados.map((artesao) => (
                  <label className="opcao" key={artesao.slug}>
                    <input
                      type="checkbox"
                      checked={membros.includes(artesao.slug)}
                      onChange={() => alternarMembro(artesao.slug)}
                    />
                    <span>
                      {artesao.nome}
                      <span className="campo-ajuda"> · {[artesao.atelie, artesao.territorio].filter(Boolean).join(' · ')}</span>
                    </span>
                  </label>
                ))}
                {artesaosFiltrados.length === 0 && <p className="campo-ajuda">Nenhum artesão encontrado.</p>}
              </div>
            </>
          )}
          {erros.membros && <span className="campo-erro" id="coletivo-membros-erro" role="status">{erros.membros}</span>}
        </fieldset>

        <button type="submit" className="botao botao-primario">
          {enviando ? 'Cadastrando…' : 'Cadastrar coletivo'}
        </button>
      </fieldset>
    </form>
  )
}
