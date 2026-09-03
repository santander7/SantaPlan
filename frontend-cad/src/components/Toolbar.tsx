import React from 'react';
import { MousePointer2, Pencil, Trash2, Box, PenTool, Layers, Square, Download } from 'lucide-react';

export type ToolMode = 'select' | 'draw' | 'door' | 'window' | 'garage' | 'toilet' | 'sofa' | 'bed' | 'plant' | 'tree' | 'stairs' | 'column' | 'table' | 'chair' | 'text' | 'car' | 'dining' | 'kitchen' | 'tv' | 'socket' | 'lamp' | 'shower' | 'bathtub';
export type ViewMode = '2D' | '3D';

interface ToolbarProps {
  activeMode: ToolMode;
  viewMode: ViewMode;
  currentLevel: number;
  onModeChange: (mode: ToolMode) => void;
  onViewChange: (view: ViewMode) => void;
  onLevelChange: (level: number) => void;
  onClearAll: () => void;
  onDownloadPDF?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeMode, viewMode, currentLevel, onModeChange, onViewChange, onLevelChange, onClearAll, onDownloadPDF }) => {
  return (
    <div className="w-full bg-[#f8f9fa] border-b border-gray-300 flex flex-col font-sans select-none z-50 shadow-sm relative">
      {/* SmartDraw Style Tabs */}
      <div className="flex bg-[#ffffff] px-4 pt-2 border-b border-gray-300 gap-6">
        <span className="font-bold text-blue-600 text-lg mr-4 flex items-center">SantaPlan</span>
        <button className="px-2 py-1 text-sm font-semibold text-gray-800 border-b-2 border-blue-500">Home</button>
        <button className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors">Design</button>
        <button className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors">Page</button>
        <button className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors">View</button>
      </div>

      {/* Ribbon Bar */}
      <div className="flex items-center p-2 gap-4 bg-[#f8f9fa] overflow-x-auto">
        
        {/* Archivo / Portapapeles (SmartDraw fake) */}
        <div className="flex flex-col items-center border-r border-gray-300 pr-4 pl-2">
           <div className="flex gap-2">
             <button className="flex flex-col items-center justify-center p-2 rounded w-14 h-16 hover:bg-gray-200 border border-transparent text-gray-700">
                <Download size={20} />
                <span className="text-[9px] mt-1 font-medium">Exportar</span>
             </button>
           </div>
           <span className="text-[9px] text-gray-400 mt-2 uppercase tracking-wider font-semibold">Archivo</span>
        </div>
        
        {/* Toggle View Group */}
        <div className="flex flex-col items-center border-r border-gray-300 pr-6 pl-2">
          <div className="flex gap-2">
            <button
              onClick={() => onViewChange('2D')}
              className={`flex flex-col items-center justify-center p-2 rounded w-16 h-16 transition-colors ${
                viewMode === '2D' ? 'bg-blue-100 border border-blue-300 text-blue-800' : 'hover:bg-gray-200 border border-transparent text-gray-700'
              }`}
            >
              <PenTool size={24} />
              <span className="text-[10px] mt-1 font-medium">Planta 2D</span>
            </button>
            <button
              onClick={() => onViewChange('3D')}
              className={`flex flex-col items-center justify-center p-2 rounded w-16 h-16 transition-colors ${
                viewMode === '3D' ? 'bg-blue-100 border border-blue-300 text-blue-800' : 'hover:bg-gray-200 border border-transparent text-gray-700'
              }`}
            >
              <Box size={24} />
              <span className="text-[10px] mt-1 font-medium">Render 3D</span>
            </button>
          </div>
          <span className="text-[9px] text-gray-400 mt-2 uppercase tracking-wider font-semibold">Vistas</span>
        </div>

        {/* Level Selector */}
        <div className="flex flex-col items-center border-r border-gray-300 pr-6">
          <div className="flex flex-col justify-center h-16 gap-1">
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
              <Layers size={14} /> Nivel Activo:
            </label>
            <select 
              value={currentLevel}
              onChange={(e) => onLevelChange(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded px-2 py-1 bg-white outline-none focus:border-yellow-400 min-w-[120px]"
            >
              <option value={1}>Piso 1</option>
              <option value={2}>Piso 2</option>
            </select>
          </div>
          <span className="text-[9px] text-gray-400 mt-2 uppercase tracking-wider font-semibold">Estructura</span>
        </div>

        {/* Tools Group (Only essential tools, symbols moved to sidebar) */}
        {viewMode === '2D' && (
          <div className="flex flex-col items-center border-r border-gray-300 pr-6">
            <div className="flex gap-2">
              <button
                onClick={() => onModeChange('select')}
                className={`flex flex-col items-center justify-center p-2 rounded w-14 h-16 transition-colors ${
                  activeMode === 'select' ? 'bg-blue-100 border border-blue-300 text-blue-800' : 'hover:bg-gray-200 border border-transparent text-gray-700'
                }`}
              >
                <MousePointer2 size={24} />
                <span className="text-[10px] mt-1 font-medium">Select</span>
              </button>
              <button
                onClick={() => onModeChange('draw')}
                className={`flex flex-col items-center justify-center p-2 rounded w-14 h-16 transition-colors ${
                  activeMode === 'draw' ? 'bg-blue-100 border border-blue-300 text-blue-800' : 'hover:bg-gray-200 border border-transparent text-gray-700'
                }`}
              >
                <Pencil size={24} />
                <span className="text-[10px] mt-1 font-medium">Wall</span>
              </button>
              <button
                onClick={() => onModeChange('column')}
                className={`flex flex-col items-center justify-center p-2 rounded w-14 h-16 transition-colors ${
                  activeMode === 'column' ? 'bg-blue-100 border border-blue-300 text-blue-800' : 'hover:bg-gray-200 border border-transparent text-gray-700'
                }`}
              >
                <Square fill="currentColor" size={24} />
                <span className="text-[10px] mt-1 font-medium">Column</span>
              </button>
            </div>
            <span className="text-[9px] text-gray-400 mt-2 uppercase tracking-wider font-semibold">Tools</span>
          </div>
        )}

        {/* Project Group */}
        <div className="flex flex-col items-center ml-auto pr-4">
          <div className="flex gap-1 ml-auto border-l border-gray-300 pl-4 items-center">
            {viewMode === '2D' && onDownloadPDF && (
              <button 
                onClick={onDownloadPDF}
                className="flex flex-col items-center justify-center p-1.5 px-3 rounded hover:bg-gray-100 text-gray-700"
              >
                <Download size={20} className="mb-1" />
                <span className="text-[10px] font-medium tracking-wide">PDF</span>
              </button>
            )}
            {/* 
              BOTÓN DE IA OCULTO TEMPORALMENTE (A petición del usuario)
              <button
                onClick={() => document.dispatchEvent(new CustomEvent('openAiRender'))}
                className="flex flex-col items-center justify-center p-1.5 px-3 rounded hover:bg-blue-50 text-blue-600 font-bold"
              >
                <PenTool size={20} className="mb-1" />
                <span className="text-[10px] font-bold tracking-wide">Render IA</span>
              </button>
            */}
            <button 
              onClick={onClearAll}
              className="flex flex-col items-center justify-center p-1.5 px-3 rounded hover:bg-red-50 text-red-600 ml-2"
            >
              <Trash2 size={20} className="mb-1" />
              <span className="text-[10px] font-medium tracking-wide">Limpiar</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
