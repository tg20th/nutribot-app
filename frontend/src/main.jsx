import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';
import './styles/public-profile.css';
import { ToastProvider } from './components/notifications/ToastProvider';
import ToastViewport from './components/notifications/ToastViewport';
import './styles/notifications.css';
import ErrorBoundary from './components/errors/ErrorBoundary';

createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><ErrorBoundary><ToastProvider><App/><ToastViewport/></ToastProvider></ErrorBoundary></BrowserRouter></StrictMode>);
