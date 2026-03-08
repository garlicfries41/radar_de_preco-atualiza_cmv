import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppShell } from './components/features/AppShell';
import { CatalogoModule } from './components/features/CatalogoModule';
import { ProducaoModule } from './components/features/ProducaoModule';
import { FinanceiroModule } from './components/features/FinanceiroModule';

function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/catalogo/upload" replace />} />
          <Route path="/catalogo/*" element={<CatalogoModule />} />
          <Route path="/producao/*" element={<ProducaoModule />} />
          <Route path="/financeiro/*" element={<FinanceiroModule />} />
          <Route path="*" element={<Navigate to="/catalogo/upload" replace />} />
        </Routes>
      </AppShell>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#1f2937',
            color: '#f9fafb',
            borderRadius: '10px',
            fontSize: '14px',
          },
        }}
      />
    </BrowserRouter>
  );
}

export default App;
