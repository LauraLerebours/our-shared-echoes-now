import { createRoot } from 'react-dom/client'
import { StrictMode, useEffect } from 'react'
import App from './App.tsx'
import './index.css'

// Register service worker for PWA support
// Only register in production environment to avoid errors in development/unsupported platforms
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { 
      type: 'module',
      scope: '/'
    })
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// Add to home screen prompt handler
function PWAInstallPrompt() {
  useEffect(() => {
    // For iOS devices
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    // Show iOS install instructions if not already installed
    if (isIOS && !isStandalone) {
      // Check if we've already shown the prompt
      const hasShownPrompt = localStorage.getItem('pwaPromptShown');
      
      if (!hasShownPrompt) {
        // Wait a bit before showing the prompt
        setTimeout(() => {
          const showPrompt = confirm(
            "To install this app on your iPhone: tap the Share button, then 'Add to Home Screen'"
          );
          
          if (showPrompt) {
            localStorage.setItem('pwaPromptShown', 'true');
          }
        }, 5000);
      }
    }
  }, []);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PWAInstallPrompt />
    <App />
  </StrictMode>
);