import { useEffect, useState } from 'react'
import headerImage from './assets/homepage/pillowfight-title.png'
import { setupGame } from './game/setupGame'
import { getAvatarAssets } from './game/utils/avatarLoader'
import type { PlayerData } from '../shared/types/playerTypes'
import { getFactionIcon } from '../shared/factionColors'
import type { Faction } from '../shared/types/factions'
import './App.css'

type FactionPopulationResponse = {
  counts: Record<Faction, number>
  totalPlayers: number
  updatedAt: number
}

const configuredServerUrl = (import.meta.env.VITE_SERVER_URL || '').trim()

function getFactionPopulationApiCandidates(): string[] {
  const sameOriginUrl = '/api/faction-population'
  if (!configuredServerUrl) {
    return [sameOriginUrl]
  }

  const configuredUrl = `${configuredServerUrl.replace(/\/$/, '')}/api/faction-population`
  if (configuredUrl === sameOriginUrl) {
    return [sameOriginUrl]
  }

  return [sameOriginUrl, configuredUrl]
}

function App() {
  const [playerName, setPlayerName] = useState('')
  const [faction, setFaction] = useState('')
  const [avatar, setAvatar] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [factionPopulation, setFactionPopulation] = useState<FactionPopulationResponse | null>(null)
  const [isLoadingFactionPopulation, setIsLoadingFactionPopulation] = useState(true)
  const [factionPopulationError, setFactionPopulationError] = useState('')
  const avatarAssets = getAvatarAssets()

  const toFactionName = (value: string): Faction => {
    switch (value) {
      case 'lavender':
        return 'Lavender'
      case 'yellow':
        return 'Yellow'
      case 'blue':
        return 'Blue'
      case 'pink':
        return 'Pink'
      default:
        return 'Yellow'
    }
  }

  const handleStart = async () => {
    // Validate form
    if (!playerName.trim()) {
      alert('Please enter a player name')
      return
    }
    if (!faction) {
      alert('Please choose a faction')
      return
    }
    if (!avatar) {
      alert('Please choose an avatar')
      return
    }
    if (isLoadingFactionPopulation || factionPopulationError) {
      alert('Checking faction balance, please try again in a moment')
      return
    }
    if (isFactionBlocked(faction)) {
      alert(`Too many players are already on ${toFactionName(faction)}.`)
      return
    }

    setIsStarting(true)

    try {
      // Setup game and get socket
      const { socket } = setupGame()
      const factionName = toFactionName(faction)

      // Prepare player data
      const playerData: PlayerData = {
        username: playerName,
        avatar: avatar,
        sound: 'default',
        faction: factionName,
      }

      // Emit player customization to server
      socket?.emit('playerCustomization', playerData)
    } catch (error) {
      console.error('Failed to start game:', error)
      alert('Failed to start game')
      setIsStarting(false)
    }
  }

  const fetchFactionPopulation = async () => {
    try {
      setFactionPopulationError('')

      const candidateUrls = getFactionPopulationApiCandidates()
      let lastError: Error | null = null

      for (const url of candidateUrls) {
        try {
          const response = await fetch(url, { cache: 'no-store' })
          if (!response.ok) {
            throw new Error('Failed to load faction balance')
          }

          const payload = (await response.json()) as FactionPopulationResponse
          setFactionPopulation(payload)
          return
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Failed to load faction balance')
        }
      }

      throw lastError ?? new Error('Failed to load faction balance')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setFactionPopulationError(message)
    } finally {
      setIsLoadingFactionPopulation(false)
    }
  }

  useEffect(() => {
    fetchFactionPopulation()
    const timer = window.setInterval(fetchFactionPopulation, 3000)
    return () => window.clearInterval(timer)
  }, [])

  const isFactionBlocked = (value: string) => {
    if (!factionPopulation) {
      return false
    }

    const counts = Object.values(factionPopulation.counts)
    const highestCount = Math.max(...counts)
    const lowestCount = Math.min(...counts)

    if (highestCount === lowestCount) {
      return false
    }

    return factionPopulation.counts[toFactionName(value)] === highestCount
  }

  const isFactionChoiceDisabled = (value: string) => {
    return isStarting || isLoadingFactionPopulation || isFactionBlocked(value)
  }

  useEffect(() => {
    if (faction && isFactionBlocked(faction)) {
      setFaction('')
    }
  }, [faction, factionPopulation])

  return (
    <main className="homepage">
      <img
        className="homepage-header"
        src={headerImage}
        alt="Pillow Fight"
      />

      <section className="setup-card" aria-label="Player setup">
        <label className="field" htmlFor="player-name">
          <span>Enter name</span>
          <input
            id="player-name"
            name="player-name"
            type="text"
            placeholder="Player name"
            maxLength={20}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            disabled={isStarting}
          />
        </label>

        <fieldset className="field factions" disabled={isStarting || isLoadingFactionPopulation}>
          <legend>Choose faction</legend>
          {factionPopulationError ? (
            <p>Unable to check faction balance right now.</p>
          ) : factionPopulation && Object.values(factionPopulation.counts).every((count) => count === Object.values(factionPopulation.counts)[0]) ? (
            <p>Faction balance is even, so any faction is available.</p>
          ) : factionPopulation ? (
            <p>
              One or more factions are currently full for new players. Pick one of the other factions.
            </p>
          ) : (
            <p>Checking faction balance...</p>
          )}
          <div className="faction-options">
            <label
              className="faction-choice"
              htmlFor="faction-lavender"
              aria-disabled={isFactionChoiceDisabled('lavender')}
            >
              <input
                id="faction-lavender"
                type="radio"
                name="faction"
                value="lavender"
                aria-label="Lavender faction"
                checked={faction === 'lavender'}
                onChange={(e) => setFaction(e.target.value)}
                disabled={isFactionChoiceDisabled('lavender')}
              />
              <span className="faction-swatch lavender" aria-hidden="true">
                {getFactionIcon(toFactionName('lavender'))}
              </span>
            </label>
            <label
              className="faction-choice"
              htmlFor="faction-yellow"
              aria-disabled={isFactionChoiceDisabled('yellow')}
            >
              <input
                id="faction-yellow"
                type="radio"
                name="faction"
                value="yellow"
                aria-label="Yellow faction"
                checked={faction === 'yellow'}
                onChange={(e) => setFaction(e.target.value)}
                disabled={isFactionChoiceDisabled('yellow')}
              />
              <span className="faction-swatch yellow" aria-hidden="true">
                {getFactionIcon(toFactionName('yellow'))}
              </span>
            </label>
            <label
              className="faction-choice"
              htmlFor="faction-blue"
              aria-disabled={isFactionChoiceDisabled('blue')}
            >
              <input
                id="faction-blue"
                type="radio"
                name="faction"
                value="blue"
                aria-label="Blue faction"
                checked={faction === 'blue'}
                onChange={(e) => setFaction(e.target.value)}
                disabled={isFactionChoiceDisabled('blue')}
              />
              <span className="faction-swatch blue" aria-hidden="true">
                {getFactionIcon(toFactionName('blue'))}
              </span>
            </label>
            <label
              className="faction-choice"
              htmlFor="faction-pink"
              aria-disabled={isFactionChoiceDisabled('pink')}
            >
              <input
                id="faction-pink"
                type="radio"
                name="faction"
                value="pink"
                aria-label="Pink faction"
                checked={faction === 'pink'}
                onChange={(e) => setFaction(e.target.value)}
                disabled={isFactionChoiceDisabled('pink')}
              />
              <span className="faction-swatch pink" aria-hidden="true">
                {getFactionIcon(toFactionName('pink'))}
              </span>
            </label>
          </div>
        </fieldset>

        <fieldset className="field avatars" disabled={isStarting}>
          <legend>Choose avatar</legend>
          <div className="avatar-options">
            {avatarAssets.length > 0 ? (
              avatarAssets.map(({ key, url }) => (
                <label key={key} className="avatar-choice" htmlFor={`avatar-${key}`}>
                  <input
                    id={`avatar-${key}`}
                    type="radio"
                    name="avatar"
                    value={key}
                    aria-label={`Avatar ${key}`}
                    checked={avatar === key}
                    onChange={(e) => setAvatar(e.target.value)}
                    disabled={isStarting}
                  />
                  <img
                    src={url}
                    alt={`Avatar ${key}`}
                    className="avatar-preview"
                    style={{ maxWidth: '60px', maxHeight: '60px' }}
                  />
                </label>
              ))
            ) : (
              <p>No avatars available</p>
            )}
          </div>
        </fieldset>

        <button
          type="button"
          className="start-button"
          onClick={handleStart}
          disabled={isStarting || isLoadingFactionPopulation || Boolean(factionPopulationError)}
        >
          {isStarting
            ? 'Starting...'
            : isLoadingFactionPopulation
              ? 'Checking balance...'
              : factionPopulationError
                ? 'Balance unavailable'
                : 'Start'}
        </button>
      </section>

      <a className="homepage-leaderboard-fab" href="/leaderboard" aria-label="Open leaderboard">
        <span className="homepage-leaderboard-fab-icon" aria-hidden="true"></span>
      </a>
    </main>
  )
}

export default App
