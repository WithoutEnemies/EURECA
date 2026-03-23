import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Este e o ponto de entrada do frontend.
// O React pega a div "root" do HTML e monta toda a interface dentro dela.
createRoot(document.getElementById('root')).render(
  // StrictMode ajuda a encontrar comportamentos arriscados durante o desenvolvimento.
  <StrictMode>
    <App />
  </StrictMode>,
)
