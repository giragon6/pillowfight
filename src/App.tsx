import headerImage from './assets/homepage/pillow-fight-header.png'
import './App.css'

function App() {
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
          />
        </label>

        <fieldset className="field factions">
          <legend>Choose faction</legend>
          <div className="faction-options">
            <label className="faction-choice" htmlFor="faction-lavender">
              <input
                id="faction-lavender"
                type="radio"
                name="faction"
                value="lavender"
                aria-label="Lavender faction"
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
              />
              <span className="faction-swatch pink" aria-hidden="true"></span>
            </label>
          </div>
        </fieldset>

        <fieldset className="field avatars">
          <legend>Choose avatar</legend>
          <div className="avatar-options">
            <label className="avatar-choice" htmlFor="avatar-1">
              <input id="avatar-1" type="radio" name="avatar" value="1" aria-label="Avatar 1" />
              <span className="avatar-slot" aria-hidden="true"></span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-2">
              <input id="avatar-2" type="radio" name="avatar" value="2" aria-label="Avatar 2" />
              <span className="avatar-slot" aria-hidden="true"></span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-3">
              <input id="avatar-3" type="radio" name="avatar" value="3" aria-label="Avatar 3" />
              <span className="avatar-slot" aria-hidden="true"></span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-4">
              <input id="avatar-4" type="radio" name="avatar" value="4" aria-label="Avatar 4" />
              <span className="avatar-slot" aria-hidden="true"></span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-5">
              <input id="avatar-5" type="radio" name="avatar" value="5" aria-label="Avatar 5" />
              <span className="avatar-slot" aria-hidden="true"></span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-6">
              <input id="avatar-6" type="radio" name="avatar" value="6" aria-label="Avatar 6" />
              <span className="avatar-slot" aria-hidden="true"></span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-7">
              <input id="avatar-7" type="radio" name="avatar" value="7" aria-label="Avatar 7" />
              <span className="avatar-slot" aria-hidden="true"></span>
            </label>
            <label className="avatar-choice" htmlFor="avatar-8">
              <input id="avatar-8" type="radio" name="avatar" value="8" aria-label="Avatar 8" />
              <span className="avatar-slot" aria-hidden="true"></span>
            </label>
          </div>
        </fieldset>

        <button type="button" className="start-button">
          Start
        </button>
      </section>
    </main>
  )
}

export default App
