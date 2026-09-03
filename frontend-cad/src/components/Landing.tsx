import React, { useEffect, useState } from 'react';
import { Layers, Cuboid, FileText, ArrowRight, PenTool } from 'lucide-react';

interface LandingProps {
  onStart: () => void;
}

export default function Landing({ onStart }: LandingProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Activar animaciones de entrada un milisegundo después de montar
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 font-sans selection:bg-blue-100 flex flex-col overflow-x-hidden">
      
      {/* Navegación Superior */}
      <nav className={`w-full px-8 py-6 flex justify-between items-center transition-all duration-1000 transform ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-lg">
            <PenTool size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-800">SantaPlan</span>
        </div>
        <button 
          onClick={onStart}
          className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
        >
          Ir al Editor
        </button>
      </nav>

      {/* Héroe (Hero Section) */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center -mt-10">
        
        <div className={`transition-all duration-1000 delay-100 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <span className="inline-block py-1 px-3 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold tracking-wider mb-6 border border-blue-100 shadow-sm">
            SOFTWARE DE ARQUITECTURA 2.0
          </span>
        </div>

        <h1 className={`max-w-4xl text-5xl md:text-7xl font-extrabold tracking-tighter text-gray-900 mb-6 leading-[1.1] transition-all duration-1000 delay-300 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          Diseña planos <br /> 
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">
            con precisión milimétrica.
          </span>
        </h1>
        
        <p className={`max-w-2xl text-lg md:text-xl text-gray-500 mb-10 transition-all duration-1000 delay-500 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          SantaPlan es la herramienta definitiva para crear planos de planta profesionales en 2D y renderizar vistas arquitectónicas de estilo Diorama en 3D PBR al instante.
        </p>

        <div className={`transition-all duration-1000 delay-700 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <button 
            onClick={onStart}
            className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white transition-all duration-300 ease-in-out bg-blue-600 border border-transparent rounded-full shadow-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 hover:scale-105"
          >
            Comenzar a Diseñar
            <ArrowRight size={18} className="ml-2 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </div>

      </main>

      {/* Características (Features) */}
      <div className={`pb-20 px-8 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 transition-all duration-1000 delay-1000 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <FeatureCard 
          icon={<Layers size={24} className="text-blue-500" />}
          title="Dibujo CAD Inteligente"
          description="Traza paredes continuas y el motor calculará y acotará automáticamente todas las distancias, puertas y ventanas."
        />
        <FeatureCard 
          icon={<Cuboid size={24} className="text-indigo-500" />}
          title="Diorama 3D en Tiempo Real"
          description="Visualiza tu plano como una maqueta arquitectónica hiperrealista con luces, sombras suaves y texturas PBR."
        />
        <FeatureCard 
          icon={<FileText size={24} className="text-emerald-500" />}
          title="Exportación Profesional"
          description="Exporta tus planos bidimensionales a PDF de alta resolución con un solo clic, listo para imprimir y presentar."
        />
      </div>

    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 leading-relaxed text-sm">
        {description}
      </p>
    </div>
  );
}
