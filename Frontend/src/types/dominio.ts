import type { TipoPeca } from '@/constants/referencias'

export type Disponibilidade = 'disponivel' | 'encomenda' | 'unica'

export type Tecnica =
  | 'Cerâmica & Barro'
  | 'Bordado & Renda (Renascença)'
  | 'Escultura em Madeira'
  | 'Couro Autoral'
  | 'Xilogravura'

export type FotoPeca = {
  id: string
  nome: string
  url: string
  ordem: number
}

export type Peca = {
  situacao?: 'publicada' | 'rascunho'
  criadaEm?: string
  inativadoEm?: string | null
  vendidaEmPedido?: string | null
  slug: string
  nome: string
  artesao: string
  territorio: string
  tecnica: Tecnica
  categoria: string
  tipo: TipoPeca
  preco: number
  desconto?: number
  disponibilidade: Disponibilidade
  prazoProducaoDias?: number
  historia: string[]
  imagem: string
  fotos?: FotoPeca[]
  ordemFotos?: string[]
  avaliacao?: number
  totalAvaliacoes?: number
}

export type Artesao = {
  id?: string
  slug: string
  nome: string
  atelie: string
  territorio: string
  tecnica: Tecnica
  historia: string
  obrasComercializadas?: number | null
  avaliacaoMedia?: number | null
  selo: boolean
  imagem: string
  cepOrigem?: string
  prazoPadraoDias?: number
  aceitaEncomendas?: boolean
  chavePix?: string
}

export type EstadoPedido = 'aguardando_reserva' | 'aguardando_pagamento' | 'confirmacao_pendente' | 'confirmado' | 'producao' | 'enviado' | 'entregue' | 'cancelamento_pendente' | 'reembolso_pendente' | 'encerramento_pendente' | 'falha_reserva' | 'falha_pagamento' | 'recusado' | 'cancelado' | 'reembolsado'

export type EtapaPedido = {
  estado: EstadoPedido
  titulo: string
  detalhe: string
  concluida: boolean
  atual: boolean
  nota?: string
  criadaEm?: string
}

export type Pedido = {
  itens?: { slug: string; quantidade: number; preco?: number }[]
  simulado?: boolean
  estadoPagamento?: string
  checkoutUrl?: string | null
  id: string
  pecaSlug: string
  compradorId?: string
  usuarioId?: string
  compradorNome: string
  comprador?: CompradorDoPedido
  data: string
  total: number
  estado: EstadoPedido
  rastreio?: string
  transportadora?: string
  previsaoEntrega?: string
  linkRastreio?: string | null
  frete?: number
  freteOpcao?: string | null
  freteProvedor?: string | null
  etapas: EtapaPedido[]
  motivoEncerramento?: string
  endereco?: { cep: string; endereco: string; cidade: string; estado: string }
  historicoInferido?: boolean
  desconto?: DescontoDoPedido
  enderecoEntrega?: { cep?: string; endereco?: string; cidade?: string; estado?: string } | null
}

export type DescontoDoPedido = {
  cupom: string | null
  descricao: string | null
  automatico: boolean
  produtos: number
  frete: number
  total: number
  custeadoPor: string
  valorSemDesconto: number
}

export type CompradorDoPedido = {
  nome: string | null
  imagem: string | null
}

export type PedidoPendente = {
  id: string
  pecaSlug: string
  comprador: CompradorDoPedido
  quando: string
  valor: number
}

export type ConversaArtesao = {
  id: string
  codigo?: string
  pessoa: string
  assunto: string
  previa: string
  quando: string
  naoLida: boolean
  retrato: string | null
  comprador?: CompradorDoPedido
}

export type SituacaoSolicitacaoSelo = 'pendente' | 'aprovada' | 'ajuste'

export type SolicitacaoSelo = {
  id: string
  artesaoSlug: string
  artesao: string
  atelie: string
  mensagem: string
  situacao: SituacaoSolicitacaoSelo
  solicitadoEm: string
  motivo?: string
  decididoEm?: string
}

