import React from 'react';
import ReactDOM from 'react-dom/client';
// Importa os estilos globais, incluindo Tailwind
import './index.css';
// Importa o componente principal da aplicação (deve exportar AppContainer por padrão)
import AppContainer from './App'; // Renomeado para AppContainer se App.js exporta AppContainer
import reportWebVitals from './reportWebVitals';

// Encontra o elemento root no HTML
const rootElement = document.getElementById('root');

if (rootElement) {
  // Cria a raiz do React
  const root = ReactDOM.createRoot(rootElement);
  // Renderiza a aplicação
  root.render(
    <React.StrictMode>
      {/* Renderiza o componente principal */}
      <AppContainer />
    </React.StrictMode>
  );
} else {
  console.error("Failed to find the root element. Ensure there is an element with id='root' in your index.html.");
}


// Função opcional para medir performance
// Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
