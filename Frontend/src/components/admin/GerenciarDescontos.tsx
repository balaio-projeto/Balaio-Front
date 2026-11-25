'use client'

import { useRef, useState, type FormEvent } from 'react'
import { CODIGO_TROCA_SENHA_OBRIGATORIA } from '@/components/admin/AvisoTrocaSenhaAdmin'
import { avisar } from '@/components/feedback/Avisos'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { Campo } from '@/components/ui/Basicos'
import { IconeOferta, IconeSetaBaixo } from '@/components/ui/Icones'
import { criarCupom, definirCupomAtivo, editarCupom } from '@/services/api/cupons.servico'
import type { ErroApi } from '@/services/api/tipos'
import {
  cupomParaFormulario, FORMULARIO_CUPOM_VAZIO, formularioParaCupom, ROTULO_SITUACAO_CUPOM, ROTULO_TIPO_CUPOM,
  usosDoCupom, validadeDoCupom, valorDoCupom, type CupomAdmin, type FormularioCupom, type SituacaoCupom, type TipoCupom,
} from '@/utils/cupom'

const SELO_SITUACAO: Record<SituacaoCupom, string> = {
  ativo: 'selo-disponivel',
  agendado: 'selo-encomenda',
  expirado: 'selo-neutro',
  esgotado: 'selo-unica',
  inativo: 'selo-neutro',
}

const ORDEM_CAMPOS: (keyof FormularioCupom)[] = [
  'tipo', 'codigo', 'descricao', 'valor', 'descontoMaximo', 'pedidoMinimo', 'inicio', 'fim', 'limiteUsos', 'limitePorComprador',
]

function mensagemDoErro(erro: ErroApi, padrao: string): string {
  if (erro.status === 401) return 'Sua sessão expirou. Entre de novo para continuar.'
  if (erro.status === 403) {
    return erro.codigo === CODIGO_TROCA_SENHA_OBRIGATORIA
      ? 'Troque a senha inicial de administrador em Minha conta > Meus dados para liberar esta tela.'
      : 'Sua conta não tem permissão para gerenciar descontos.'
  }
  if (erro.status === 404) return 'O cupom não existe mais. Recarregue a página.'
  return erro.mensagem || padrao
}

function idDoCampo(campo: keyof FormularioCupom): string {
  return `cupom-${campo}`
}

