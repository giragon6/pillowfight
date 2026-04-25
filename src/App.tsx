import { useState } from 'react'
import headerImage from './assets/homepage/pillow-fight-header.png'
<<<<<<< Updated upstream
import { setupGame } from './game/setupGame'
import { getAvatarAssets } from './game/utils/avatarLoader'
import type { PlayerData } from '../shared/types/playerTypes'
=======
import avatar1 from './assets/avatar/avtr1.png'
import avatar2 from './assets/avatar/avtr2.png'
import avatar3 from './assets/avatar/avtr3.png'
import avatar4 from './assets/avatar/avtr4.png'
import avatar5 from './assets/avatar/avtr5.png'
import avatar6 from './assets/avatar/avtr6.png'
import avatar7 from './assets/avatar/pancake1.png'
import avatar8 from './assets/avatar/pancake2.png'
import avatar9 from './assets/avatar/pancake3.png'
import avatar10 from './assets/avatar/pancake4.png'
import avatar11 from './assets/avatar/pancake5.png'
import avatar12 from './assets/avatar/pancake6.png'
>>>>>>> Stashed changes
import './App.css'

function App() {
  const [playerName, setPlayerName] = useState('')
  const [faction, setFaction] = useState('')
  const [avatar, setAvatar] = useState('')
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
<<<<<<< Updated upstream
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
=======
            <label className="avatar-choice" htmlFor="avatar-1">
              <input id="avatar-1" type="radio" name="avatar" value="1" aria-label="Avatar 1" />
              <span className="avatar-slot" aria-hidden="true">
                <img className="avatar-image" src={avatar1} alt="" />
              </span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-2">
              <input id="avatar-2" type="radio" name="avatar" value="2" aria-label="Avatar 2" />
              <span className="avatar-slot" aria-hidden="true">
                <img className="avatar-image" src={avatar2} alt="" />
              </span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-3">
              <input id="avatar-3" type="radio" name="avatar" value="3" aria-label="Avatar 3" />
              <span className="avatar-slot" aria-hidden="true">
                <img className="avatar-image" src={avatar3} alt="" />
              </span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-4">
              <input id="avatar-4" type="radio" name="avatar" value="4" aria-label="Avatar 4" />
              <span className="avatar-slot" aria-hidden="true">
                <img className="avatar-image" src={avatar4} alt="" />
              </span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-5">
              <input id="avatar-5" type="radio" name="avatar" value="5" aria-label="Avatar 5" />
              <span className="avatar-slot" aria-hidden="true">
                <img className="avatar-image" src={avatar5} alt="" />
              </span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-6">
              <input id="avatar-6" type="radio" name="avatar" value="6" aria-label="Avatar 6" />
              <span className="avatar-slot" aria-hidden="true">
                <img className="avatar-image" src={avatar6} alt="" />
              </span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-7">
              <input id="avatar-7" type="radio" name="avatar" value="7" aria-label="Avatar 7" />
              <span className="avatar-slot" aria-hidden="true">
                <img className="avatar-image" src={avatar7} alt="" />
              </span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-8">
              <input id="avatar-8" type="radio" name="avatar" value="8" aria-label="Avatar 8" />
              <span className="avatar-slot" aria-hidden="true">
                <img className="avatar-image" src={avatar8} alt="" />
              </span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-9">
              <input id="avatar-9" type="radio" name="avatar" value="9" aria-label="Avatar 9" />
              <span className="avatar-slot" aria-hidden="true">
                <img className="avatar-image" src={avatar9} alt="" />
              </span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-10">
              <input id="avatar-10" type="radio" name="avatar" value="10" aria-label="Avatar 10" />
              <span className="avatar-slot" aria-hidden="true">
                <img className="avatar-image" src={avatar10} alt="" />
              </span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-11">
              <input id="avatar-11" type="radio" name="avatar" value="11" aria-label="Avatar 11" />
              <span className="avatar-slot" aria-hidden="true">
                <img className="avatar-image" src={avatar11} alt="" />
              </span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-12">
              <input id="avatar-12" type="radio" name="avatar" value="12" aria-label="Avatar 12" />
              <span className="avatar-slot" aria-hidden="true">
                <img className="avatar-image" src={avatar12} alt="" />
              </span>
            </label>
>>>>>>> Stashed changes
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
    </main>
  )
}

export default App
