import { useEffect, useMemo, useRef, useState } from 'react'
import FACTION_COLORS, { getFactionIcon, getFactionNickname } from '../shared/factionColors'
import { getAvatarAssets } from './game/utils/avatarLoader'
import gameImage from './assets/pillowfight game.png'
import './LeaderboardPage.css'

type FactionName = 'Lavender' | 'Yellow' | 'Blue' | 'Pink'

type LeaderboardResponse = {
  claimedTiles: number
  totalTiles: number
  updatedAt: number
  factions: Array<{
    faction: FactionName
    tiles: number
    percentage: number
  }>
  characters: Array<{
    avatarKey: string
    tiles: number
    percentage: number
  }>
}

const configuredServerUrl = (import.meta.env.VITE_SERVER_URL || '').trim()
const LEADERBOARD_SNAPSHOT_KEY = 'leaderboardSnapshot'

function getLeaderboardApiCandidates(): string[] {
  const sameOriginUrl = '/api/leaderboard'
  if (!configuredServerUrl) {
    return [sameOriginUrl]
  }

  const configuredUrl = `${configuredServerUrl.replace(/\/$/, '')}/api/leaderboard`
  if (configuredUrl === sameOriginUrl) {
    return [sameOriginUrl] 
  }

  return [sameOriginUrl, configuredUrl]
}

function colorHex(faction: FactionName): string {
  return `#${FACTION_COLORS[faction].toString(16).padStart(6, '0')}`
}

function buildPieGradient(data: LeaderboardResponse | null): string {
  if (!data || data.claimedTiles === 0) {
    return '#ebe3ef'
  }

  let running = 0
  const segments = data.factions
    .filter((entry) => entry.tiles > 0)
    .map((entry) => {
      const start = running
      running += entry.percentage
      return `${colorHex(entry.faction)} ${start.toFixed(2)}% ${running.toFixed(2)}%`
    })

  return `conic-gradient(${segments.join(', ')})`
}

function isFactionName(value: string): value is FactionName {
  return value === 'Lavender' || value === 'Yellow' || value === 'Blue' || value === 'Pink'
}

function readLeaderboardSnapshot(): LeaderboardResponse | null {
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_SNAPSHOT_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as LeaderboardResponse
    if (!parsed || !Array.isArray(parsed.factions)) return null

    const validFactions = parsed.factions.filter(
      (entry): entry is LeaderboardResponse['factions'][number] =>
        isFactionName(entry.faction) &&
        Number.isFinite(entry.tiles) &&
        Number.isFinite(entry.percentage),
    )

    if (validFactions.length !== parsed.factions.length) {
      return null
    }

    const characters = Array.isArray((parsed as LeaderboardResponse).characters)
      ? (parsed as LeaderboardResponse).characters.filter(
          (entry) =>
            typeof entry.avatarKey === 'string' &&
            Number.isFinite(entry.tiles) &&
            Number.isFinite(entry.percentage),
        )
      : []

    return {
      claimedTiles: Number(parsed.claimedTiles) || 0,
      totalTiles: Number(parsed.totalTiles) || 0,
      updatedAt: Number(parsed.updatedAt) || Date.now(),
      factions: validFactions,
      characters,
    }
  } catch (_error) {
    return null
  }
}

