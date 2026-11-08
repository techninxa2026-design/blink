import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BlinkDialogHost, BlinkModalAccessibility } from './BlinkDialogs'
import './BlinkPolish.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <BlinkDialogHost />
    <BlinkModalAccessibility />
  </StrictMode>,
)
