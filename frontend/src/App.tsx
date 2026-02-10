import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { CameraUpload } from './components/features/CameraUpload'
import { ValidationInterface } from './components/features/ValidationInterface';
import { DashboardLayout } from './components/features/DashboardLayout';
import { IngredientsTable } from './components/features/IngredientsTable';
import { RecipesList } from './components/features/RecipesList';
import type { UploadResponse } from './types'

const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'ingredients' | 'recipes'>('upload');
  const [view, setView] = useState<'list' | 'validation'>('list');
  const [receiptData, setReceiptData] = useState<UploadResponse | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchPendingCount();
  }, [activeTab]);

  const fetchPendingCount = async () => {
    try {
      const res = await fetch(`${API_URL}/api/ingredients/pending`);
      const data = await res.json();
      setPendingCount(data.length);
    } catch {
      // ignore
    }
  };

  const handleUploadSuccess = (data: UploadResponse) => {
    setReceiptData(data);
    setView('validation');
  };

  const handleValidationSuccess = () => {
    setView('list');
    setReceiptData(null);
    fetchPendingCount();
  };

  const renderContent = () => {
    if (activeTab === 'ingredients') {
      return <IngredientsTable onIngredientUpdate={fetchPendingCount} />;
    }

    if (activeTab === 'recipes') {
      return (
        <div>
          <h2 className="text-2xl font-bold mb-6">Receitas & CMV</h2>
          <RecipesList />
        </div>
      );
    }

    // Upload Tab
    if (view === 'validation' && receiptData) {
      return (
        <ValidationInterface
          data={receiptData}
          onBack={() => setView('list')}
          onSuccess={handleValidationSuccess}
        />
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="mb-8 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-2">Enviar Notas</h2>
          <p className="text-gray-400">Tire fotos ou faça upload de notas fiscais para atualizar preços automaticamente.</p>
        </div>
        <CameraUpload onUploadSuccess={handleUploadSuccess} />
      </div>
    );
  };

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab);
        if (tab !== 'upload') {
          setView('list');
        }
      }}
      pendingCount={pendingCount}
    >
      {renderContent()}
      <Toaster position="bottom-center" toastOptions={{
        style: {
          background: '#333',
          color: '#fff',
        },
      }} />
    </DashboardLayout>
  );
}

export default App
