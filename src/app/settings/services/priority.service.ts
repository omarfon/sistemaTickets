import { Injectable, signal, computed } from '@angular/core';
import { CreatePriorityDto, PriorityConfig } from '../models/priority.model';

/**
 * Servicio para la gestión CRUD de prioridades de atención.
 * Alimenta dinámicamente las opciones de prioridad del sistema.
 */
@Injectable({ providedIn: 'root' })
export class PriorityService {
  private _idCounter = 100;

  private readonly _priorities = signal<PriorityConfig[]>([
    {
      id: 'pri-001',
      code: 'NORMAL',
      label: 'General',
      description: 'Paciente estándar sin condición especial',
      weight: 1,
      icon: '🟢',
      color: 'bg-green-100 text-green-800 ring-green-200',
      isActive: true,
    },
    {
      id: 'pri-002',
      code: 'PREFERENCIAL',
      label: 'Vulnerable',
      description: 'Adultos mayores (≥65 años), gestantes, personas con discapacidad',
      weight: 2,
      icon: '🟡',
      color: 'bg-amber-100 text-amber-800 ring-amber-200',
      isActive: true,
    },
    {
      id: 'pri-003',
      code: 'VIP',
      label: 'Urgente',
      description: 'Paciente con condición que requiere atención prioritaria inmediata',
      weight: 3,
      icon: '🔴',
      color: 'bg-red-100 text-red-800 ring-red-200',
      isActive: true,
    },
  ]);

  /** Todas las prioridades */
  readonly priorities = this._priorities.asReadonly();

  /** Solo las activas, ordenadas por peso descendente */
  readonly activePriorities = computed(() =>
    this._priorities()
      .filter(p => p.isActive)
      .sort((a, b) => b.weight - a.weight)
  );

  /** Mapa code → label para uso rápido en templates */
  readonly labelMap = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of this._priorities()) {
      map[p.code] = p.label;
    }
    return map;
  });

  /** Mapa code → weight para ordenamiento */
  readonly weightMap = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const p of this._priorities()) {
      map[p.code] = p.weight;
    }
    return map;
  });

  /** Mapa code → icon */
  readonly iconMap = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of this._priorities()) {
      map[p.code] = p.icon;
    }
    return map;
  });

  /** Mapa code → color */
  readonly colorMap = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of this._priorities()) {
      map[p.code] = p.color;
    }
    return map;
  });

  // ─── CRUD ──────────────────────────────────────────────────────────

  create(dto: CreatePriorityDto): PriorityConfig {
    const priority: PriorityConfig = {
      ...dto,
      id: `pri-${++this._idCounter}`,
    };
    this._priorities.update(list => [...list, priority]);
    return priority;
  }

  update(id: string, changes: Partial<CreatePriorityDto>): void {
    this._priorities.update(list =>
      list.map(p => (p.id === id ? { ...p, ...changes } : p))
    );
  }

  delete(id: string): void {
    this._priorities.update(list => list.filter(p => p.id !== id));
  }

  toggleActive(id: string): void {
    this._priorities.update(list =>
      list.map(p => (p.id === id ? { ...p, isActive: !p.isActive } : p))
    );
  }

  getById(id: string): PriorityConfig | undefined {
    return this._priorities().find(p => p.id === id);
  }

  getByCode(code: string): PriorityConfig | undefined {
    return this._priorities().find(p => p.code === code);
  }
}
