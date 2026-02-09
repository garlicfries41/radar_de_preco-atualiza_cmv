import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { CameraUpload } from './components/features/CameraUpload'
import { ValidationInterface } from './components/features/ValidationInterface';
import { DashboardLayout } from './components/features/DashboardLayout';
import { IngredientsList } from './components/features/IngredientsList';
import { RecipesList } from './components/features/RecipesList';
import type { UploadResponse } from './types'

function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'ingredients' | 'recipes'>('upload');
  const [view, setView] = useState<'list' | 'validation'>('list'); // internal view for upload tab specifically
  const [receiptData, setReceiptData] = useState<UploadResponse | null>(null);

  const handleUploadSuccess = (data: UploadResponse) => {
    setReceiptData(data);
    setView('validation');
  };

  const handleValidationSuccess = () => {
    setView('list');
    setReceiptData(null);
  };

  const renderContent = () => {
    if (activeTab === 'ingredients') {
      return (
        <div>
          <h2 className="text-2xl font-bold mb-6">Ingredientes</h2>
          <IngredientsList />
        </div>
      );
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
    <DashboardLayout activeTab={activeTab} onTabChange={(tab) => {
      setActiveTab(tab);
      // Reset upload flow when switching tabs if needed, or keep state
      if (tab !== 'upload') {
        setView('list');
      }
    }}>
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
