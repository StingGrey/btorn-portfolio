import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { SiteEditor, SiteEditorProvider } from './editor/SiteEditor';
import './styles.css';
import './editor/site-editor.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteEditorProvider>
      <App />
      <SiteEditor />
    </SiteEditorProvider>
  </StrictMode>,
);
