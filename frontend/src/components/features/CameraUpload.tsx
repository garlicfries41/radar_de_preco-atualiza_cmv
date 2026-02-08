import { useState, useRef, type ChangeEvent } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { uploadReceipt } from '../../services/api';
import type { UploadResponse } from '../../types';

interface CameraUploadProps {
    onUploadSuccess: (data: UploadResponse) => void;
}

export function CameraUpload({ onUploadSuccess }: CameraUploadProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<UploadResponse | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const objectUrl = URL.createObjectURL(selectedFile);
            setPreview(objectUrl);
            setResult(null); // Clear previous results
        }
    };

    const clearSelection = () => {
        setFile(null);
        setPreview(null);
        setResult(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        try {
            // In a real app, you'd handle the response properly
            const data = await uploadReceipt(file);
            console.log('Upload success:', data);
            setResult(data);
            onUploadSuccess(data);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Falha no upload do recibo. Verifique o console.');
        } finally {
            setUploading(false);
        }
    };

    const handleCameraClick = () => {
        fileInputRef.current?.click();
    };

    if (result) {
        return (
            <div className="w-full max-w-md bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700">
                <div className="text-center mb-6">
                    <div className="mx-auto bg-green-900/30 text-green-400 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                        <Upload size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-white">Recibo Processado!</h2>
                    <p className="text-gray-400 mt-1">{result.market_name || 'Mercado Desconhecido'}</p>
                    <div className="mt-4 text-2xl font-bold text-emerald-400">
                        R$ {result.total_amount?.toFixed(2)}
                    </div>
                </div>

                <div className="space-y-3">
                    <Button fullWidth onClick={clearSelection}>
                        Escanear Outro
                    </Button>
                    <Button fullWidth variant="secondary">
                        Validar Itens ({result.items?.length || 0})
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700">
            <div className="flex flex-col items-center">
                <input
                    type="file"
                    accept="image/*"
                    capture="environment" // Opens rear camera on mobile
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />

                {!preview ? (
                    <div
                        onClick={handleCameraClick}
                        className="w-full h-64 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-gray-800/50 transition-colors group"
                    >
                        <div className="p-4 bg-gray-700 rounded-full mb-4 group-hover:bg-gray-600 transition-colors">
                            <Camera size={48} className="text-gray-400 group-hover:text-primary transition-colors" />
                        </div>
                        <p className="text-gray-300 font-medium">Tirar Foto do Recibo</p>
                        <p className="text-gray-500 text-sm mt-2">ou selecione da galeria</p>
                    </div>
                ) : (
                    <div className="w-full relative rounded-lg overflow-hidden border border-gray-600">
                        <img
                            src={preview}
                            alt="Preview"
                            className="w-full h-auto max-h-[400px] object-contain bg-black"
                        />
                        <button
                            onClick={clearSelection}
                            className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                )}

                {preview && (
                    <div className="w-full mt-6 space-y-3">
                        <Button
                            fullWidth
                            size="lg"
                            onClick={handleUpload}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="animate-spin mr-2" size={20} />
                                    Processando OCR...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2" size={20} />
                                    Enviar Recibo
                                </>
                            )}
                        </Button>

                        {!uploading && (
                            <Button fullWidth variant="ghost" onClick={clearSelection}>
                                Cancelar
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
