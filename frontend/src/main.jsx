import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import 'sweetalert2/dist/sweetalert2.min.css';
import './styles.css';
import { consumeConfirmation } from './utils/auth-confirmation.js';

const confirmationMessage = consumeConfirmation(window.location, window.history);

// React monta todos nuestros componentes dentro de <div id="root">.
createRoot(document.getElementById('root')).render(<React.StrictMode><App confirmationMessage={confirmationMessage} /></React.StrictMode>);
