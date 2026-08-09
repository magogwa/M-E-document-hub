import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './lib/auth';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { borderRadius: '10px', fontSize: '14px' },
            error: { duration: 5000 },
            success: { duration: 3000 }
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);