export default function GerenciarDescontos({ cuponsIniciais, erro }: { cuponsIniciais: CupomAdmin[]; erro: ErroApi | null }) {
  const [cupons, definirCupons] = useState(cuponsIniciais)
  const [editando, definirEditando] = useState<string | null>(null)
  const [formulario, definirFormulario] = useState<FormularioCupom>(FORMULARIO_CUPOM_VAZIO)
  const [erros, definirErros] = useState<Record<string, string>>({})
  const [erroEnvio, definirErroEnvio] = useState<string | null>(null)
  const [salvando, definirSalvando] = useState(false)
  const [alternando, definirAlternando] = useState<string | null>(null)
  const formularioRef = useRef<HTMLFormElement>(null)

  function abrir(cupom?: CupomAdmin) {
    definirEditando(cupom?.id ?? 'novo')
    definirFormulario(cupom ? cupomParaFormulario(cupom) : FORMULARIO_CUPOM_VAZIO)
    definirErros({})
    definirErroEnvio(null)
    requestAnimationFrame(() => formularioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function fechar() {
    definirEditando(null)
    definirErros({})
    definirErroEnvio(null)
  }

  function alterar<C extends keyof FormularioCupom>(campo: C, valor: FormularioCupom[C]) {
    definirFormulario((atual) => ({ ...atual, [campo]: valor }))
    definirErros((atuais) => {
      if (!atuais[campo]) return atuais
      const proximos = { ...atuais }
      delete proximos[campo]
      return proximos
    })
  }

  function focarPrimeiroErro(problemas: Record<string, string>) {
    const primeiro = ORDEM_CAMPOS.find((campo) => problemas[campo])
    if (primeiro) document.getElementById(idDoCampo(primeiro))?.focus()
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (salvando || !editando) return
    const { dados, erros: problemas } = formularioParaCupom(formulario)
    definirErros(problemas)
    definirErroEnvio(null)
    if (!dados) {
      focarPrimeiroErro(problemas)
      return
    }
    definirSalvando(true)
    const resposta = editando === 'novo' ? await criarCupom(dados) : await editarCupom(editando, dados)
    definirSalvando(false)
    if (resposta.erro || !resposta.dados) {
      const camposDoServidor = resposta.erro?.campos ?? {}
      definirErros(camposDoServidor)
      focarPrimeiroErro(camposDoServidor)
      const mensagem = resposta.erro ? mensagemDoErro(resposta.erro, 'Não foi possível salvar o desconto.') : 'Tente novamente.'
      definirErroEnvio(mensagem)
      avisar.erro('Desconto não salvo', mensagem)
      return
    }
    const salvo = resposta.dados
    definirCupons((atuais) => editando === 'novo' ? [salvo, ...atuais] : atuais.map((cupom) => cupom.id === salvo.id ? salvo : cupom))
    avisar.sucesso(editando === 'novo' ? 'Desconto criado' : 'Desconto atualizado', salvo.codigo ?? 'Promoção automática')
    fechar()
  }

  async function alternar(cupom: CupomAdmin) {
    if (alternando) return
    definirAlternando(cupom.id)
    const resposta = await definirCupomAtivo(cupom.id, !cupom.ativo)
    definirAlternando(null)
    if (resposta.erro || !resposta.dados) {
      avisar.erro('Não foi possível mudar a situação', resposta.erro ? mensagemDoErro(resposta.erro, 'Tente novamente.') : 'Tente novamente.')
      return
    }
    const atualizado = resposta.dados
    definirCupons((atuais) => atuais.map((item) => item.id === atualizado.id ? atualizado : item))
    avisar.sucesso(atualizado.ativo ? 'Desconto ativado' : 'Desconto desativado')
  }

  if (erro) return <p className="aviso" role="status">{mensagemDoErro(erro, 'Não foi possível carregar os descontos.')}</p>

  const freteGratis = formulario.tipo === 'frete_gratis'

  return (
    <>
      <div className="aviso-custeio-desconto abaixo-4" role="note">
        <IconeOferta tamanho={18} />
        <p>
          Os descontos desta tela são <strong>custeados pela plataforma</strong>. O repasse do artesão continua calculado
          sobre o valor cheio das peças e do frete; o comprador paga ao Mercado Pago o total já com desconto.
        </p>
      </div>

      {editando ? (
        <form ref={formularioRef} className="cartao form-cupom abaixo-5" onSubmit={salvar} noValidate aria-labelledby="titulo-form-cupom">
          <h2 className="secao-titulo" id="titulo-form-cupom">{editando === 'novo' ? 'Novo desconto' : 'Editar desconto'}</h2>
          {erroEnvio && <p className="aviso abaixo-3" role="alert">{erroEnvio}</p>}

          <div className="form-cupom-grade">
            <div className="cupom-largo">
              <Campo rotulo="Tipo de desconto" erro={erros.tipo} id={idDoCampo('tipo')}>
                <select id={idDoCampo('tipo')} className="campo-select" value={formulario.tipo}
                  onChange={(e) => alterar('tipo', e.target.value as TipoCupom)}>
                  {(Object.keys(ROTULO_TIPO_CUPOM) as TipoCupom[]).map((tipo) => (
                    <option key={tipo} value={tipo}>{ROTULO_TIPO_CUPOM[tipo]}</option>
                  ))}
                </select>
              </Campo>
            </div>
            <div className="cupom-metade">
              <Campo rotulo="Código (opcional)" ajuda="Em branco, vira promoção automática aplicada a quem atender às regras."
                erro={erros.codigo} id={idDoCampo('codigo')}>
                <input id={idDoCampo('codigo')} value={formulario.codigo} maxLength={40} autoComplete="off" spellCheck={false}
                  placeholder="NATAL10" onChange={(e) => alterar('codigo', e.target.value.toUpperCase())} />
              </Campo>
            </div>
            <div className="cupom-inteiro">
              <Campo rotulo="Descrição" ajuda="Aparece para o comprador no checkout." erro={erros.descricao} id={idDoCampo('descricao')}>
                <input id={idDoCampo('descricao')} value={formulario.descricao} maxLength={200}
                  placeholder="10% em peças para celebrar o Natal" onChange={(e) => alterar('descricao', e.target.value)} />
              </Campo>
            </div>
            {!freteGratis && (
              <div className="cupom-terco">
                <Campo rotulo={formulario.tipo === 'percentual' ? 'Porcentagem (%)' : 'Valor do desconto (R$)'}
                  erro={erros.valor} id={idDoCampo('valor')}>
                  <input id={idDoCampo('valor')} value={formulario.valor} inputMode="decimal"
                    placeholder={formulario.tipo === 'percentual' ? '10' : '20,00'} onChange={(e) => alterar('valor', e.target.value)} />
                </Campo>
              </div>
            )}
            {formulario.tipo !== 'valor_fixo' && (
              <div className="cupom-terco">
                <Campo rotulo={freteGratis ? 'Teto do frete grátis (R$)' : 'Desconto máximo (R$)'} ajuda="Opcional."
                  erro={erros.descontoMaximo} id={idDoCampo('descontoMaximo')}>
                  <input id={idDoCampo('descontoMaximo')} value={formulario.descontoMaximo} inputMode="decimal" placeholder="30,00"
                    onChange={(e) => alterar('descontoMaximo', e.target.value)} />
                </Campo>
              </div>
            )}
            <div className="cupom-terco">
              <Campo rotulo="Pedido mínimo em peças (R$)" ajuda="Opcional." erro={erros.pedidoMinimo} id={idDoCampo('pedidoMinimo')}>
                <input id={idDoCampo('pedidoMinimo')} value={formulario.pedidoMinimo} inputMode="decimal" placeholder="100,00"
                  onChange={(e) => alterar('pedidoMinimo', e.target.value)} />
              </Campo>
            </div>
            <div className="cupom-metade">
              <Campo rotulo="Começa em" ajuda="Opcional." erro={erros.inicio} id={idDoCampo('inicio')}>
                <input id={idDoCampo('inicio')} type="datetime-local" value={formulario.inicio}
                  onChange={(e) => alterar('inicio', e.target.value)} />
              </Campo>
            </div>
            <div className="cupom-metade">
              <Campo rotulo="Termina em" ajuda="Opcional." erro={erros.fim} id={idDoCampo('fim')}>
                <input id={idDoCampo('fim')} type="datetime-local" value={formulario.fim}
                  onChange={(e) => alterar('fim', e.target.value)} />
              </Campo>
            </div>
            <div className="cupom-metade">
              <Campo rotulo="Limite total de usos" ajuda="Em branco, sem limite." erro={erros.limiteUsos} id={idDoCampo('limiteUsos')}>
                <input id={idDoCampo('limiteUsos')} value={formulario.limiteUsos} inputMode="numeric" placeholder="100"
                  onChange={(e) => alterar('limiteUsos', e.target.value)} />
              </Campo>
            </div>
            <div className="cupom-metade">
              <Campo rotulo="Usos por comprador" ajuda="Em branco, sem limite." erro={erros.limitePorComprador}
                id={idDoCampo('limitePorComprador')}>
                <input id={idDoCampo('limitePorComprador')} value={formulario.limitePorComprador} inputMode="numeric" placeholder="1"
                  onChange={(e) => alterar('limitePorComprador', e.target.value)} />
              </Campo>
            </div>
            <label className="opcao cupom-inteiro">
              <input type="checkbox" checked={formulario.ativo} onChange={(e) => alterar('ativo', e.target.checked)} />
              Desconto ativo
            </label>
          </div>

          <div className="acoes-linha acima-4">
            <button type="submit" className="botao botao-primario" disabled={salvando}>
              {salvando ? 'Salvando…' : editando === 'novo' ? 'Criar desconto' : 'Salvar alterações'}
            </button>
            <button type="button" className="botao botao-fantasma" onClick={fechar} disabled={salvando}>Cancelar</button>
          </div>
        </form>
      ) : (
        <div className="acoes-linha abaixo-4">
          <button type="button" className="botao botao-primario" onClick={() => abrir()}>Novo desconto</button>
        </div>
      )}

      <section aria-labelledby="lista-cupons-titulo">
        <h2 className="so-leitor" id="lista-cupons-titulo">Descontos cadastrados</h2>
        <p className="texto-suave abaixo-2" aria-live="polite">
          {cupons.length === 0 ? 'Nenhum desconto' : cupons.length === 1 ? '1 desconto' : `${cupons.length} descontos`}
        </p>
        {cupons.length === 0 ? (
          <EstadoVazio icone={<IconeOferta tamanho={34} />} titulo="Nenhum desconto cadastrado"
            descricao="Crie um cupom com código ou uma promoção automática." />
        ) : (
          <ul className="lista-acordeao-admin">
            {cupons.map((cupom) => (
              <li key={cupom.id}>
                <details className="acordeao-admin">
                  <summary className="acordeao-admin-resumo">
                    <span className="acordeao-admin-identidade">
                      <span className="acordeao-admin-titulo">{cupom.codigo ?? 'Promoção automática'}</span>
                      <span className="acordeao-admin-subtitulo">{cupom.descricao}</span>
                    </span>
                    <span className="cupom-usos-resumo">{cupom.limiteUsos ? `${cupom.usos}/${cupom.limiteUsos}` : cupom.usos} usos</span>
                    <span className={`selo ${SELO_SITUACAO[cupom.situacao]}`}>{ROTULO_SITUACAO_CUPOM[cupom.situacao]}</span>
                    <span className="seta-grupo" aria-hidden><IconeSetaBaixo /></span>
                  </summary>
                  <div className="acordeao-admin-corpo">
                    <dl className="acordeao-admin-dados">
                      <div className="dado">
                        <dt className="dado-rotulo">Desconto</dt>
                        <dd className="dado-valor">{valorDoCupom(cupom)}</dd>
                      </div>
                      <div className="dado">
                        <dt className="dado-rotulo">Validade</dt>
                        <dd className="dado-valor">{validadeDoCupom(cupom)}</dd>
                      </div>
                      <div className="dado">
                        <dt className="dado-rotulo">Usos</dt>
                        <dd className="dado-valor">{usosDoCupom(cupom)}</dd>
                      </div>
                      <div className="dado">
                        <dt className="dado-rotulo">Quem paga</dt>
                        <dd className="dado-valor">Plataforma (repasse do artesão sem desconto)</dd>
                      </div>
                    </dl>
                    <div className="acoes-linha">
                      <button type="button" className="botao botao-secundario" onClick={() => abrir(cupom)} disabled={salvando}>
                        Editar
                      </button>
                      <button type="button" className={cupom.ativo ? 'botao botao-fantasma' : 'botao botao-primario'}
                        onClick={() => void alternar(cupom)} disabled={alternando !== null}>
                        {alternando === cupom.id ? 'Alterando…' : cupom.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
