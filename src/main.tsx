import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import LeaderboardPage from './LeaderboardPage.tsx'

function resolvePage() {
  const pathname = window.location.pathname.toLowerCase()
  if (pathname === '/leaderboard') {
    return <LeaderboardPage />
  }

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {resolvePage()}
  </StrictMode>,
)
