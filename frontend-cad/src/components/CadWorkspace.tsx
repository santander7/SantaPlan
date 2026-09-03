import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import jsPDF from 'jspdf';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { Wall } from '../models/Wall';
import type { WallElement, ElementType, FurnitureElement, FurnitureType } from '../models/Wall';
import { Toolbar } from './Toolbar';
import type { ToolMode, ViewMode } from './Toolbar';
import { AiRenderModal } from './AiRenderModal';
import { DoorClosed, LayoutGrid, Toilet, Sofa, Bed, TreeDeciduous, ArrowUpToLine, Search, Table2, Armchair, Type, Car, Utensils, Monitor, Plug, Lightbulb, Bath, Warehouse, Layers } from 'lucide-react';

const GRID_SIZE = 50; 
const PIXELS_PER_METER = 50;
const FLOOR_HEIGHT_M = 2.8;

const SYMBOLS = [
  { id: 'door', icon: <DoorClosed size={20} className="mb-1 text-gray-600" />, label: 'Door' },
  { id: 'window', icon: <LayoutGrid size={20} className="mb-1 text-gray-600" />, label: 'Window' },
  { id: 'garage', icon: <Warehouse size={20} className="mb-1 text-gray-600" />, label: 'Garage' },
  { id: 'bed', icon: <Bed size={20} className="mb-1 text-gray-600" />, label: 'Bed' },
  { id: 'sofa', icon: <Sofa size={20} className="mb-1 text-gray-600" />, label: 'Sofa' },
  { id: 'toilet', icon: <Toilet size={20} className="mb-1 text-gray-600" />, label: 'Toilet' },
  { id: 'plant', icon: <TreeDeciduous size={20} className="mb-1 text-gray-600" />, label: 'Plant' },
  { id: 'tree', icon: <TreeDeciduous size={20} className="mb-1 text-gray-600" />, label: 'Árbol Ext.' },
  { id: 'table', icon: <Table2 size={20} className="mb-1 text-gray-600" />, label: 'Table' },
  { id: 'chair', icon: <Armchair size={20} className="mb-1 text-gray-600" />, label: 'Chair' },
  { id: 'dining', icon: <Utensils size={20} className="mb-1 text-gray-600" />, label: 'Comedor' },
  { id: 'kitchen', icon: <Utensils size={20} className="mb-1 text-gray-600" />, label: 'Cocina' },
  { id: 'tv', icon: <Monitor size={20} className="mb-1 text-gray-600" />, label: 'TV' },
  { id: 'lamp', icon: <Lightbulb size={20} className="mb-1 text-gray-600" />, label: 'Lámpara' },
  { id: 'shower', icon: <Bath size={20} className="mb-1 text-gray-600" />, label: 'Ducha' },
  { id: 'bathtub', icon: <Bath size={20} className="mb-1 text-gray-600" />, label: 'Bañera' },
  { id: 'socket', icon: <Plug size={20} className="mb-1 text-gray-600" />, label: 'Enchufe' },
  { id: 'car', icon: <Car size={20} className="mb-1 text-gray-600" />, label: 'Auto', span: true },
  { id: 'stairs', icon: <ArrowUpToLine size={20} className="mb-1 text-gray-600" />, label: 'Stairs', span: true },
  { id: 'text', icon: <Type size={20} className="mb-1 text-gray-600" />, label: 'Text (Label)', span: true },
];