export default function LeaderboardPage() {
  const initialSnapshot = useMemo(() => readLeaderboardSnapshot(), [])
  const avatarAssetsByKey = useMemo(
    () => new Map(getAvatarAssets().map(({ key, url }) => [key, url])),
    [],
  )
  const [data, setData] = useState<LeaderboardResponse | null>(initialSnapshot)
  const [loading, setLoading] = useState(() => initialSnapshot === null)
  const [error, setError] = useState('')
  const hasDataRef = useRef(initialSnapshot !== null)

  useEffect(() => {
    hasDataRef.current = data !== null
  }, [data])

  const fetchLeaderboard = async () => {
    try {
      setError('')

      const candidateUrls = getLeaderboardApiCandidates()
      let lastError: Error | null = null

      for (const url of candidateUrls) {
        try {
          const response = await fetch(url, { cache: 'no-store' })
          if (!response.ok) {
            throw new Error('Failed to load leaderboard')
          }

          const payload = (await response.json()) as LeaderboardResponse
          setData(payload)
          return
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Failed to load leaderboard')
        }
      }

      throw lastError ?? new Error('Failed to load leaderboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      // If we already have data on screen, keep it and avoid noisy red errors.
      if (!hasDataRef.current) {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
    const timer = window.setInterval(fetchLeaderboard, 3000)
    return () => window.clearInterval(timer)
  }, [])

  const leaderLine = useMemo(() => {
    if (!data || data.claimedTiles === 0) {
      return 'No territory has been claimed yet.'
    }

    const leader = data.factions[0]
    return `Current top faction: ${getFactionNickname(leader.faction)} (${leader.tiles} tiles, ${leader.percentage.toFixed(1)}%).`
  }, [data])

  return (
    <main className="leaderboard-page">
      <div className="leaderboard-header-wrapper">
        <img className="leaderboard-qr" src={gameImage} />
        <h2 className='cta'>PLAY RIGHT NOW AT <a href="pillowfight.onrender.com">pillowfight.onrender.com</a></h2>
        <img className="leaderboard-qr" src={gameImage} />
      </div>
      <section className="leaderboard-shell" aria-label="Faction leaderboard">
        <span className="leaderboard-pill">Leaderboard</span>
        <h1>Leaderboard</h1>
        <p className="leaderboard-copy">{leaderLine}</p>

        {loading ? <p className="leaderboard-state">Loading leaderboard...</p> : null}
        {error ? <p className="leaderboard-state leaderboard-state-error">{error}</p> : null}

        <div className="leaderboard-split">
          <section className="leaderboard-panel" aria-label="Faction leaderboard panel">
            <h2 className="leaderboard-subtitle">Faction Leaderboard</h2>
            <div className="leaderboard-chart-wrap">
              <div
                className="leaderboard-chart"
                style={{ background: buildPieGradient(data) }}
                aria-label="Faction pie chart"
              />
            </div>
            <ul className="leaderboard-list" aria-label="Faction tile percentages">
              {(data?.factions ?? []).map((entry) => (
                <li key={entry.faction} className="leaderboard-item">
                  <span
                    className="leaderboard-dot"
                    style={{ backgroundColor: colorHex(entry.faction) }}
                    aria-hidden="true"
                  />
                  <span className="leaderboard-name">{getFactionNickname(entry.faction)+" "+getFactionIcon(entry.faction)}</span>
                  <span className="leaderboard-count">{entry.tiles} tiles</span>
                  <span className="leaderboard-percent">{entry.percentage.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="leaderboard-panel" aria-label="Character leaderboard panel">
            <h2 className="leaderboard-subtitle">Character Leaderboard</h2>
            <ul className="leaderboard-list" aria-label="Character tile percentages">
              {(data?.characters ?? []).length === 0 ? (
                <li className="leaderboard-item">
                  <span className="leaderboard-name">No character territory data yet.</span>
                </li>
              ) : (
                (data?.characters ?? []).map((entry) => (
                  <li key={entry.avatarKey} className="leaderboard-item leaderboard-character-item">
                    <img
                      className="leaderboard-avatar"
                      src={avatarAssetsByKey.get(entry.avatarKey) ?? ''}
                      alt={entry.avatarKey}
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="leaderboard-count">{entry.tiles} tiles</span>
                    <span className="leaderboard-percent">{entry.percentage.toFixed(1)}%</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        <div className="leaderboard-footer">
          <span>
            Claimed: {data?.claimedTiles ?? 0} / {data?.totalTiles ?? 0}
          </span>
          <a href="/" className="leaderboard-home-link">
            Back to Home
          </a>
        </div>
      </section>
    </main>
  )
}
