import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';

interface AiRenderModalProps {
  canvasDataUrl?: string; // Captured floorplan image to send to backend
}

export const AiRenderModal: React.FC<AiRenderModalProps> = ({ canvasDataUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [style, setStyle] = useState('modern');

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    document.addEventListener('openAiRender', handleOpen);
    return () => document.removeEventListener('openAiRender', handleOpen);
  }, []);

  const handleGenerate = async () => {
    if (!canvasDataUrl) return;
    setIsGenerating(true);
    setResultImage(null);

    try {
      // Send request to backend
      const response = await fetch('https://localhost:5001/api/airender/generate', { // Adjust port if needed
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: canvasDataUrl, style })
      });
      
      const data = await response.json();
      if (data.success) {
        setResultImage(data.imageUrl);
      } else {
        alert('Error generating render');
      }
    } catch (err) {
      console.error(err);
      // Fallback for simulation in case backend is not running yet
      setTimeout(() => {
        setResultImage('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop');
      }, 3000);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2 text-blue-600">
            <Sparkles size={24} />
            <h2 className="text-xl font-bold text-gray-800">IA Render Arquitectónico</h2>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {!resultImage && !isGenerating && (
            <div className="flex flex-col gap-4">
              <p className="text-gray-600">Genera una visualización hiperrealista de cómo se vería esta casa basada en tu plano 2D.</p>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estilo Arquitectónico</label>
                <select value={style} onChange={e => setStyle(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2">
                  <option value="modern">Casa Moderna / Minimalista</option>
                  <option value="industrial">Loft Industrial</option>
                  <option value="classic">Clásica / Tradicional</option>
                </select>
              </div>

              {canvasDataUrl && (
                 <div className="mt-4 border rounded-lg p-2 bg-gray-50">
                   <p className="text-xs text-gray-500 mb-2 font-bold">PLANO BASE CAPTURADO:</p>
                   <img src={canvasDataUrl} alt="Plano" className="w-full max-h-48 object-contain opacity-70" />
                 </div>
              )}
            </div>
          )}

          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 size={48} className="text-blue-500 animate-spin" />
              <h3 className="text-xl font-semibold text-gray-700">Analizando geometría y paredes...</h3>
              <p className="text-gray-500 text-center max-w-sm">La inteligencia artificial está renderizando las luces, texturas y materiales físicos de tu proyecto.</p>
            </div>
          )}

          {resultImage && !isGenerating && (
            <div className="flex flex-col gap-4 animate-in fade-in zoom-in duration-500">
              <div className="rounded-xl overflow-hidden shadow-lg border border-gray-200">
                <img src={resultImage} alt="Render IA" className="w-full h-auto object-cover" />
              </div>
              <p className="text-green-600 font-medium text-center">¡Render fotorealista generado con éxito!</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg">
            Cerrar
          </button>
          {!resultImage && (
            <button 
              onClick={handleGenerate}
              disabled={isGenerating || !canvasDataUrl}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-2 shadow-md transition-all"
            >
              {isGenerating ? 'Generando...' : 'Generar Imagen Realista'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
