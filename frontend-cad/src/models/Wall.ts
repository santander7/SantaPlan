export interface Point {
  x: number;
  y: number;
}

export type ElementType = 'door' | 'window' | 'garage';
export type FurnitureType = 'bed' | 'sofa' | 'toilet' | 'plant' | 'tree' | 'table' | 'chair' | 'stairs' | 'column' | 'car' | 'dining' | 'kitchen' | 'tv' | 'lamp' | 'shower' | 'bathtub' | 'socket' | 'text';

export interface WallElement {
  id: string;
  type: ElementType;
  positionRatio: number; 
  width: number; 
  height: number; 
  elevation: number; 
}

export interface FurnitureElement {
  id: string;
  type: FurnitureType;
  position: Point;
  angle: number; // en radianes
  level: number; // Piso 1, 2, etc.
  width?: number; // En metros
  height?: number; // En metros
  label?: string;
  manufacturer?: string;
  cost?: number;
  serialNumber?: string;
}

export class Wall {
  public id: string;
  public startPoint: Point;
  public endPoint: Point;
  public thickness: number; 
  public elements: WallElement[];
  public level: number; // Piso al que pertenece

  constructor(startPoint: Point, endPoint: Point, thickness: number = 15, level: number = 1) {
    this.id = 'wall-' + Math.random().toString(36).substr(2, 9); 
    this.startPoint = startPoint;
    this.endPoint = endPoint;
    this.thickness = thickness;
    this.level = level;
    this.elements = [];
  }

  // Las propiedades calculadas deben evitar usarse en hooks de React que puedan desestructurar el objeto.
  // Por lo tanto, usaremos getters con cuidado o los calcularemos al vuelo.
  
  public get lengthPx(): number {
    const dx = this.endPoint.x - this.startPoint.x;
    const dy = this.endPoint.y - this.startPoint.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public get lengthMeters(): number {
    return this.lengthPx / 50; // 50px = 1m
  }

  public get angleRad(): number {
    const dx = this.endPoint.x - this.startPoint.x;
    const dy = this.endPoint.y - this.startPoint.y;
    return Math.atan2(dy, dx);
  }
}
