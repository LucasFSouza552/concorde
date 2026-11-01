import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import ErrorBoundary from './ErrorBoundary'
import { playSound } from '../audio/sounds';

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <ErrorBoundary>
    {import.meta.env.DEV ? (
      <React.StrictMode>
        <App />
      </React.StrictMode>
    ) : (
      <App />
    )}
  </ErrorBoundary>
);

playSound('startup');