export type SolicitacaoSeloNaFila = SolicitacaoSelo & {
  territorio: string
  tecnica: string
  imagem: string
  pecasPublicadas: number
}

export type EstadoSelo = {
  selo: boolean
  solicitacao: SolicitacaoSelo | null
}

export type Mensagem = {
  id?: string
  autor: 'comprador' | 'artesao'
  texto: string
  hora: string
  enviadaEm?: string
}

export type Mediacao = {
  emAnalise?: boolean
  estado?: 'aberta' | 'emAnalise' | 'decisao_pendente' | 'decidida' | 'falha_entrega' | 'cancelada'
  decisao?: 'cancelar_reembolsar' | 'negar' | 'manter_conversa' | null
  canceladaEm?: string | null
  id: string
  pedido: string
  compradorId?: string
  assunto: string
  partes: string
  aberta: string
  relato?: string
  tentativas?: number
  ultimoErro?: string | null
}

export type Reputacao = {
  media: number
  total: number
  distribuicao: Record<string, number>
}

export type Coletivo = {
  slug: string
  nome: string
  territorio: string
  fundado: string
  historia: string
  membros: string[]
  tecnicas: string[]
  apoio: string[]
  imagem: string
}

export type Ponto = { lat: number; lng: number }

export type TipoEvento = 'feira' | 'festival' | 'exposicao' | 'oficina'

export type Evento = {
  slug: string
  nome: string
  tipo: TipoEvento
  organizador: string
  descricao: string
  periodo: string
  horario: string
  entrada: string
  cidade: string
  local: string
  endereco: string
  cep?: string | null
  rua?: string | null
  numero?: string | null
  bairro?: string | null
  complemento?: string | null
  referencia?: string | null
  site?: string | null
  lat: number
  lng: number
  artesaos: string[]
  coletivos: string[]
}

export type Video = {
  id: string
  artesao: string
  peca?: string
  legenda: string
  etiquetas: string[]
  duracao: string
  visualizacoes: number
  curtidas: number
  comentarios: number
  publicadoEm: string
  capa: string | null
  url?: string | null
  situacao?: 'publicada' | 'rascunho'
  suspensao?: SuspensaoVideo | null
}

export type SuspensaoVideo = { motivo: string; suspensoEm: string }

export type EstadoModeracaoVideo = 'publicada' | 'rascunho' | 'suspensa'

export type VideoEmModeracao = {
  id: string
  artesao: string
  peca?: string | null
  legenda: string
  etiquetas: string[]
  duracao?: string | null
  visualizacoes: number
  criadoEm: string
  publicadoEm: string | null
  capa: string | null
  url: string | null
  situacao: 'publicada' | 'rascunho'
  estado: EstadoModeracaoVideo
  suspensao: SuspensaoVideo | null
  suspensoPor: string | null
}

export type Comentario = {
  id?: string
  autor: string
  autorImagem?: string | null
  texto: string
  quando: string
  curtidas: number
  artesao?: boolean
  resposta?: { texto: string; quando: string }
}

export type EnderecoUsuario = {
  id: string
  apelido: string
  rua: string
  numero?: string | null
  complemento?: string | null
  bairro: string
  cep: string
  principal: boolean
}

export type Usuario = {
  id?: string
  nome: string
  email: string
  imagem: string
  perfil?: 'comprador' | 'artesao'
  papel?: 'comprador' | 'artesao' | 'admin' | 'organizador'
  telefone?: string
  tipoComprador?: string
  territorio?: string
  tecnica?: string
  artesaoId?: string
}

export type ModalidadeFrete = 'transportadora' | 'retirada' | 'entrega_local'

export type OpcaoFrete = {
  id: string; nome: string; prazo: string; valor: number; provedor?: string; transportadora?: string | null
  modalidade?: ModalidadeFrete; detalhe?: string | null
}
