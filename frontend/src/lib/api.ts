const API = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL ?? 'https://matchday.koraforge.com.ng/api')
  : 'https://matchday.koraforge.com.ng/api'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API}${path}`
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      ...init,
    })
    if (!res.ok) {
      let message = res.statusText
      try { const err = await res.json(); message = err.error ?? err.message ?? message } catch {}
      throw new Error(message)
    }
    return res.json()
  } catch (e: any) {
    if (e.name === 'TypeError' && e.message.includes('fetch')) {
      throw new Error('Could not connect to API — make sure the backend is running')
    }
    throw e
  }
}

export type MatchStatus = 'scheduled' | 'live' | 'half_time' | 'finished' | 'postponed' | 'cancelled'
export type EventType   = 'goal' | 'own_goal' | 'penalty_goal' | 'penalty_missed' | 'yellow_card' | 'red_card' | 'yellow_red_card' | 'substitution'
export type Position    = 'goalkeeper' | 'defender' | 'midfielder' | 'forward'

export interface Match {
  id: string
  competition_id: string
  competition_name: string
  competition_logo: string | null
  home_team_id: string
  home_team_name: string
  home_short: string
  home_logo: string | null
  home_color: string | null
  away_team_id: string
  away_team_name: string
  away_short: string
  away_logo: string | null
  away_color: string | null
  scheduled_at: string
  status: MatchStatus
  minute: number | null
  home_score: number
  away_score: number
  home_score_ht: number | null
  away_score_ht: number | null
  half_duration: number | null
  venue: string | null
  referee: string | null
  round: string | null
}

export interface Standing {
  team_id: string
  team_name: string
  short_name: string
  logo_url: string | null
  primary_color: string | null
  position: number
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  form: string | null
  group_name: string | null
}

export interface Player {
  id: string
  first_name: string
  last_name: string
  display_name: string | null
  date_of_birth: string | null
  position: Position | null
  photo_url: string | null
  current_team: string | null
  team_logo: string | null
  team_id: string | null
  nationality_name: string | null
  height_cm: number | null
  weight_kg: number | null
}

export interface Competition {
  id: string
  name: string
  short_name: string | null
  logo_url: string | null
  format: string
  bracket_type: string | null
  team_size: number | null
  half_duration: number | null
  country_name: string | null
  flag_url: string | null
  season_name: string | null
  is_local: boolean
}

export interface Team {
  id: string
  name: string
  short_name: string | null
  logo_url: string | null
  primary_color: string | null
  coach_name: string | null
  country_name: string | null
  is_local: boolean
}