export const CadWorkspace: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine3dRef = useRef<HTMLCanvasElement>(null);
  
  const fabricCanvas = useRef<fabric.Canvas | null>(null);
  const babylonEngine = useRef<BABYLON.Engine | null>(null);
  const babylonScene = useRef<BABYLON.Scene | null>(null);
  const shadowGeneratorRef = useRef<BABYLON.ShadowGenerator | null>(null);

  const wallMeshes = useRef<BABYLON.Mesh[]>([]);
  const glbMeshes = useRef<BABYLON.AbstractMesh[]>([]);
  const gizmoManager = useRef<BABYLON.GizmoManager | null>(null);
  
  const [activeMode, setActiveMode] = useState<ToolMode>('select');
  const [viewMode, setViewMode] = useState<ViewMode>('2D');
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [walls, setWalls] = useState<Wall[]>(() => {
    try { 
      const saved = localStorage.getItem('santaplan_walls'); 
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return parsed.map((w: any) => {
        const wall = new Wall(w.startPoint, w.endPoint, w.thickness, w.level);
        wall.id = w.id;
        wall.elements = w.elements || [];
        return wall;
      });
    } catch(e) { return []; }
  });
  const [furniture, setFurniture] = useState<FurnitureElement[]>(() => {
    try { const saved = localStorage.getItem('santaplan_furniture'); return saved ? JSON.parse(saved) : []; } catch(e) { return []; }
  });

  useEffect(() => {
    localStorage.setItem('santaplan_walls', JSON.stringify(walls));
  }, [walls]);

  useEffect(() => {
    localStorage.setItem('santaplan_furniture', JSON.stringify(furniture));
  }, [furniture]);
  
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedObjectType, setSelectedObjectType] = useState<'wall' | 'element' | 'furniture' | null>(null);
  const [editLengthStr, setEditLengthStr] = useState<string>("");

  const [searchTerm, setSearchTerm] = useState('');
  const [capturedPlanImage, setCapturedPlanImage] = useState<string | undefined>();
  const [isFirstPerson, setIsFirstPerson] = useState(false);

  const isDrawingRef = useRef(false);
  const currentLineRef = useRef<fabric.Group | null>(null);

  const snapToGrid = (val: number) => Math.round(val / (GRID_SIZE/5)) * (GRID_SIZE/5);

  const getSnappedPoint = (pointer: {x: number, y: number}, refPoint?: {x: number, y: number}, bypassOrtho?: boolean): {x: number, y: number, isColumnSnap: boolean} => {
    const SNAP_DISTANCE = 30;
    
    // 1. Column Snap
    const activeColumns = furniture.filter(f => f.level === currentLevel && f.type === 'column');
    for (const col of activeColumns) {
      if (Math.hypot(col.position.x - pointer.x, col.position.y - pointer.y) < SNAP_DISTANCE) {
        return { x: col.position.x, y: col.position.y, isColumnSnap: true };
      }
    }

    // 2. Wall Endpoint and Midpoint Snap (Advanced CAD Snapping)
    for (const w of walls.filter(w => w.level === currentLevel)) {
      // Endpoint 1
      if (Math.hypot(w.startPoint.x - pointer.x, w.startPoint.y - pointer.y) < SNAP_DISTANCE) {
         return { x: w.startPoint.x, y: w.startPoint.y, isColumnSnap: true };
      }
      // Endpoint 2
      if (Math.hypot(w.endPoint.x - pointer.x, w.endPoint.y - pointer.y) < SNAP_DISTANCE) {
         return { x: w.endPoint.x, y: w.endPoint.y, isColumnSnap: true };
      }
      // Midpoint
      const midX = (w.startPoint.x + w.endPoint.x) / 2;
      const midY = (w.startPoint.y + w.endPoint.y) / 2;
      if (Math.hypot(midX - pointer.x, midY - pointer.y) < SNAP_DISTANCE) {
         return { x: midX, y: midY, isColumnSnap: true };
      }
    }
    
    // 3. Grid & Ortho Snap
    let rawX = snapToGrid(pointer.x);
    let rawY = snapToGrid(pointer.y);

    if (refPoint && !bypassOrtho) {
        const dx = Math.abs(rawX - refPoint.x);
        const dy = Math.abs(rawY - refPoint.y);
        if (dx > dy) rawY = refPoint.y; else rawX = refPoint.x;
    }
    return { x: rawX, y: rawY, isColumnSnap: false };
  };

  useEffect(() => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    canvas.on('mouse:wheel', function(opt) {
      var delta = opt.e.deltaY;
      var zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.1) zoom = 0.1;
      canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      opt.e.preventDefault(); opt.e.stopPropagation();
    });

    const handleAiRender = () => {
      if (fabricCanvas.current) {
        // Reset zoom and pan to capture the whole plan if needed, or just capture current view.
        // For simplicity, capture current canvas view.
        const dataUrl = fabricCanvas.current.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
        setCapturedPlanImage(dataUrl);
      }
    };
    document.addEventListener('openAiRender', handleAiRender);
    
    return () => {
      document.removeEventListener('openAiRender', handleAiRender);
    };
  }, [activeMode]);

  const drawGrid = (canvas: fabric.Canvas) => {
    canvas.clear();
    canvas.setBackgroundColor('#ffffff', canvas.renderAll.bind(canvas));
    const size = 5000; 
    for (let i = -size; i < size; i+=GRID_SIZE) {
      canvas.add(new fabric.Line([ i, -size, i, size], { stroke: '#e5e7eb', selectable: false, evented: false }));
      canvas.add(new fabric.Line([ -size, i, size, i], { stroke: '#e5e7eb', selectable: false, evented: false }));
    }
  };

  const createWallGraphic = (x1: number, y1: number, x2: number, y2: number, thickness: number, id?: string) => {
    const dx = x2 - x1; const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    
    // Muros estilo SmartDraw (Borde negro, relleno blanco)
    const rect = new fabric.Rect({ width: length, height: thickness || 8, fill: 'white', stroke: 'black', strokeWidth: 2, originX: 'center', originY: 'center' });
    const group = new fabric.Group([rect], {
      left: x1 + dx / 2, top: y1 + dy / 2, angle: angle, originX: 'center', originY: 'center',
      selectable: activeMode === 'select', name: 'wall', data: { id }
    });
    return group;
  };

  // Architectural Auto-Dimensioning
  const drawDimensionLine = (canvas: fabric.Canvas, wall: Wall) => {
    if (!wall || !wall.startPoint || !wall.endPoint) return;
    const dx = wall.endPoint.x - wall.startPoint.x;
    const dy = wall.endPoint.y - wall.startPoint.y;
    const length = Math.sqrt(dx*dx + dy*dy);
    if (length < 10 || isNaN(length)) return;
    const angle = Math.atan2(dy, dx);

    
    // Normal al segmento
    const nx = -Math.sin(angle); const ny = Math.cos(angle);
    
    const offsetDistance = 35;
    const ox1 = wall.startPoint.x + nx * offsetDistance;
    const oy1 = wall.startPoint.y + ny * offsetDistance;
    const ox2 = wall.endPoint.x + nx * offsetDistance;
    const oy2 = wall.endPoint.y + ny * offsetDistance;

    const dimColor = '#71717a'; // Gris oscuro profesional
    const objs = [];

    // Líneas de extensión (desde muro hasta cota)
    objs.push(new fabric.Line([wall.startPoint.x, wall.startPoint.y, ox1 + nx*5, oy1 + ny*5], { stroke: dimColor, strokeWidth: 0.5, selectable: false }));
    objs.push(new fabric.Line([wall.endPoint.x, wall.endPoint.y, ox2 + nx*5, oy2 + ny*5], { stroke: dimColor, strokeWidth: 0.5, selectable: false }));

    // Subdivisiones si hay elementos (puertas/ventanas/garajes)
    if (wall.elements && wall.elements.length > 0) {
        const sortedEls = [...wall.elements].sort((a,b) => a.positionRatio - b.positionRatio);
        let currentRatio = 0;
        let lastPt = { x: ox1, y: oy1 };
        
        sortedEls.forEach(el => {
            const elWidthRatio = (el.width * (PIXELS_PER_METER/100)) / length;
            const startRatio = el.positionRatio - elWidthRatio/2;
            const endRatio = el.positionRatio + elWidthRatio/2;
            
            // Medida antes del elemento
            if (startRatio > currentRatio) {
                const pSX = ox1 + (ox2-ox1)*startRatio; const pSY = oy1 + (oy2-oy1)*startRatio;
                objs.push(new fabric.Line([lastPt.x, lastPt.y, pSX, pSY], { stroke: dimColor, strokeWidth: 0.8, selectable: false }));
                // Tick 
                objs.push(new fabric.Line([pSX - nx*3 - Math.cos(angle)*3, pSY - ny*3 - Math.sin(angle)*3, pSX + nx*3 + Math.cos(angle)*3, pSY + ny*3 + Math.sin(angle)*3], { stroke: dimColor, strokeWidth: 1.5, selectable: false }));
                // Línea de extensión del elemento
                const wx = wall.startPoint.x + dx*startRatio; const wy = wall.startPoint.y + dy*startRatio;
                objs.push(new fabric.Line([wx, wy, pSX + nx*5, pSY + ny*5], { stroke: dimColor, strokeWidth: 0.5, selectable: false }));
                
                const val = (length * (startRatio - currentRatio) / PIXELS_PER_METER).toFixed(2);
                objs.push(new fabric.Text(val, { left: (lastPt.x + pSX)/2, top: (lastPt.y + pSY)/2 - 10, fontSize: 10, fill: dimColor, angle: angle*180/Math.PI, originX: 'center', originY: 'center', selectable: false }));
                lastPt = {x: pSX, y: pSY};
            }
            
            // Medida del elemento
            const pEX = ox1 + (ox2-ox1)*endRatio; const pEY = oy1 + (oy2-oy1)*endRatio;
            objs.push(new fabric.Line([lastPt.x, lastPt.y, pEX, pEY], { stroke: dimColor, strokeWidth: 0.8, selectable: false }));
            // Tick
            objs.push(new fabric.Line([pEX - nx*3 - Math.cos(angle)*3, pEY - ny*3 - Math.sin(angle)*3, pEX + nx*3 + Math.cos(angle)*3, pEY + ny*3 + Math.sin(angle)*3], { stroke: dimColor, strokeWidth: 1.5, selectable: false }));
            // Línea de extensión
            const wx2 = wall.startPoint.x + dx*endRatio; const wy2 = wall.startPoint.y + dy*endRatio;
            objs.push(new fabric.Line([wx2, wy2, pEX + nx*5, pEY + ny*5], { stroke: dimColor, strokeWidth: 0.5, selectable: false }));

            const val = (length * (endRatio - startRatio) / PIXELS_PER_METER).toFixed(2);
            objs.push(new fabric.Text(val, { left: (lastPt.x + pEX)/2, top: (lastPt.y + pEY)/2 - 10, fontSize: 10, fill: dimColor, angle: angle*180/Math.PI, originX: 'center', originY: 'center', selectable: false }));
            
            lastPt = {x: pEX, y: pEY};
            currentRatio = endRatio;
        });

        // Remanente
        if (currentRatio < 1) {
             objs.push(new fabric.Line([lastPt.x, lastPt.y, ox2, oy2], { stroke: dimColor, strokeWidth: 0.8, selectable: false }));
             const val = (length * (1 - currentRatio) / PIXELS_PER_METER).toFixed(2);
             objs.push(new fabric.Text(val, { left: (lastPt.x + ox2)/2, top: (lastPt.y + oy2)/2 - 10, fontSize: 10, fill: dimColor, angle: angle*180/Math.PI, originX: 'center', originY: 'center', selectable: false }));
        }
    } else {
        // Cota principal única
        objs.push(new fabric.Line([ox1, oy1, ox2, oy2], { stroke: dimColor, strokeWidth: 0.8, selectable: false }));
        const val = (length / PIXELS_PER_METER).toFixed(2);
        objs.push(new fabric.Text(val, { left: (ox1+ox2)/2, top: (oy1+oy2)/2 - 10, fontSize: 10, fill: dimColor, angle: angle*180/Math.PI, originX: 'center', originY: 'center', selectable: false }));
    }

    // Ticks exteriores
    objs.push(new fabric.Line([ox1 - nx*3 - Math.cos(angle)*3, oy1 - ny*3 - Math.sin(angle)*3, ox1 + nx*3 + Math.cos(angle)*3, oy1 + ny*3 + Math.sin(angle)*3], { stroke: dimColor, strokeWidth: 1.5, selectable: false }));
    objs.push(new fabric.Line([ox2 - nx*3 - Math.cos(angle)*3, oy2 - ny*3 - Math.sin(angle)*3, ox2 + nx*3 + Math.cos(angle)*3, oy2 + ny*3 + Math.sin(angle)*3], { stroke: dimColor, strokeWidth: 1.5, selectable: false }));

    const grp = new fabric.Group(objs, { selectable: false, evented: false, name: 'dimension' });
    canvas.add(grp);
  };

  const getFurnitureGraphic = (f: FurnitureElement) => {
    if (f.type === 'text') {
      const text = new fabric.Text(f.label || 'HABITACIÓN', {
        fill: '#1a1a1a', fontSize: 18, fontFamily: 'sans-serif', fontWeight: 'bold',
        originX: 'center', originY: 'center'
      });
      return new fabric.Group([text], {
        left: f.position.x, top: f.position.y, angle: f.angle * (180/Math.PI),
        originX: 'center', originY: 'center', selectable: activeMode === 'select', name: 'furniture', data: { id: f.id }
      });
    }

    let svgPath = ''; let scale = 1; let isSolid = false;
    
    if (f.type === 'bed') {
      svgPath = "M 0 0 L 100 0 L 100 120 L 0 120 Z M 10 5 L 45 5 L 45 30 L 10 30 Z M 55 5 L 90 5 L 90 30 L 55 30 Z M 0 45 L 100 45 M 20 45 L 80 45 L 80 115 L 20 115 Z";
      scale = 0.8;
    } else if (f.type === 'toilet') {
      svgPath = "M 0 0 L 40 0 L 40 15 L 0 15 Z M 8 15 C 8 45 32 45 32 15 Z M 15 20 C 15 35 25 35 25 20 Z M 20 0 L 20 4";
      scale = 0.8;
    } else if (f.type === 'plant') {
      svgPath = "M 20 20 C 20 0 0 10 20 20 C 40 10 20 0 20 20 C 20 40 40 30 20 20 C 0 30 20 40 20 20 Z";
      scale = 1.0;
    } else if (f.type === 'sofa') {
      svgPath = "M 0 0 L 120 0 L 120 45 L 0 45 Z M 15 5 L 105 5 L 105 35 L 15 35 Z M 15 5 L 45 5 L 45 35 L 15 35 Z M 45 5 L 75 5 L 75 35 L 45 35 Z M 75 5 L 105 5 L 105 35 L 75 35 Z M 0 5 L 15 5 L 15 45 L 0 45 Z M 105 5 L 120 5 L 120 45 L 105 45 Z";
      scale = 0.8;
    } else if (f.type === 'table') {
      svgPath = "M 20 20 L 80 20 L 80 80 L 20 80 Z M 25 25 L 75 25 L 75 75 L 25 75 Z M 30 0 L 70 0 L 70 15 L 30 15 Z M 30 85 L 70 85 L 70 100 L 30 100 Z M 0 30 L 15 30 L 15 70 L 0 70 Z M 85 30 L 100 30 L 100 70 L 85 70 Z";
      scale = 0.8;
    } else if (f.type === 'chair') {
      svgPath = "M 5 5 L 35 5 L 35 35 L 5 35 Z M 0 0 L 40 0 L 40 10 L 0 10 Z M 10 10 L 30 10 L 30 30 L 10 30 Z";
      scale = 0.9;
    } else if (f.type === 'stairs') {
      svgPath = "M 0 0 L 40 0 L 40 120 L 0 120 Z M 0 20 L 40 20 M 0 40 L 40 40 M 0 60 L 40 60 M 0 80 L 40 80 M 0 100 L 40 100 M 20 10 L 20 110 M 15 15 L 20 5 L 25 15";
      scale = 0.9;
    } else if (f.type === 'column') {
      svgPath = "M 0 0 L 20 0 L 20 20 L 0 20 Z M 0 0 L 20 20 M 20 0 L 0 20";
      scale = 1.0; isSolid = true; 
    } else if (f.type === 'car') {
      svgPath = "M 15 5 C 25 0, 45 0, 55 5 L 65 25 L 65 115 C 55 120, 15 120, 5 115 L 5 25 Z M 12 35 C 25 25, 45 25, 58 35 L 55 60 L 15 60 Z M 15 90 C 25 100, 45 100, 55 90 L 52 70 L 18 70 Z M -2 20 L 5 20 L 5 45 L -2 45 Z M 65 20 L 72 20 L 72 45 L 65 45 Z M -2 80 L 5 80 L 5 105 L -2 105 Z M 65 80 L 72 80 L 72 105 L 65 105 Z M 20 10 L 50 10 M 20 110 L 50 110";
      scale = 1.0;
    } else if (f.type === 'dining') {
      svgPath = "M 20 0 L 140 0 L 140 60 L 20 60 Z M 35 -15 L 60 -15 L 60 -5 L 35 -5 Z M 70 -15 L 95 -15 L 95 -5 L 70 -5 Z M 105 -15 L 130 -15 L 130 -5 L 105 -5 Z M 35 65 L 60 65 L 60 75 L 35 75 Z M 70 65 L 95 65 L 95 75 L 70 75 Z M 105 65 L 130 65 L 130 75 L 105 75 Z M 5 15 L 15 15 L 15 45 L 5 45 Z M 145 15 L 155 15 L 155 45 L 145 45 Z";
      scale = 0.8;
    } else if (f.type === 'tv') {
      svgPath = "M 0 0 L 100 0 L 100 10 L 0 10 Z";
      scale = 0.8;
    } else if (f.type === 'lamp') {
      svgPath = "M 20 0 C 40 0 40 40 20 40 C 0 40 0 0 20 0 Z M 20 10 L 20 30 M 10 20 L 30 20";
      scale = 0.8;
    } else if (f.type === 'shower') {
      svgPath = "M 0 0 L 80 0 L 80 80 L 0 80 Z M 0 0 L 80 80 M 80 0 L 0 80 M 35 35 L 45 35 L 45 45 L 35 45 Z";
      scale = 0.8;
    } else if (f.type === 'bathtub') {
      svgPath = "M 0 0 L 160 0 L 160 70 L 0 70 Z M 10 10 C 10 0 150 0 150 10 L 150 60 C 150 70 10 70 10 60 Z M 20 35 C 25 35 25 45 20 45 C 15 45 15 35 20 35 Z";
      scale = 0.8;
    } else if (f.type === 'socket') {
      svgPath = "M 0 0 L 20 0 L 20 20 L 0 20 Z M 10 20 L 10 40";
      scale = 0.6;
    } else if (f.type === 'tree') {
      svgPath = "M 40 10 C 60 -10, 80 10, 70 30 C 90 40, 80 70, 60 70 C 50 90, 30 90, 20 70 C 0 70, -10 40, 10 30 C 0 10, 20 -10, 40 10 Z";
      scale = 1.0;
    } else if (f.type === 'kitchen') {
      svgPath = "M 0 0 L 120 0 L 120 60 L 0 60 Z M 10 10 C 25 10 25 25 10 25 C -5 25 -5 10 10 10 Z M 35 10 C 50 10 50 25 35 25 C 20 25 20 10 35 10 Z M 10 35 C 25 35 25 50 10 50 C -5 50 -5 35 10 35 Z M 35 35 C 50 35 50 50 35 50 C 20 50 20 35 35 35 Z M 70 10 L 110 10 L 110 50 L 70 50 Z M 90 20 C 95 20 95 25 90 25 C 85 25 85 20 90 20 Z";
      scale = 0.8;
    }

    const path = new fabric.Path(svgPath, { fill: isSolid ? 'black' : 'transparent', stroke: 'black', strokeWidth: 2, scaleX: scale, scaleY: scale });
    const bg = new fabric.Rect({ left: path.left, top: path.top, width: path.width, height: path.height, fill: 'white', scaleX: scale, scaleY: scale });
    const grp = new fabric.Group([bg, path], { left: f.position.x, top: f.position.y, angle: f.angle * (180/Math.PI), originX: 'center', originY: 'center', selectable: activeMode === 'select', name: 'furniture', data: { id: f.id } });
    return grp;
  };

  const renderWalls2D = useCallback(() => {
    if (!fabricCanvas.current) return;
    const canvas = fabricCanvas.current;
    
    canvas.getObjects().forEach(obj => {
      if (['wall', 'wall-text', 'door', 'window', 'garage', 'furniture', 'stairs', 'element', 'wall-handle', 'dimension'].includes(obj.name || '')) canvas.remove(obj);
    });

    walls.filter(w => w.level === currentLevel).forEach(wall => {
      const group = createWallGraphic(wall.startPoint.x, wall.startPoint.y, wall.endPoint.x, wall.endPoint.y, wall.thickness, wall.id);
      group.selectable = activeMode === 'select';
      
      if(selectedObjectId === wall.id) { 
        group.item(0).set('stroke', '#f59e0b');
        const h1 = new fabric.Circle({ left: wall.startPoint.x, top: wall.startPoint.y, radius: 8, fill: '#f59e0b', stroke: 'black', strokeWidth: 2, originX: 'center', originY: 'center', hasControls: false, hasBorders: false, hoverCursor: 'pointer', name: 'wall-handle', data: { wallId: wall.id, type: 'start' } });
        const h2 = new fabric.Circle({ left: wall.endPoint.x, top: wall.endPoint.y, radius: 8, fill: '#f59e0b', stroke: 'black', strokeWidth: 2, originX: 'center', originY: 'center', hasControls: false, hasBorders: false, hoverCursor: 'pointer', name: 'wall-handle', data: { wallId: wall.id, type: 'end' } });
        canvas.add(h1, h2);
      }
      canvas.add(group);
      
      // Dibujar Cotas Automáticas (Architectural Dimensions)
      drawDimensionLine(canvas, wall);

      wall.elements.forEach(el => {
        const ex = wall.startPoint.x + (wall.endPoint.x - wall.startPoint.x) * el.positionRatio;
        const ey = wall.startPoint.y + (wall.endPoint.y - wall.startPoint.y) * el.positionRatio;
        let elGrp;
        if (el.type === 'door') {
          // Arco arquitectónico para puerta a 90 grados
          const dPath = new fabric.Path("M -20 0 L -20 -40 A 40 40 0 0 1 20 0 Z", { fill: 'transparent', stroke: 'black', strokeWidth: 1.5 });
          elGrp = new fabric.Group([dPath], { left: ex, top: ey, originX: 'center', originY: 'center', angle: (wall.angleRad * 180) / Math.PI });
        } else if (el.type === 'garage') {
          const dPath = new fabric.Path(`M -40 0 L 40 0 L 40 10 L -40 10 Z M -30 0 L -30 10 M -10 0 L -10 10 M 10 0 L 10 10 M 30 0 L 30 10`, { fill: 'white', stroke: 'black', strokeWidth: 1.0 });
          elGrp = new fabric.Group([dPath], { left: ex, top: ey, originX: 'center', originY: 'center', angle: (wall.angleRad * 180) / Math.PI });
        } else {
          const rect1 = new fabric.Rect({ width: el.width * (GRID_SIZE/100), height: 4, fill: 'white', stroke: 'black', strokeWidth: 1 });
          const rect2 = new fabric.Rect({ width: el.width * (GRID_SIZE/100), height: 2, fill: 'black' });
          elGrp = new fabric.Group([rect1, rect2], { left: ex, top: ey, originX: 'center', originY: 'center', angle: (wall.angleRad * 180) / Math.PI });
        }
        elGrp.set({ selectable: activeMode === 'select', name: 'element', data: { id: el.id, wallId: wall.id } });
        canvas.add(elGrp);
      });
    });

    const furns = furniture.filter(f => f.level === currentLevel);
    furns.filter(f => f.type !== 'column').forEach(f => {
      const grp = getFurnitureGraphic(f);
      if(selectedObjectId === f.id) {
        if(grp.item(1)) grp.item(1).set('stroke', '#f59e0b');
        else grp.item(0).set('fill', '#f59e0b'); 
      }
      canvas.add(grp);
    });
    furns.filter(f => f.type === 'column').forEach(f => {
      const grp = getFurnitureGraphic(f);
      if(selectedObjectId === f.id) grp.item(1).set('stroke', '#f59e0b');
      canvas.add(grp);
    });
    canvas.renderAll();
  }, [walls, furniture, activeMode, currentLevel, selectedObjectId]);

  useEffect(() => {
    if (viewMode !== '2D') return;
    if (canvasRef.current && !fabricCanvas.current) {
      const parent = canvasRef.current.parentElement;
      const width = parent?.clientWidth || window.innerWidth;
      const height = parent?.clientHeight || window.innerHeight;
      fabricCanvas.current = new fabric.Canvas(canvasRef.current, { width, height, selection: false, preserveObjectStacking: true });
      drawGrid(fabricCanvas.current);
      fabricCanvas.current.absolutePan(new fabric.Point(-width/2, -height/2));
    }
    const canvas = fabricCanvas.current;
    if (!canvas) return;

    ['mouse:down', 'mouse:move', 'mouse:up', 'object:modified', 'selection:created', 'selection:cleared'].forEach(e => canvas.off(e));

    let draggingHandle: { wallId: string, type: 'start' | 'end' } | null = null;
    let isCameraDragging = false;
    let lastPosX = 0; let lastPosY = 0;

    if (activeMode === 'select') {
      canvas.selection = true;
      canvas.on('mouse:down', (e) => {
        const evt = e.e as MouseEvent;
        if (evt.altKey || evt.button === 1) { 
          isCameraDragging = true; canvas.selection = false;
          lastPosX = evt.clientX; lastPosY = evt.clientY; return;
        }
        if(e.target && e.target.name === 'wall-handle') {
          draggingHandle = { wallId: e.target.data.wallId, type: e.target.data.type };
          canvas.selection = false;
        } else if (e.target) {
          setSelectedObjectId(e.target.data.id); setSelectedObjectType(e.target.name as any);
        } else {
          setSelectedObjectId(null); setSelectedObjectType(null);
        }
      });

      canvas.on('mouse:move', (e) => {
        if (isCameraDragging) {
          const evt = e.e as MouseEvent;
          const vpt = canvas.viewportTransform!;
          vpt[4] += evt.clientX - lastPosX; vpt[5] += evt.clientY - lastPosY;
          canvas.requestRenderAll(); lastPosX = evt.clientX; lastPosY = evt.clientY; return;
        }
        if (draggingHandle) {
          const pointer = canvas.getPointer(e.e);
          const w = walls.find(w => w.id === draggingHandle!.wallId);
          if (w) {
            const refPoint = draggingHandle!.type === 'start' ? w.endPoint : w.startPoint;
            const bypass = (e.e as MouseEvent).shiftKey;
            const snapped = getSnappedPoint(pointer, refPoint, bypass);
            
            const sx = draggingHandle.type === 'start' ? snapped.x : w.startPoint.x;
            const sy = draggingHandle.type === 'start' ? snapped.y : w.startPoint.y;
            const ex = draggingHandle.type === 'end' ? snapped.x : w.endPoint.x;
            const ey = draggingHandle.type === 'end' ? snapped.y : w.endPoint.y;
            
            const dx = ex - sx; const dy = ey - sy;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

            const wallGrp = canvas.getObjects().find(o => o.name === 'wall' && o.data?.id === w.id) as fabric.Group;
            if (wallGrp) {
                wallGrp.set({ left: sx + dx / 2, top: sy + dy / 2, angle: angle });
                (wallGrp.item(0) as fabric.Rect).set({ width: length });
                wallGrp.addWithUpdate();
            }
            if (e.target) e.target.set({ left: snapped.x, top: snapped.y });
            
            canvas.renderAll();
          }
        }
      });

      canvas.on('mouse:up', (e) => {
        if (isCameraDragging) {
          canvas.setViewportTransform(canvas.viewportTransform!);
          isCameraDragging = false; canvas.selection = true; return;
        }
        if (draggingHandle) {
          const pointer = canvas.getPointer(e.e);
          const w = walls.find(w => w.id === draggingHandle!.wallId);
          const refPoint = w ? (draggingHandle!.type === 'start' ? w.endPoint : w.startPoint) : undefined;
          const bypass = (e.e as MouseEvent).shiftKey;
          const snapped = getSnappedPoint(pointer, refPoint, bypass);
          
          setWalls(prev => prev.map(w => {
            if (w.id === draggingHandle!.wallId) {
                const sx = draggingHandle!.type === 'start' ? snapped.x : w.startPoint.x;
                const sy = draggingHandle!.type === 'start' ? snapped.y : w.startPoint.y;
                const ex = draggingHandle!.type === 'end' ? snapped.x : w.endPoint.x;
                const ey = draggingHandle!.type === 'end' ? snapped.y : w.endPoint.y;
                const updated = new Wall({x: sx, y: sy}, {x: ex, y: ey}, w.thickness, w.level);
                updated.id = w.id; updated.elements = w.elements;
                return updated;
            }
            return w;
          }));
          draggingHandle = null; canvas.selection = true;
        }
      });

      canvas.on('object:modified', (e) => {
        if (e.target && e.target.name === 'furniture') {
          const id = e.target.data.id;
          setFurniture(prev => prev.map(f => f.id === id ? { ...f, position: { x: e.target!.left || 0, y: e.target!.top || 0 }, angle: (e.target!.angle || 0) * (Math.PI/180) } : f));
        }
      });
    } else {
      canvas.selection = false; canvas.discardActiveObject(); setSelectedObjectId(null);
    }

    let drawStartX = 0; let drawStartY = 0;
    if (activeMode === 'draw') {
      canvas.on('mouse:down', (options) => {
        const evt = options.e as MouseEvent;
        if (evt.altKey || evt.button === 1) { 
          isCameraDragging = true; lastPosX = evt.clientX; lastPosY = evt.clientY; return;
        }
        const pointer = canvas.getPointer(options.e);
        const snapped = getSnappedPoint(pointer);
        drawStartX = snapped.x; drawStartY = snapped.y;
        
        currentLineRef.current = createWallGraphic(drawStartX, drawStartY, drawStartX, drawStartY, 15);
        canvas.add(currentLineRef.current);
        isDrawingRef.current = true;
      });

      canvas.on('mouse:move', (options) => {
        if (isCameraDragging) {
          const evt = options.e as MouseEvent;
          const vpt = canvas.viewportTransform!;
          vpt[4] += evt.clientX - lastPosX; vpt[5] += evt.clientY - lastPosY;
          canvas.requestRenderAll(); lastPosX = evt.clientX; lastPosY = evt.clientY; return;
        }
        if (!isDrawingRef.current || !currentLineRef.current) return;
        const pointer = canvas.getPointer(options.e);
        const bypass = (options.e as MouseEvent).shiftKey;
        const snapped = getSnappedPoint(pointer, {x: drawStartX, y: drawStartY}, bypass);
        
        canvas.remove(currentLineRef.current);
        
        // Remover la cota temporal anterior
        const tempDims = canvas.getObjects().filter(o => o.name === 'temp-dimension');
        tempDims.forEach(o => canvas.remove(o));

        currentLineRef.current = createWallGraphic(drawStartX, drawStartY, snapped.x, snapped.y, 15);
        canvas.add(currentLineRef.current);

        // Cota temporal dinámica profesional
        const dx = snapped.x - drawStartX; const dy = snapped.y - drawStartY;
        const lenM = (Math.sqrt(dx*dx + dy*dy) / PIXELS_PER_METER).toFixed(2);
        const angle = Math.atan2(dy, dx);
        
        if (Math.sqrt(dx*dx + dy*dy) > 10) {
            const tempText = new fabric.Text(`${lenM}m`, {
                left: drawStartX + dx/2,
                top: drawStartY + dy/2 - 15,
                fontSize: 12,
                fill: '#f59e0b',
                fontWeight: 'bold',
                fontFamily: 'sans-serif',
                originX: 'center',
                originY: 'center',
                angle: angle * 180 / Math.PI,
                name: 'temp-dimension',
                selectable: false
            });
            canvas.add(tempText);
        }

        canvas.renderAll();
      });

      canvas.on('mouse:up', (options) => {
        if (isCameraDragging) { canvas.setViewportTransform(canvas.viewportTransform!); isCameraDragging = false; return; }
        if (isDrawingRef.current && currentLineRef.current) {
          const pointer = canvas.getPointer(options.e);
          const bypass = (options.e as MouseEvent).shiftKey;
          const snapped = getSnappedPoint(pointer, {x: drawStartX, y: drawStartY}, bypass);
          const newWall = new Wall({ x: drawStartX, y: drawStartY }, { x: snapped.x, y: snapped.y }, 15, currentLevel);
          if (newWall.lengthPx > GRID_SIZE / 2) setWalls(prev => [...prev, newWall]);
          
          canvas.remove(currentLineRef.current);
          const tempDims = canvas.getObjects().filter(o => o.name === 'temp-dimension');
          tempDims.forEach(o => canvas.remove(o));
        }
        isDrawingRef.current = false; currentLineRef.current = null;
      });
    }

    if (['door', 'window', 'garage'].includes(activeMode)) {
      canvas.on('mouse:down', (options) => {
        const evt = options.e as MouseEvent;
        if (evt.altKey || evt.button === 1) { 
          isCameraDragging = true; lastPosX = evt.clientX; lastPosY = evt.clientY; return;
        }
        if (options.target && options.target.name === 'wall') {
          const wallId = options.target.data.id;
          const pointer = canvas.getPointer(options.e);
          setWalls(prevWalls => prevWalls.map(w => {
            if (w.id === wallId) {
              const dx = w.endPoint.x - w.startPoint.x; const dy = w.endPoint.y - w.startPoint.y;
              const lenSq = dx*dx + dy*dy;
              let t = ((pointer.x - w.startPoint.x) * dx + (pointer.y - w.startPoint.y) * dy) / lenSq;
              t = Math.max(0.1, Math.min(0.9, t)); 
              
              let wSize = 120, hSize = 120, elev = 90;
              if (activeMode === 'door') { wSize = 90; hSize = 210; elev = 0; }
              if (activeMode === 'garage') { wSize = 250; hSize = 220; elev = 0; }

              const newEl: WallElement = {
                id: 'el-' + Date.now(), type: activeMode as ElementType, positionRatio: t,
                width: wSize, height: hSize, elevation: elev
              };
              const updatedWall = new Wall(w.startPoint, w.endPoint, w.thickness, w.level);
              updatedWall.id = w.id; updatedWall.elements = [...w.elements, newEl];
              return updatedWall;
            }
            return w;
          }));
          setActiveMode('select');
        }
      });
      canvas.on('mouse:move', (options) => {
        if (isCameraDragging) {
          const evt = options.e as MouseEvent;
          const vpt = canvas.viewportTransform!;
          vpt[4] += evt.clientX - lastPosX; vpt[5] += evt.clientY - lastPosY;
          canvas.requestRenderAll(); lastPosX = evt.clientX; lastPosY = evt.clientY; return;
        }
      });
      canvas.on('mouse:up', () => { isCameraDragging = false; canvas.setViewportTransform(canvas.viewportTransform!); });
    }

    const furnitureModes = ['toilet', 'sofa', 'bed', 'plant', 'tree', 'stairs', 'column', 'table', 'chair', 'text', 'car', 'dining', 'kitchen', 'tv', 'socket', 'lamp', 'shower', 'bathtub'];
    if (furnitureModes.includes(activeMode)) {
      canvas.on('mouse:down', (options) => {
        const evt = options.e as MouseEvent;
        if (evt.altKey || evt.button === 1) { 
          isCameraDragging = true; lastPosX = evt.clientX; lastPosY = evt.clientY; return;
        }
        const pointer = canvas.getPointer(options.e);
        const sx = snapToGrid(pointer.x); const sy = snapToGrid(pointer.y);
        const newFurn: FurnitureElement = { id: 'furn-' + Date.now(), type: activeMode as FurnitureType, position: { x: sx, y: sy }, angle: 0, level: currentLevel, label: activeMode === 'text' ? 'HABITACIÓN' : undefined };
        setFurniture(prev => [...prev, newFurn]);
        setActiveMode('select');
      });
      canvas.on('mouse:move', (options) => {
        if (isCameraDragging) {
          const evt = options.e as MouseEvent;
          const vpt = canvas.viewportTransform!;
          vpt[4] += evt.clientX - lastPosX; vpt[5] += evt.clientY - lastPosY;
          canvas.requestRenderAll(); lastPosX = evt.clientX; lastPosY = evt.clientY; return;
        }
      });
      canvas.on('mouse:up', () => { isCameraDragging = false; canvas.setViewportTransform(canvas.viewportTransform!); });
    }
    renderWalls2D();
  }, [activeMode, viewMode, currentLevel, selectedObjectId, furniture, renderWalls2D]);

  // ==========================================
  // BABYLON 3D PBR RENDER ENGINE (FOTOREALISTA)
  // ==========================================
  useEffect(() => {
    if (viewMode !== '3D') return;

    let engine = babylonEngine.current;
    if (!engine && engine3dRef.current) {
      engine = new BABYLON.Engine(engine3dRef.current, true, { preserveDrawingBuffer: true, stencil: true });
      babylonEngine.current = engine;
      
      const scene = new BABYLON.Scene(engine);
      scene.clearColor = new BABYLON.Color4(0.9, 0.9, 0.92, 1);
      babylonScene.current = scene;

      const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 3.5, 20, BABYLON.Vector3.Zero(), scene);
      camera.attachControl(engine3dRef.current, true);
      camera.wheelPrecision = 20;
      camera.lowerRadiusLimit = 1; // Permitir zoom extremo
      camera.upperRadiusLimit = 100;
      camera.panningSensibility = 500;

      // VR / First Person Camera
      const fpCamera = new BABYLON.UniversalCamera("fpCamera", new BABYLON.Vector3(0, 1.6, 0), scene);
      fpCamera.speed = 0.15;
      fpCamera.angularSensibility = 3000;
      fpCamera.applyGravity = true;
      fpCamera.checkCollisions = true;
      fpCamera.ellipsoid = new BABYLON.Vector3(0.4, 0.8, 0.4); // Collider (ancho, alto de jugador)
      
      // Control de teclado para caminar (W, A, S, D)
      fpCamera.keysUp = [87]; // W
      fpCamera.keysDown = [83]; // S
      fpCamera.keysLeft = [65]; // A
      fpCamera.keysRight = [68]; // D

      // ==========================================
      // ILUMINACIÓN PROFESIONAL Y HDRI
      // ==========================================
      scene.clearColor = new BABYLON.Color4(0.95, 0.95, 0.96, 1);
      
      // HDRI Realista de exterior (Cielo claro)
      const hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData("https://playground.babylonjs.com/textures/country.env", scene);
      scene.environmentTexture = hdrTexture;
      
      // Skybox visual (con el mismo HDRI)
      const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", {size:1000.0}, scene);
      const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
      skyboxMaterial.backFaceCulling = false;
      skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://playground.babylonjs.com/textures/skybox", scene);
      skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
      skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
      skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
      skybox.material = skyboxMaterial;

      // Luz principal simulando el sol (Sombras nítidas pero suaves)
      const dirLight = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.5, -1.2, -0.8), scene);
      dirLight.position = new BABYLON.Vector3(20, 50, 20);
      dirLight.intensity = 2.5; // El sol es fuerte, el HDRI rellena las sombras
      
      // Luz de relleno para aclarar interiores
      const hemiLight = new BABYLON.HemisphericLight("hemiLight", new BABYLON.Vector3(0, 1, 0), scene);
      hemiLight.intensity = 0.4;
      hemiLight.diffuse = new BABYLON.Color3(1, 1, 1);
      hemiLight.groundColor = new BABYLON.Color3(0.8, 0.8, 0.8);

      // Sombras de alta calidad (Cascaded Shadow Maps para exteriores)
      const shadowGenerator = new BABYLON.ShadowGenerator(2048, dirLight);
      shadowGenerator.useBlurExponentialShadowMap = true;
      shadowGenerator.useKernelBlur = true;
      shadowGenerator.blurKernel = 64;
      shadowGenerator.setDarkness(0.15); // Sombras arquitectónicas claras
      shadowGeneratorRef.current = shadowGenerator;

      // ==========================================
      // POST-PROCESAMIENTO ARQUITECTÓNICO
      // ==========================================
      const pipeline = new BABYLON.DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
      pipeline.samples = 8; // Máximo antialiasing
      pipeline.fxaaEnabled = true;
      
      // Tono fotográfico (Tone Mapping)
      pipeline.imageProcessingEnabled = true;
      pipeline.imageProcessing.toneMappingEnabled = true;
      pipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
      pipeline.imageProcessing.exposure = 1.2;
      pipeline.imageProcessing.contrast = 1.05;

      // Oclusión ambiental (SSAO) para esquinas y contacto de muebles
      const ssao = new BABYLON.SSAO2RenderingPipeline("ssao", scene, 1.0, [camera]);
      ssao.radius = 1.5;
      ssao.totalStrength = 1.5;
      ssao.base = 0.2;
      
      const manager = new BABYLON.GizmoManager(scene);
      manager.positionGizmoEnabled = true;
      manager.rotationGizmoEnabled = true;
      manager.boundingBoxGizmoEnabled = false;
      manager.usePointerToAttachGizmos = false;
      manager.clearGizmoOnEmptyPointerEvent = true;
      gizmoManager.current = manager;

      const syncMeshToState = (attachedMesh: BABYLON.AbstractMesh) => {
          if (!attachedMesh || !attachedMesh.name.startsWith("f_")) return;
          const id = attachedMesh.name.substring(2);
          setFurniture(prev => prev.map(f => {
              if (f.id === id) {
                  return {
                      ...f,
                      position: { x: attachedMesh.position.x * PIXELS_PER_METER, y: -attachedMesh.position.z * PIXELS_PER_METER },
                      angle: -attachedMesh.rotation.y
                  };
              }
              return f;
          }));
      };

      if (manager.gizmos.positionGizmo) manager.gizmos.positionGizmo.onDragEndObservable.add(() => { if(manager.attachedMesh) syncMeshToState(manager.attachedMesh); });
      if (manager.gizmos.rotationGizmo) manager.gizmos.rotationGizmo.onDragEndObservable.add(() => { if(manager.attachedMesh) syncMeshToState(manager.attachedMesh); });

      scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
            if (pointerInfo.pickInfo?.hit && pointerInfo.pickInfo.pickedMesh) {
                let mesh: BABYLON.Node | null = pointerInfo.pickInfo.pickedMesh;
                // Subir en la jerarquía hasta encontrar el nodo raíz del mueble
                while (mesh && mesh.parent && mesh.name !== "skyBox" && !mesh.name.startsWith("f_")) {
                    mesh = mesh.parent;
                }
                if (mesh && mesh.name.startsWith("f_")) {
                    manager.attachToMesh(mesh as BABYLON.AbstractMesh);
                } else if (!mesh || (mesh.name !== "skyBox" && !mesh.name.startsWith("wall") && mesh.name !== "ground")) {
                    manager.attachToMesh(null);
                }
            } else {
                manager.attachToMesh(null);
            }
        }
      });

      // Habilitar gravedad y colisiones para realidad virtual / primera persona
      scene.gravity = new BABYLON.Vector3(0, -0.9, 0);
      scene.collisionsEnabled = true;
      camera.checkCollisions = true;

      engine.runRenderLoop(() => { scene.render(); });
      window.addEventListener('resize', () => engine?.resize());
    }

    const scene = babylonScene.current;
    const shadowGen = shadowGeneratorRef.current;
    if(!scene || !shadowGen) return;
    
    wallMeshes.current.forEach(mesh => mesh.dispose()); wallMeshes.current = [];
    glbMeshes.current.forEach(mesh => mesh.dispose()); glbMeshes.current = [];
    if (gizmoManager.current) gizmoManager.current.attachableMeshes = [];

    // Cambiar cámara si estamos en primera persona
    const fpCam = scene.getCameraByName("fpCamera") as BABYLON.UniversalCamera;
    const arcCam = scene.getCameraByName("camera") as BABYLON.ArcRotateCamera;
    if (fpCam && arcCam && engine3dRef.current) {
        if (isFirstPerson) {
            scene.activeCamera = fpCam;
            arcCam.detachControl();
            fpCam.attachControl(engine3dRef.current, true);
            // Iniciar en el centro del plano
            fpCam.position = new BABYLON.Vector3(arcCam.target.x, 1.6, arcCam.target.z);
        } else {
            scene.activeCamera = arcCam;
            fpCam.detachControl();
            arcCam.attachControl(engine3dRef.current, true);
        }
    }

    // MATERIALES PBR FOTOREALISTAS
    const wallMaterial = new BABYLON.PBRMaterial("wallMat", scene);
    wallMaterial.albedoColor = new BABYLON.Color3(0.95, 0.95, 0.95); // Blanco puro y limpio
    wallMaterial.roughness = 0.95; // Pintura mate, sin brillos plásticos
    wallMaterial.metallic = 0.0;
    // Opcional: Bump de yeso para paredes
    // wallMaterial.bumpTexture = new BABYLON.Texture("https://playground.babylonjs.com/textures/floor_bump.png", scene);

    const blackFrameMat = new BABYLON.PBRMaterial("blackFrame", scene);
    blackFrameMat.albedoColor = new BABYLON.Color3(0.15, 0.15, 0.15);
    blackFrameMat.roughness = 0.6;
    blackFrameMat.metallic = 0.4;

    const whiteFrameMat = new BABYLON.PBRMaterial("whiteFrame", scene);
    whiteFrameMat.albedoColor = new BABYLON.Color3(0.9, 0.9, 0.9); 
    whiteFrameMat.roughness = 0.3;
    whiteFrameMat.metallic = 0.1;
    
    const glassMat = new BABYLON.PBRMaterial("glassMat", scene);
    glassMat.albedoColor = new BABYLON.Color3(0.9, 0.95, 1.0);
    glassMat.roughness = 0.01;
    glassMat.metallic = 0.0;
    glassMat.alpha = 0.2;
    glassMat.indexOfRefraction = 1.5;
    glassMat.environmentIntensity = 1.0; // Reflejos fuertes del HDRI

    const metalGarageMat = new BABYLON.PBRMaterial("metalGarage", scene);
    metalGarageMat.albedoColor = new BABYLON.Color3(0.6, 0.6, 0.62);
    metalGarageMat.roughness = 0.4;
    metalGarageMat.metallic = 0.8;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    walls.forEach(w => {
      minX = Math.min(minX, w.startPoint.x, w.endPoint.x); maxX = Math.max(maxX, w.startPoint.x, w.endPoint.x);
      minY = Math.min(minY, w.startPoint.y, w.endPoint.y); maxY = Math.max(maxY, w.startPoint.y, w.endPoint.y);
    });
    const centerX = isFinite(minX) ? (minX + maxX) / 2 : 0;
    const centerY = isFinite(minY) ? (minY + maxY) / 2 : 0;
    const cxMeters = centerX / PIXELS_PER_METER;
    const czMeters = -centerY / PIXELS_PER_METER;
    
    const bbWidthM = isFinite(maxX) ? (maxX - minX + 20) / PIXELS_PER_METER : 20;
    const bbHeightM = isFinite(maxY) ? (maxY - minY + 20) / PIXELS_PER_METER : 20;

    if(scene.activeCamera) (scene.activeCamera as BABYLON.ArcRotateCamera).setTarget(new BABYLON.Vector3(cxMeters, 0, czMeters));
    
    // Suelo delimitado estilo maqueta con PBR
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: bbWidthM, height: bbHeightM }, scene);
    ground.position.x = cxMeters; ground.position.z = czMeters;
    ground.receiveShadows = true; 
    ground.checkCollisions = true; // Para la cámara en 1ra persona
    
    const groundMat = new BABYLON.PBRMaterial("groundMat", scene);
    groundMat.albedoColor = new BABYLON.Color3(0.85, 0.85, 0.86); // Gris claro arquitectónico
    groundMat.roughness = 0.3; // Ligeramente pulido para reflejar la luz del sol
    groundMat.metallic = 0.05;
    
    ground.material = groundMat;
    wallMeshes.current.push(ground);

    walls.forEach((wall) => {
      const dx = wall.endPoint.x - wall.startPoint.x; const dy = wall.endPoint.y - wall.startPoint.y;
      const lengthPx = Math.sqrt(dx * dx + dy * dy);
      const lengthM = lengthPx / PIXELS_PER_METER;
      const angle = Math.atan2(dy, dx);
      const wx = wall.startPoint.x + dx / 2; const wy = wall.startPoint.y + dy / 2;
      const levelBaseY = (wall.level - 1) * FLOOR_HEIGHT_M;

      let wallMesh = BABYLON.MeshBuilder.CreateBox(`wall_${wall.id}`, { width: lengthM, height: FLOOR_HEIGHT_M, depth: 0.15 }, scene);

      if (wall.elements.length > 0) {
        let wallCSG = BABYLON.CSG.FromMesh(wallMesh);
        wall.elements.forEach(el => {
          const wM = el.width / 100; const hM = el.height / 100; const eleM = el.elevation / 100;
          const relativeX = (el.positionRatio - 0.5) * lengthM;
          const relativeY = (hM / 2) + eleM - (FLOOR_HEIGHT_M / 2);

          const holeMesh = BABYLON.MeshBuilder.CreateBox("hole", { width: wM, height: hM, depth: 0.3 }, scene);
          holeMesh.position.x = relativeX; holeMesh.position.y = relativeY; 
          const holeCSG = BABYLON.CSG.FromMesh(holeMesh);
          wallCSG = wallCSG.subtract(holeCSG);
          holeMesh.dispose();

          const absX = (wx / PIXELS_PER_METER) + relativeX * Math.cos(-angle);
          const absZ = (-wy / PIXELS_PER_METER) - relativeX * Math.sin(-angle);
          const absY = (FLOOR_HEIGHT_M / 2) + levelBaseY + relativeY;

          if (el.type === 'garage') {
             // Puerta de Garaje PBR
             const garageDoor = BABYLON.MeshBuilder.CreateBox(`garage_${el.id}`, { width: wM, height: hM, depth: 0.1 }, scene);
             garageDoor.material = metalGarageMat;
             garageDoor.position.set(absX, absY, absZ);
             garageDoor.rotation.y = -angle;
             shadowGen.addShadowCaster(garageDoor); garageDoor.receiveShadows = true;
             wallMeshes.current.push(garageDoor);
          } else {
             const isDoor = el.type === 'door';
             const frameThickness = 0.05;
             const frameMesh = BABYLON.MeshBuilder.CreateBox(`frame_${el.id}`, { width: wM, height: hM, depth: 0.18 }, scene);
             const innerHole = BABYLON.MeshBuilder.CreateBox("innerHole", { width: wM - frameThickness*2, height: hM - (isDoor? frameThickness : frameThickness*2), depth: 0.2 }, scene);
             if (isDoor) innerHole.position.y = -frameThickness/2;
             
             const fCSG = BABYLON.CSG.FromMesh(frameMesh);
             const iCSG = BABYLON.CSG.FromMesh(innerHole);
             const finalFrameCSG = fCSG.subtract(iCSG);
             
             const finalFrame = finalFrameCSG.toMesh(`finalFrame_${el.id}`, isDoor ? whiteFrameMat : blackFrameMat, scene);
             frameMesh.dispose(); innerHole.dispose();
             
             finalFrame.position.set(absX, absY, absZ);
             finalFrame.rotation.y = -angle;
             shadowGen.addShadowCaster(finalFrame);
             wallMeshes.current.push(finalFrame);
   
             const panel = BABYLON.MeshBuilder.CreateBox(`panel_${el.id}`, { width: wM - frameThickness*2, height: hM - (isDoor? frameThickness : frameThickness*2), depth: 0.04 }, scene);
             panel.material = isDoor ? whiteFrameMat : glassMat;
             panel.position.set(absX, absY + (isDoor ? -frameThickness/2 : 0), absZ);
             panel.rotation.y = -angle;
             if (isDoor) shadowGen.addShadowCaster(panel);
             wallMeshes.current.push(panel);
          }
        });

        const newWallMesh = wallCSG.toMesh(`wall_csg_${wall.id}`, wallMaterial, scene, true);
        wallMesh.dispose(); 
        wallMesh = newWallMesh;
      } else {
        wallMesh.material = wallMaterial;
      }

      wallMesh.position.x = wx / PIXELS_PER_METER;
      wallMesh.position.z = -wy / PIXELS_PER_METER;
      wallMesh.position.y = (FLOOR_HEIGHT_M / 2) + levelBaseY;
      wallMesh.rotation.y = -angle; 
      wallMesh.receiveShadows = true;
      wallMesh.checkCollisions = true; // Para VR/Primera Persona
      shadowGen.addShadowCaster(wallMesh);
      wallMeshes.current.push(wallMesh);
      
      // Tope Oscuro del Muro (Diorama Effect)
      const topWall = BABYLON.MeshBuilder.CreateBox(`topWall_${wall.id}`, { width: lengthM, height: 0.04, depth: 0.15 }, scene);
      topWall.position.x = wx / PIXELS_PER_METER;
      topWall.position.z = -wy / PIXELS_PER_METER;
      topWall.position.y = FLOOR_HEIGHT_M + levelBaseY + 0.02;
      topWall.rotation.y = -angle;
      topWall.material = blackFrameMat;
      wallMeshes.current.push(topWall);
    });

    if (gizmoManager.current) gizmoManager.current.attachableMeshes = [];

    const createHighDefFurniture = (f: FurnitureElement, scene: BABYLON.Scene): BABYLON.Mesh => {
      const root = BABYLON.MeshBuilder.CreateBox("root_" + f.id, { width: 0.1, height: 0.1, depth: 0.1 }, scene);
      root.isVisible = false;
      
      const woodMat = new BABYLON.PBRMaterial("woodMat", scene); woodMat.albedoColor = new BABYLON.Color3(0.4, 0.25, 0.15); woodMat.roughness = 0.3; woodMat.metallic = 0.0;
      const fabricMat = new BABYLON.PBRMaterial("fabMat", scene); fabricMat.albedoColor = new BABYLON.Color3(0.4, 0.45, 0.5); fabricMat.roughness = 0.9; fabricMat.metallic = 0.0;
      const whiteMat = new BABYLON.PBRMaterial("wMat", scene); whiteMat.albedoColor = new BABYLON.Color3(0.95, 0.95, 0.95); whiteMat.roughness = 0.4; whiteMat.metallic = 0.1;
      const darkMat = new BABYLON.PBRMaterial("darkMat", scene); darkMat.albedoColor = new BABYLON.Color3(0.1, 0.1, 0.1); darkMat.roughness = 0.3; darkMat.metallic = 0.2;

      if (f.type === 'bed') {
        const bedFrame = BABYLON.MeshBuilder.CreateBox("bf", { width: 1.7, height: 0.3, depth: 2.2 }, scene); bedFrame.material = woodMat; bedFrame.position.y = 0.15;
        const mattress = BABYLON.MeshBuilder.CreateBox("mat", { width: 1.6, height: 0.25, depth: 2.1 }, scene); mattress.position.y = 0.4; mattress.material = whiteMat;
        const pillow1 = BABYLON.MeshBuilder.CreateBox("pil1", { width: 0.6, height: 0.12, depth: 0.4 }, scene); pillow1.position.set(-0.35, 0.55, 0.7); pillow1.material = whiteMat;
        const pillow2 = BABYLON.MeshBuilder.CreateBox("pil2", { width: 0.6, height: 0.12, depth: 0.4 }, scene); pillow2.position.set(0.35, 0.55, 0.7); pillow2.material = whiteMat;
        [bedFrame, mattress, pillow1, pillow2].forEach(m => { m.parent = root; shadowGen.addShadowCaster(m); m.receiveShadows = true; });
      } else if (f.type === 'sofa') {
        const base = BABYLON.MeshBuilder.CreateBox("base", { width: 2.4, height: 0.2, depth: 0.9 }, scene); base.position.y = 0.2;
        const cushions = BABYLON.MeshBuilder.CreateBox("cushions", { width: 2.2, height: 0.2, depth: 0.8 }, scene); cushions.position.y = 0.4;
        const back = BABYLON.MeshBuilder.CreateBox("back", { width: 2.4, height: 0.6, depth: 0.2 }, scene); back.position.set(0, 0.6, 0.35);
        const arm1 = BABYLON.MeshBuilder.CreateBox("arm1", { width: 0.2, height: 0.5, depth: 0.9 }, scene); arm1.position.set(1.1, 0.45, 0);
        const arm2 = BABYLON.MeshBuilder.CreateBox("arm2", { width: 0.2, height: 0.5, depth: 0.9 }, scene); arm2.position.set(-1.1, 0.45, 0);
        [base, cushions, back, arm1, arm2].forEach(m => { m.material = fabricMat; m.parent = root; shadowGen.addShadowCaster(m); m.receiveShadows = true; });
      } else if (f.type === 'table') {
        const top = BABYLON.MeshBuilder.CreateBox("top", { width: 1.6, height: 0.05, depth: 0.9 }, scene); top.position.y = 0.8;
        const p1 = BABYLON.MeshBuilder.CreateBox("p1", { width: 0.05, height: 0.8, depth: 0.05 }, scene); p1.position.set(0.7, 0.4, 0.35);
        const p2 = BABYLON.MeshBuilder.CreateBox("p2", { width: 0.05, height: 0.8, depth: 0.05 }, scene); p2.position.set(-0.7, 0.4, 0.35);
        const p3 = BABYLON.MeshBuilder.CreateBox("p3", { width: 0.05, height: 0.8, depth: 0.05 }, scene); p3.position.set(0.7, 0.4, -0.35);
        const p4 = BABYLON.MeshBuilder.CreateBox("p4", { width: 0.05, height: 0.8, depth: 0.05 }, scene); p4.position.set(-0.7, 0.4, -0.35);
        [top, p1, p2, p3, p4].forEach(m => { m.material = woodMat; m.parent = root; shadowGen.addShadowCaster(m); m.receiveShadows = true; });
      } else if (f.type === 'chair') {
        const seat = BABYLON.MeshBuilder.CreateBox("seat", { width: 0.5, height: 0.05, depth: 0.5 }, scene); seat.position.y = 0.45; 
        const back = BABYLON.MeshBuilder.CreateBox("back", { width: 0.5, height: 0.5, depth: 0.05 }, scene); back.position.set(0, 0.7, 0.225);
        const p1 = BABYLON.MeshBuilder.CreateBox("p1", { width: 0.04, height: 0.45, depth: 0.04 }, scene); p1.position.set(0.2, 0.225, 0.2);
        const p2 = BABYLON.MeshBuilder.CreateBox("p2", { width: 0.04, height: 0.45, depth: 0.04 }, scene); p2.position.set(-0.2, 0.225, 0.2);
        const p3 = BABYLON.MeshBuilder.CreateBox("p3", { width: 0.04, height: 0.45, depth: 0.04 }, scene); p3.position.set(0.2, 0.225, -0.2);
        const p4 = BABYLON.MeshBuilder.CreateBox("p4", { width: 0.04, height: 0.45, depth: 0.04 }, scene); p4.position.set(-0.2, 0.225, -0.2);
        [seat, back, p1, p2, p3, p4].forEach(m => { m.material = darkMat; m.parent = root; shadowGen.addShadowCaster(m); m.receiveShadows = true; });
      } else if (f.type === 'dining') {
        const top = BABYLON.MeshBuilder.CreateBox("top", { width: 2.0, height: 0.05, depth: 1.0 }, scene); top.position.y = 0.8; top.material = woodMat;
        const leg = BABYLON.MeshBuilder.CreateBox("leg", { width: 0.4, height: 0.8, depth: 0.4 }, scene); leg.position.y = 0.4; leg.material = darkMat;
        [top, leg].forEach(m => { m.parent = root; shadowGen.addShadowCaster(m); m.receiveShadows = true; });
        for(let i=0; i<6; i++) {
            const sx = i < 3 ? -0.6 + (i*0.6) : -0.6 + ((i-3)*0.6);
            const sz = i < 3 ? 0.7 : -0.7;
            const cRoot = createHighDefFurniture({ ...f, type: 'chair', id: f.id + '_c' + i }, scene);
            cRoot.parent = root; cRoot.position.set(sx, 0, sz);
            if(i>=3) cRoot.rotation.y = Math.PI;
        }
      } else if (f.type === 'toilet') {
        const base = BABYLON.MeshBuilder.CreateCylinder("base", { diameter: 0.4, height: 0.45 }, scene); base.position.set(0, 0.225, -0.1);
        const tank = BABYLON.MeshBuilder.CreateBox("tank", { width: 0.5, height: 0.5, depth: 0.2 }, scene); tank.position.set(0, 0.4, 0.2);
        [base, tank].forEach(m => { m.material = whiteMat; m.parent = root; shadowGen.addShadowCaster(m); m.receiveShadows = true; });
      } else if (f.type === 'plant') {
        const pot = BABYLON.MeshBuilder.CreateCylinder("pot", { diameter: 0.4, height: 0.4 }, scene); pot.position.y = 0.2; pot.material = whiteMat;
        const leafMat = new BABYLON.PBRMaterial("leaf", scene); leafMat.albedoColor = new BABYLON.Color3(0.2, 0.5, 0.2); leafMat.roughness = 0.6; leafMat.metallic = 0;
        const leaves = BABYLON.MeshBuilder.CreateSphere("leaves", { diameterX: 0.8, diameterY: 1.2, diameterZ: 0.8 }, scene); leaves.position.y = 0.8; leaves.material = leafMat;
        [pot, leaves].forEach(m => { m.parent = root; shadowGen.addShadowCaster(m); m.receiveShadows = true; });
      } else if (f.type === 'column') {
        const col = BABYLON.MeshBuilder.CreateBox("col", { width: 0.4, height: FLOOR_HEIGHT_M, depth: 0.4 }, scene);
        col.parent = root; col.position.y = FLOOR_HEIGHT_M / 2; col.material = whiteMat;
        shadowGen.addShadowCaster(col); col.receiveShadows = true;
      } else if (f.type === 'car') {
        const carMat = new BABYLON.PBRMaterial("carMat", scene); carMat.albedoColor = new BABYLON.Color3(0.2, 0.2, 0.7); carMat.roughness = 0.1; carMat.metallic = 0.9;
        const base = BABYLON.MeshBuilder.CreateBox("cbase", { width: 1.8, height: 0.5, depth: 4.2 }, scene); base.position.y = 0.35; base.material = carMat;
        const cabin = BABYLON.MeshBuilder.CreateBox("cabin", { width: 1.6, height: 0.6, depth: 2.0 }, scene); cabin.position.set(0, 0.9, 0.2); cabin.material = darkMat;
        [base, cabin].forEach(m => { m.parent = root; shadowGen.addShadowCaster(m); m.receiveShadows = true; });
        const wMat = new BABYLON.PBRMaterial("w", scene); wMat.albedoColor = new BABYLON.Color3(0.05, 0.05, 0.05); wMat.roughness = 0.8; wMat.metallic = 0.1;
        [[-1, 1.2], [1, 1.2], [-1, -1.2], [1, -1.2]].forEach(pos => {
            const w = BABYLON.MeshBuilder.CreateCylinder("wheel", { diameter: 0.6, height: 0.2 }, scene);
            w.rotation.z = Math.PI/2; w.position.set(pos[0]*0.9, 0.3, pos[1]); w.material = wMat; w.parent = root;
        });
      } else if (f.type === 'tv') {
        const screen = BABYLON.MeshBuilder.CreateBox("sc", { width: 1.6, height: 0.9, depth: 0.05 }, scene); screen.position.y = 0.8; screen.material = darkMat;
        const stand = BABYLON.MeshBuilder.CreateBox("st", { width: 0.4, height: 0.05, depth: 0.3 }, scene); stand.position.y = 0.025; stand.material = darkMat;
        const pole = BABYLON.MeshBuilder.CreateBox("po", { width: 0.1, height: 0.4, depth: 0.05 }, scene); pole.position.y = 0.2; pole.material = darkMat;
        [screen, stand, pole].forEach(m => { m.parent = root; shadowGen.addShadowCaster(m); m.receiveShadows = true; });
      } else if (f.type === 'socket') {
        const sock = BABYLON.MeshBuilder.CreateBox("sock", { width: 0.15, height: 0.15, depth: 0.02 }, scene);
        sock.position.set(0, 0.3, 0); sock.material = whiteMat;
        sock.parent = root;
      } else if (f.type === 'lamp') {
        const base = BABYLON.MeshBuilder.CreateCylinder("base", { diameter: 0.3, height: 0.05 }, scene); base.position.y = 0.025; base.material = darkMat;
        const pole = BABYLON.MeshBuilder.CreateCylinder("pole", { diameter: 0.03, height: 1.6 }, scene); pole.position.y = 0.8; pole.material = darkMat;
        const shade = BABYLON.MeshBuilder.CreateCylinder("shade", { diameterTop: 0.2, diameterBottom: 0.5, height: 0.4 }, scene); shade.position.y = 1.6; shade.material = whiteMat;
        [base, pole, shade].forEach(m => { m.parent = root; shadowGen.addShadowCaster(m); m.receiveShadows = true; });
      } else if (f.type === 'shower') {
        const base = BABYLON.MeshBuilder.CreateBox("sbase", { width: 0.9, height: 0.1, depth: 0.9 }, scene); base.position.y = 0.05; base.material = whiteMat;
        const gMat = new BABYLON.PBRMaterial("glassShower", scene); gMat.albedoColor = new BABYLON.Color3(0.9, 0.95, 1.0); gMat.alpha = 0.2; gMat.roughness = 0.1; gMat.metallic = 0.2; gMat.indexOfRefraction = 1.5;
        const glass1 = BABYLON.MeshBuilder.CreateBox("g1", { width: 0.9, height: 2.0, depth: 0.02 }, scene); glass1.position.set(0, 1.05, 0.44); glass1.material = gMat;
        const glass2 = BABYLON.MeshBuilder.CreateBox("g2", { width: 0.02, height: 2.0, depth: 0.9 }, scene); glass2.position.set(0.44, 1.05, 0); glass2.material = gMat;
        [base, glass1, glass2].forEach(m => { m.parent = root; m.receiveShadows = true; }); shadowGen.addShadowCaster(base);
      }
      return root;
    };

    furniture.forEach(f => {
      if (f.type === 'text') return;
      const levelBaseY = (f.level - 1) * FLOOR_HEIGHT_M;
      const posX = f.position.x / PIXELS_PER_METER;
      const posZ = -f.position.y / PIXELS_PER_METER;

      const root = createHighDefFurniture(f, scene);
      root.position.x = posX; root.position.z = posZ; root.position.y = levelBaseY;
      root.rotation.y = -f.angle;
      glbMeshes.current.push(root);
      if (gizmoManager.current && f.type !== 'column') gizmoManager.current.attachableMeshes!.push(root as any);
    });
  }, [viewMode, walls, furniture, isFirstPerson]);

  const updateElementProp = (type: 'width' | 'height' | 'elevation' | 'label' | 'manufacturer' | 'cost' | 'serialNumber', val: any) => {
    if(!selectedObjectId) return;
    if (selectedObjectType === 'furniture') {
       setFurniture(prev => prev.map(f => f.id === selectedObjectId ? { ...f, [type]: val } : f));
       return;
    }
    setWalls(prev => prev.map(w => {
      const elIndex = w.elements.findIndex(el => el.id === selectedObjectId);
      if(elIndex > -1) {
        const updated = new Wall(w.startPoint, w.endPoint, w.thickness, w.level);
        updated.id = w.id;
        updated.elements = w.elements.map(el => el.id === selectedObjectId ? { ...el, [type]: val } : el);
        return updated;
      }
      return w;
    }));
  };

  const updateWallLength = (newMeters: number) => {
    if(!selectedObjectId || newMeters <= 0.1) return;
    setWalls(prev => prev.map(w => {
      if (w.id === selectedObjectId) {
        const dx = w.endPoint.x - w.startPoint.x;
        const dy = w.endPoint.y - w.startPoint.y;
        const angle = Math.atan2(dy, dx);
        const newPx = newMeters * PIXELS_PER_METER;
        
        const newEndX = w.startPoint.x + Math.cos(angle) * newPx;
        const newEndY = w.startPoint.y + Math.sin(angle) * newPx;

        const updated = new Wall(w.startPoint, { x: newEndX, y: newEndY }, w.thickness, w.level);
        updated.id = w.id;
        updated.elements = w.elements;
        return updated;
      }
      return w;
    }));
  };

  const getSelectedElement = () => {
    for(const w of walls) {
      const el = w.elements.find(e => e.id === selectedObjectId);
      if(el) return el;
    }
    return null;
  };
  const selectedEl = getSelectedElement();
  const selectedWall = walls.find(w => w.id === selectedObjectId);
  const selectedFurn = furniture.find(f => f.id === selectedObjectId);

  useEffect(() => {
    if (selectedObjectType === 'wall' && selectedWall) {
      const lenM = Math.sqrt(Math.pow(selectedWall.endPoint.x - selectedWall.startPoint.x, 2) + Math.pow(selectedWall.endPoint.y - selectedWall.startPoint.y, 2)) / PIXELS_PER_METER;
      setEditLengthStr(lenM.toFixed(2));
    }
  }, [selectedObjectId, selectedWall, selectedObjectType]);

  const filteredSymbols = SYMBOLS.filter(s => s.label.toLowerCase().includes(searchTerm.toLowerCase()));

  const downloadPDF = () => {
    if (!fabricCanvas.current || viewMode !== '2D') return;
    const canvas = fabricCanvas.current;
    const prevZoom = canvas.getZoom();
    const prevVpt = [...canvas.viewportTransform!];
    
    // Zoom para encajar todo el plano (simplificado)
    canvas.setZoom(1);
    
    // Calcular Bounding Box basado solo en paredes y muebles (ignorando la cuadrícula infinita)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    walls.forEach(w => {
      minX = Math.min(minX, w.startPoint.x, w.endPoint.x);
      maxX = Math.max(maxX, w.startPoint.x, w.endPoint.x);
      minY = Math.min(minY, w.startPoint.y, w.endPoint.y);
      maxY = Math.max(maxY, w.startPoint.y, w.endPoint.y);
    });
    
    furniture.forEach(f => {
      minX = Math.min(minX, f.position.x - 50);
      maxX = Math.max(maxX, f.position.x + 50);
      minY = Math.min(minY, f.position.y - 50);
      maxY = Math.max(maxY, f.position.y + 50);
    });

    if (minX === Infinity) return;
    
    // Margen amplio para incluir cotas y textos
    const padding = 150;
    minX -= padding; minY -= padding;
    maxX += padding; maxY += padding;
    const w = maxX - minX; const h = maxY - minY;
    
    // Pan temporal
    canvas.viewportTransform = [1, 0, 0, 1, -minX, -minY];
    canvas.renderAll();
    
    const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 1.0, width: w, height: h });
    
    canvas.setViewportTransform(prevVpt);
    canvas.setZoom(prevZoom);
    canvas.renderAll();
    
    const pdf = new jsPDF(w > h ? 'landscape' : 'portrait', 'px', [w, h]);
    pdf.addImage(dataUrl, 'JPEG', 0, 0, w, h);
    pdf.save("plano-2d.pdf");
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#e5e5e5]">
      <Toolbar activeMode={activeMode} viewMode={viewMode} currentLevel={currentLevel} onModeChange={setActiveMode} onViewChange={setViewMode} onLevelChange={setCurrentLevel} onClearAll={() => { if (confirm("¿Limpiar todo el proyecto?")) { setWalls([]); setFurniture([]); } }} onDownloadPDF={downloadPDF} />
      
      <div className="flex-1 relative flex">
        <div className="w-64 bg-white border-r border-gray-300 shadow-sm z-20 flex flex-col font-sans overflow-hidden">
          
          <div className="flex flex-col border-b border-gray-200">
            <h2 className="text-sm font-bold text-gray-800 p-4 pb-2">Bibliotecas de Símbolos</h2>
            {viewMode === '2D' ? (
              <div className="flex flex-col h-64 overflow-y-auto">
                <div className="px-4 pb-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar símbolos..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                
                {/* Categorías estilo SmartDraw */}
                {[
                  { name: 'Estructura y Textos', items: ['column', 'stairs', 'text'] },
                  { name: 'Puertas y Ventanas', items: ['door', 'window', 'garage'] },
                  { name: 'Muebles de Habitación', items: ['bed', 'sofa', 'tv', 'lamp', 'socket'] },
                  { name: 'Cocina y Comedor', items: ['dining', 'table', 'chair', 'kitchen'] },
                  { name: 'Baño y Exteriores', items: ['toilet', 'shower', 'bathtub', 'plant', 'tree', 'car'] }
                ].map((cat, i) => (
                  <div key={i} className="border-t border-gray-100">
                    <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 flex justify-between items-center cursor-pointer hover:bg-gray-100">
                      <span>📁 {cat.name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-2 bg-white">
                      {filteredSymbols.filter(s => cat.items.includes(s.id)).map(sym => (
                        <button 
                          key={sym.id}
                          onClick={() => setActiveMode(sym.id as ToolMode)} 
                          className={`flex flex-col items-center justify-center p-2 border rounded hover:bg-blue-50 transition-colors ${activeMode === sym.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                        >
                          {sym.icon} <span className="text-[9px] mt-1 text-center leading-tight">{sym.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 p-4">Los símbolos se agregan desde la Planta 2D.</p>
            )}
          </div>

          <div className="p-4 flex-1 overflow-y-auto bg-[#f8f9fa]">
            <h2 className="text-sm font-bold text-gray-800 mb-2">Properties</h2>
            {!selectedObjectId && (
               <p className="text-xs text-gray-600 italic">Selecciona un elemento para editar.</p>
            )}
            {selectedObjectType === 'wall' && selectedWall && (
              <div className="text-sm text-gray-700 bg-white p-3 border border-gray-200 rounded">
                <p className="font-semibold mb-3 text-blue-600">Wall (Muro)</p>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  Tip: Selecciona los círculos naranjas en los extremos del muro en el plano y arrástralos para estirar la pared libremente. (Mantén Shift para ángulos diagonales).
                </p>
                <label className="flex flex-col text-xs font-semibold gap-1 text-gray-600 mb-2">
                  Longitud Exacta (m)
                  <input 
                    type="text" 
                    value={editLengthStr} 
                    onChange={e => setEditLengthStr(e.target.value)} 
                    onBlur={() => {
                        const val = parseFloat(editLengthStr.replace(',', '.'));
                        if (!isNaN(val) && val > 0.1) updateWallLength(val);
                        else setEditLengthStr((Math.sqrt(Math.pow(selectedWall.endPoint.x - selectedWall.startPoint.x, 2) + Math.pow(selectedWall.endPoint.y - selectedWall.startPoint.y, 2)) / PIXELS_PER_METER).toFixed(2));
                    }}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.currentTarget.blur();
                        }
                    }}
                    className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-yellow-400" 
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">Piso: {currentLevel}</p>
              </div>
            )}
            {selectedObjectType === 'element' && selectedEl && (
              <div className="text-sm text-gray-700 flex flex-col gap-3 bg-white p-3 border border-gray-200 rounded">
                <p className="font-semibold capitalize text-blue-600">{selectedEl.type}</p>
                <label className="flex flex-col text-xs font-semibold gap-1 text-gray-600">
                  Ancho (cm)
                  <input type="number" value={selectedEl.width} onChange={e => updateElementProp('width', Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-yellow-400" />
                </label>
                <label className="flex flex-col text-xs font-semibold gap-1 text-gray-600">
                  Alto (cm)
                  <input type="number" value={selectedEl.height} onChange={e => updateElementProp('height', Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-yellow-400" />
                </label>
                <label className="flex flex-col text-xs font-semibold gap-1 text-gray-600">
                  Elevación (cm)
                  <input type="number" value={selectedEl.elevation} onChange={e => updateElementProp('elevation', Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-yellow-400" />
                </label>
              </div>
            )}
            {selectedObjectType === 'furniture' && selectedFurn && (
              <div className="text-sm text-gray-700 bg-white p-3 border border-gray-200 rounded">
                <p className="font-semibold mb-3 text-blue-600 capitalize">{selectedFurn.type}</p>
                
                {selectedFurn.type === 'text' && (
                  <label className="flex flex-col text-xs font-semibold gap-1 text-gray-600 mb-2">
                    Etiqueta (Texto)
                    <input 
                      type="text" 
                      value={selectedFurn.label || ''} 
                      onChange={e => updateElementProp('label', e.target.value)} 
                      className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-yellow-400" 
                    />
                  </label>
                )}

                {selectedFurn.type === 'column' ? (
                  <p className="text-xs text-gray-600 mb-2">Elemento estructural fijo. Los muros dibujados cerca se ajustarán magnéticamente a su centro.</p>
                ) : (
                  <p className="text-xs text-gray-600 mb-4">Para escalar y rotar libremente, usa los controles interactivos en la vista 3D.</p>
                )}
                
                {selectedFurn.type !== 'text' && selectedFurn.type !== 'column' && (
                  <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs font-bold text-gray-800 mb-1">Especificaciones (Opcional)</p>
                    <label className="flex flex-col text-[11px] font-semibold gap-1 text-gray-500">
                      Fabricante
                      <input 
                        type="text" 
                        value={selectedFurn.manufacturer || ''} 
                        onChange={e => updateElementProp('manufacturer', e.target.value)} 
                        className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-400 font-normal text-gray-700" 
                      />
                    </label>
                    <label className="flex flex-col text-[11px] font-semibold gap-1 text-gray-500">
                      Costo Estimado ($)
                      <input 
                        type="number" 
                        value={selectedFurn.cost || ''} 
                        onChange={e => updateElementProp('cost', Number(e.target.value))} 
                        className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-400 font-normal text-gray-700" 
                      />
                    </label>
                    <label className="flex flex-col text-[11px] font-semibold gap-1 text-gray-500">
                      Número de Serie / Referencia
                      <input 
                        type="text" 
                        value={selectedFurn.serialNumber || ''} 
                        onChange={e => updateElementProp('serialNumber', e.target.value)} 
                        className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-400 font-normal text-gray-700" 
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 relative bg-[#e5e5e5] overflow-hidden flex flex-col">
          <div className="flex-1 relative">
            {viewMode === '2D' && (
              <>
                {/* Ruler Top */}
                <div className="absolute top-0 left-6 right-0 h-6 bg-white border-b border-gray-300 z-10 flex overflow-hidden">
                  {Array.from({length: 40}).map((_, i) => (
                    <div key={i} className="flex-none w-[50px] border-l border-gray-400 h-full text-[9px] text-gray-500 pl-1 pt-0.5">
                      {i * 1}
                    </div>
                  ))}
                </div>
                {/* Ruler Left */}
                <div className="absolute top-6 left-0 bottom-0 w-6 bg-white border-r border-gray-300 z-10 flex flex-col overflow-hidden">
                  {Array.from({length: 40}).map((_, i) => (
                    <div key={i} className="flex-none h-[50px] border-t border-gray-400 w-full text-[9px] text-gray-500 text-center pt-1">
                      {i * 1}
                    </div>
                  ))}
                </div>
                <div className="absolute top-0 left-0 w-6 h-6 bg-gray-100 border-r border-b border-gray-300 z-20"></div>
              </>
            )}

            <div className="absolute inset-0 transition-opacity duration-300" style={{ opacity: viewMode === '2D' ? 1 : 0, pointerEvents: viewMode === '2D' ? 'auto' : 'none', zIndex: viewMode === '2D' ? 5 : 1 }}>
              <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />
            </div>
            <div className="absolute inset-0 transition-opacity duration-300 bg-[#e5e5e5]" style={{ opacity: viewMode === '3D' ? 1 : 0, pointerEvents: viewMode === '3D' ? 'auto' : 'none', zIndex: viewMode === '3D' ? 10 : 1 }}>
              <canvas ref={engine3dRef} className="block w-full h-full outline-none touch-none" />
              <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-auto">
                <button 
                  onClick={() => setIsFirstPerson(!isFirstPerson)}
                  className={`px-4 py-2 rounded shadow-lg font-bold text-sm transition-colors ${isFirstPerson ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}`}
                >
                  {isFirstPerson ? 'Salir de Primera Persona' : 'Entrar (1ra Persona / VR)'}
                </button>
              </div>
              <div className="absolute bottom-4 right-4 bg-black/60 text-white text-xs px-3 py-2 rounded pointer-events-none backdrop-blur-sm border border-white/10 shadow-lg">
                <span className="font-bold block mb-1">Controles 3D:</span>
                Haz clic sobre los muebles para revelar controles de escala y rotación.<br/>
                {isFirstPerson && <span className="text-yellow-300">Usa W, A, S, D para caminar y el ratón para mirar.</span>}
              </div>
            </div>
          </div>
          
          {/* SmartDraw Style Footer */}
          <div className="h-8 bg-white border-t border-gray-300 flex items-center px-4 text-[10px] text-gray-600 font-semibold gap-6 z-20 shadow-sm">
             <span className="flex items-center gap-1 cursor-pointer hover:text-gray-900"><Layers size={12} /> Capa 1</span>
             {selectedObjectId ? (
                <>
                   <span>Izquierda: <span className="font-normal">2.40</span></span>
                   <span>Arriba: <span className="font-normal">5.12</span></span>
                   <span>Ancho: <span className="font-normal">0.66</span></span>
                   <span>Alto: <span className="font-normal">0.41</span></span>
                </>
             ) : (
                <span className="font-normal italic text-gray-400">Ningún elemento seleccionado</span>
             )}
             <span className="ml-auto flex items-center gap-2">
                <span className="w-24 h-1 bg-gray-200 rounded-full overflow-hidden flex items-center"><div className="w-1/2 h-full bg-blue-500"></div></span>
                100%
             </span>
          </div>
        </div>
      </div>
      <AiRenderModal canvasDataUrl={capturedPlanImage} />
    </div>
  );
};

export default CadWorkspace;
