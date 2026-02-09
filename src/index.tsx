import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import USQCDApp from './USQCDApp'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <USQCDApp />
  </React.StrictMode>
)
