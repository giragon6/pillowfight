import { useState } from 'react'
import headerImage from './assets/homepage/pillowfight-title.png'
import { setupGame } from './game/setupGame'
import { getAvatarAssets } from './game/utils/avatarLoader'
import type { PlayerData } from '../shared/types/playerTypes'
import './App.css'

function App() {
  const [playerName, setPlayerName] = useState('Pancake')
  const [faction, setFaction] = useState('yellow')
  const [avatar, setAvatar] = useState('pancake1')
  const [isStarting, setIsStarting] = useState(false)
  const avatarAssets = getAvatarAssets()

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

    setIsStarting(true)

    try {
      // Setup game and get socket
      const { socket } = setupGame()

      // Prepare player data
      const playerData: PlayerData = {
        username: playerName,
        avatar: avatar,
        sound: 'default',
        faction: (faction.charAt(0).toUpperCase() + faction.slice(1)) as any,
      }

      // Emit player customization to server
      socket?.emit('playerCustomization', playerData)
    } catch (error) {
      console.error('Failed to start game:', error)
      alert('Failed to start game')
      setIsStarting(false)
    }
  }

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

        <fieldset className="field factions" disabled={isStarting}>
          <legend>Choose faction</legend>
          <div className="faction-options">
            <label className="faction-choice" htmlFor="faction-lavender">
              <input
                id="faction-lavender"
                type="radio"
                name="faction"
                value="lavender"
                aria-label="Lavender faction"
                checked={faction === 'lavender'}
                onChange={(e) => setFaction(e.target.value)}
                disabled={isStarting}
              />
              <span className="faction-swatch lavender" aria-hidden="true"></span>
            </label>
            <label className="faction-choice" htmlFor="faction-yellow">
              <input
                id="faction-yellow"
                type="radio"
                name="faction"
                value="yellow"
                aria-label="Yellow faction"
                checked={faction === 'yellow'}
                onChange={(e) => setFaction(e.target.value)}
                disabled={isStarting}
              />
              <span className="faction-swatch yellow" aria-hidden="true"></span>
            </label>
            <label className="faction-choice" htmlFor="faction-blue">
              <input
                id="faction-blue"
                type="radio"
                name="faction"
                value="blue"
                aria-label="Blue faction"
                checked={faction === 'blue'}
                onChange={(e) => setFaction(e.target.value)}
                disabled={isStarting}
              />
              <span className="faction-swatch blue" aria-hidden="true"></span>
            </label>
            <label className="faction-choice" htmlFor="faction-pink">
              <input
                id="faction-pink"
                type="radio"
                name="faction"
                value="pink"
                aria-label="Pink faction"
                checked={faction === 'pink'}
                onChange={(e) => setFaction(e.target.value)}
                disabled={isStarting}
              />
              <span className="faction-swatch pink" aria-hidden="true"></span>
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
          disabled={isStarting}
        >
          {isStarting ? 'Starting...' : 'Start'}
        </button>
      </section>

      <a className="homepage-leaderboard-fab" href="/leaderboard" aria-label="Open leaderboard">
        <span className="homepage-leaderboard-fab-icon" aria-hidden="true"></span>
      </a>
    </main>
  )
}

export default App
