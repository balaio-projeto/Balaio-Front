import type { ReactNode } from 'react'
import { IconeAviso, IconeCadeado, IconeCalendario, IconeSelo, IconeGrade, IconeUsuario } from '@/components/ui/Icones'

export type ChaveAdmin = 'curadoria' | 'eventos' | 'mediacoes' | 'coletivos' | 'organizadores' | 'criterios'

export type GrupoAdmin = 'moderacao' | 'cadastros' | 'referencia'

export type ItemAdmin = {
  chave: ChaveAdmin
  texto: string
  textoCurto: string
  href: string
  icone: ReactNode
  grupo: GrupoAdmin
  marcador?: { texto: string; alerta?: boolean }
}

export type ContagensAdmin = { curadoria: number; mediacoes: number; eventos?: number }

export const rotulosGrupoAdmin: Record<GrupoAdmin, string> = {
  moderacao: 'Moderação',
  cadastros: 'Cadastros',
  referencia: 'Referência',
}

export function itensAdmin({ curadoria, mediacoes, eventos = 0 }: ContagensAdmin = { curadoria: 0, mediacoes: 0 }): ItemAdmin[] {
  return [
    {
      chave: 'curadoria',
      texto: 'Fila de curadoria',
      textoCurto: 'Curadoria',
      href: '/admin',
      icone: <IconeSelo />,
      grupo: 'moderacao',
      marcador: curadoria > 0 ? { texto: `${curadoria} na fila` } : undefined,
    },
    {
      chave: 'eventos',
      texto: 'Moderação de eventos',
      textoCurto: 'Eventos',
      href: '/admin/events',
      icone: <IconeCalendario />,
      grupo: 'moderacao',
      marcador: eventos > 0 ? { texto: eventos === 1 ? '1 evento pendente' : `${eventos} eventos pendentes` } : undefined,
    },
    {
      chave: 'mediacoes',
      texto: 'Mediações',
      textoCurto: 'Mediações',
      href: '/admin/mediations',
      icone: <IconeAviso />,
      grupo: 'moderacao',
      marcador: mediacoes > 0 ? { texto: mediacoes === 1 ? '1 aberta' : `${mediacoes} abertas`, alerta: true } : undefined,
    },
    {
      chave: 'coletivos',
      texto: 'Cadastrar coletivo',
      textoCurto: 'Coletivos',
      href: '/admin/collectives/new',
      icone: <IconeUsuario />,
      grupo: 'cadastros',
    },
    {
      chave: 'organizadores',
      texto: 'Organizadores',
      textoCurto: 'Organizadores',
      href: '/admin/accounts',
      icone: <IconeCadeado />,
      grupo: 'cadastros',
    },
    {
      chave: 'criterios',
      texto: 'Critérios',
      textoCurto: 'Critérios',
      href: '/admin/criteria',
      icone: <IconeGrade />,
      grupo: 'referencia',
    },
  ]
}

export function itensAdminPorGrupo(contagens?: ContagensAdmin) {
  const itens = itensAdmin(contagens)
  return (Object.keys(rotulosGrupoAdmin) as GrupoAdmin[])
    .map((grupo) => ({ grupo, rotulo: rotulosGrupoAdmin[grupo], itens: itens.filter((i) => i.grupo === grupo) }))
    .filter((g) => g.itens.length > 0)
}
