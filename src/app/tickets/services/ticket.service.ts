import { computed, Injectable, signal } from '@angular/core';
import { TicketPriority, TICKET_PRIORITY_LABELS, TICKET_PRIORITY_WEIGHT } from '../enums/ticket-priority.enum';
import { TicketSource, TICKET_SOURCE_LABELS } from '../enums/ticket-source.enum';
import { TicketStatus, TICKET_STATUS_TRANSITIONS } from '../enums/ticket-status.enum';
import { TicketEvent } from '../enums/ticket-event.enum';
import { CreateTicketDto, QueueSummary, Ticket, TicketHistoryEntry } from '../models/ticket.model';
import { ServiceType } from '../models/service-type.model';
import { Patient } from '../models/patient.model';

/**
 * Servicio principal del módulo de gestión de tickets.
 *
 * Responsabilidades:
 * - Generación y numeración automática de tickets (ej: A001, B045)
 * - Gestión del ciclo de vida: espera → atención → atendido / cancelado
 * - Cálculo del tiempo de espera estimado
 * - Exposición del estado reactivo mediante signals
 */
@Injectable({ providedIn: 'root' })
export class TicketService {
  // ─── Servicios disponibles (datos semilla — flujo clínico) ───────────────
  //     Paso 1: Admisión  →  Paso 2: Pre-consulta  →  Paso 3: Especialista
  readonly services = signal<ServiceType[]>([
    // ── PASO 1: ADMISIÓN ────────────────────────────────────────────────────
    {
      id: 'svc-admision-caja',
      name: 'Caja / Pagos',
      prefix: 'A',
      description: 'Pago de servicios, copagos y tarifas de consulta',
      avgAttentionTimeMinutes: 5,
      isActive: true,
      windowCount: 3,
      step: 1,
      icon: '💳',
      windowLabel: 'Ventanilla',
    },
    {
      id: 'svc-admision-citas',
      name: 'Citas y Reservas',
      prefix: 'B',
      description: 'Reserva, confirmación y modificación de citas médicas',
      avgAttentionTimeMinutes: 8,
      isActive: true,
      windowCount: 2,
      step: 1,
      icon: '📅',
      windowLabel: 'Módulo',
    },
    {
      id: 'svc-admision-info',
      name: 'Información General',
      prefix: 'C',
      description: 'Orientación, trámites administrativos y documentación',
      avgAttentionTimeMinutes: 4,
      isActive: true,
      windowCount: 1,
      step: 1,
      icon: 'ℹ️',
      windowLabel: 'Módulo',
    },
    // ── PASO 2: PRE-CONSULTA / TRIAJE ───────────────────────────────────────
    {
      id: 'svc-triaje',
      name: 'Pre-consulta (Triaje)',
      prefix: 'T',
      description: 'Evaluación de signos vitales y clasificación de urgencia',
      avgAttentionTimeMinutes: 10,
      isActive: true,
      windowCount: 3,
      step: 2,
      icon: '🩺',
      windowLabel: 'Consultorio',
    },
    // ── PASO 3: ESPECIALISTAS ───────────────────────────────────────────────
    {
      id: 'svc-medicina',
      name: 'Medicina General',
      prefix: 'M',
      description: 'Consulta con médico general',
      avgAttentionTimeMinutes: 20,
      isActive: true,
      windowCount: 4,
      step: 3,
      icon: '👨‍⚕️',
      windowLabel: 'Consultorio',
    },
    {
      id: 'svc-pediatria',
      name: 'Pediatría',
      prefix: 'P',
      description: 'Atención pediátrica para pacientes menores de 18 años',
      avgAttentionTimeMinutes: 20,
      isActive: true,
      windowCount: 2,
      step: 3,
      icon: '🧒',
      windowLabel: 'Consultorio',
    },
    {
      id: 'svc-especialidades',
      name: 'Especialidades',
      prefix: 'E',
      description: 'Cardiología, Traumatología, Ginecología y otras especialidades',
      avgAttentionTimeMinutes: 25,
      isActive: true,
      windowCount: 3,
      step: 3,
      icon: '🏥',
      windowLabel: 'Consultorio',
    },
  ]);

  // ─── Estado principal ────────────────────────────────────────────────────

  /**
   * Base de datos de pacientes registrados en la clínica.
   * En producción esto sería una llamada al API REST.
   * La búsqueda se realiza por DNI (8 dígitos).
   */
  private readonly _patients: Patient[] = [
    // ── Pacientes originales ───────────────────────────────────────────────
    { dni: '12345678', name: 'García López, María Elena',         age: 45, phone: '987654321', bloodType: 'O+' },
    { dni: '87654321', name: 'Rodríguez Pérez, Carlos Alberto',   age: 32, phone: '998877665', bloodType: 'A+' },
    { dni: '11223344', name: 'Flores Mamani, Rosa Angélica',      age: 67, phone: '912345678', bloodType: 'B+', allergies: 'Penicilina' },
    { dni: '44332211', name: 'Torres Quispe, Juan Manuel',        age:  8, phone: '945678901', bloodType: 'AB+' },
    { dni: '55667788', name: 'Vargas Chávez, Ana María',          age: 29, phone: '933221100', bloodType: 'O-' },
    { dni: '99887766', name: 'Mendoza Huanca, Pedro Luis',        age: 72, phone: '901234567', bloodType: 'A-', allergies: 'Aspirina, Ibuprofeno' },
    { dni: '33445566', name: 'Sánchez Vega, Lucía Beatriz',       age: 55, phone: '956789012', bloodType: 'B-' },
    { dni: '77889900', name: 'Pacheco Ramos, Diego Alonso',       age: 41, phone: '922334455', bloodType: 'O+' },
    { dni: '66778899', name: 'Huamán Condori, Silvia Milagros',   age: 35, phone: '911223344', bloodType: 'AB-' },
    { dni: '22334455', name: 'Castillo Ponce, Roberto Enrique',   age: 60, phone: '978901234', bloodType: 'A+', allergies: 'Sulfamidas' },
    // ── Pacientes adicionales ──────────────────────────────────────────────
    { dni: '10111213', name: 'Quispe Mamani, Carmen Rosa',        age: 38, phone: '981234567', bloodType: 'O+' },
    { dni: '14151617', name: 'Ramos Flores, Alberto José',        age: 52, phone: '962345678', bloodType: 'A+' },
    { dni: '18192021', name: 'Díaz Vega, María Paz',              age: 27, phone: '973456789', bloodType: 'B+' },
    { dni: '22232425', name: 'León Pérez, César Augusto',         age: 44, phone: '984567890', bloodType: 'AB+' },
    { dni: '26272829', name: 'Flores García, Lucía Isabel',       age: 31, phone: '995678901', bloodType: 'O+' },
    { dni: '30313233', name: 'Morales Ríos, Fernando Antonio',    age: 68, phone: '906789012', bloodType: 'A-', allergies: 'Penicilina' },
    { dni: '34353637', name: 'Apaza Condo, Elizabeth Noemí',      age:  5, phone: '917890123', bloodType: 'O+' },
    { dni: '38394041', name: 'Ramírez Suárez, Hugo Adolfo',       age: 48, phone: '928901234', bloodType: 'B+' },
    { dni: '42434445', name: 'Pinto Lazo, Susana Patricia',       age: 33, phone: '939012345', bloodType: 'AB-' },
    { dni: '46474849', name: 'Coaquira Llanos, Ángel Rubén',      age: 77, phone: '950123456', bloodType: 'A+' },
    { dni: '50515253', name: 'Mamani Quispe, Rosa Elvira',        age: 24, phone: '961234567', bloodType: 'O-' },
    { dni: '54555657', name: 'Vilca Condori, Efraín Aurelio',     age: 59, phone: '972345678', bloodType: 'B-' },
    { dni: '58596061', name: 'Herrera Palomino, Norma Felicitas', age: 41, phone: '983456789', bloodType: 'AB+' },
    { dni: '62636465', name: 'Callo Mamani, Daniel Alonso',       age: 16, phone: '994567890', bloodType: 'O+' },
    { dni: '66676869', name: 'Huanca Apaza, Graciela Trinidad',   age: 70, phone: '905678901', bloodType: 'A+', allergies: 'Ibuprofeno' },
  ];

  /** Lista completa de tickets del sistema */
  private readonly _tickets = signal<Ticket[]>([]);

  /** Contadores por prefijo de servicio para la numeración secuencial */
  private readonly _counters = signal<Record<string, number>>({});

  constructor() {
    this._loadSeedData();
  }

  // ─── Estado derivado (computed) ───────────────────────────────────────────

  /** Todos los tickets (solo lectura) */
  readonly tickets = this._tickets.asReadonly();

  /** Tickets en espera con check-in confirmado, ordenados por prioridad (RF-20) */
  readonly waitingTickets = computed(() =>
    this._tickets()
      .filter(t => t.status === TicketStatus.EnEspera && t.checkedIn)
      .sort((a, b) => {
        const priorityDiff =
          TICKET_PRIORITY_WEIGHT[b.priority] - TICKET_PRIORITY_WEIGHT[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      })
  );

  readonly inProgressTickets = computed(() =>
    this._tickets().filter(t => t.status === TicketStatus.EnAtencion)
  );

  readonly completedTickets = computed(() =>
    this._tickets().filter(t => t.status === TicketStatus.Atendido)
  );

  /** RF-19: Tickets virtuales pendientes de check-in */
  readonly virtualQueueTickets = computed(() =>
    this._tickets().filter(
      t => t.status === TicketStatus.EnEspera && t.virtualQueue && !t.checkedIn
    )
  );

  readonly queueSummaries = computed<QueueSummary[]>(() =>
    this.services()
      .filter(s => s.isActive)
      .map(service => this._buildQueueSummary(service))
  );

  readonly totalWaiting = computed(() => this.waitingTickets().length);
  readonly totalVirtual = computed(() => this.virtualQueueTickets().length);

  // ─── Métodos públicos ─────────────────────────────────────────────────────

  /**
   * RF-01/02/03: Genera un nuevo ticket.
   * Si virtualQueue=true, no entra a la cola activa hasta check-in (RF-20).
   */
  createTicket(dto: CreateTicketDto): Ticket {
    const number = this._nextNumber(dto.service.prefix);
    const estimatedWaitMinutes = this._calculateWaitTime(dto.service, dto.priority);
    const now = new Date();
    const isVirtual = dto.virtualQueue ?? false;

    const initEntry: TicketHistoryEntry = {
      id: this._generateId(),
      timestamp: now,
      event: TicketEvent.Creado,
      detail: `Canal: ${TICKET_SOURCE_LABELS[dto.source]}${isVirtual ? ' · Cola virtual' : ''}`,
    };

    const ticket: Ticket = {
      id: this._generateId(),
      number,
      service: dto.service,
      priority: dto.priority,
      status: TicketStatus.EnEspera,
      source: dto.source,
      createdAt: now,
      calledAt: null,
      finishedAt: null,
      estimatedWaitMinutes,
      assignedWindow: null,
      notes: dto.notes,
      history: [initEntry],
      virtualQueue: isVirtual,
      checkedIn: !isVirtual,
      checkedInAt: !isVirtual ? now : undefined,
      rescheduleCount: 0,
      patientDni: dto.patientDni,
      patientName: dto.patientName,
    };

    this._tickets.update(list => [...list, ticket]);
    return ticket;
  }

  /** RF-16: Verifica si ya existe un ticket activo para el mismo servicio y canal. */
  isDuplicate(serviceId: string, source: TicketSource): boolean {
    return this._tickets().some(
      t =>
        t.service.id === serviceId &&
        t.source === source &&
        (t.status === TicketStatus.EnEspera || t.status === TicketStatus.EnAtencion)
    );
  }

  /**
   * Busca un paciente en la base de datos por su DNI.
   * @param dni - 8 dígitos del DNI
   * @returns El paciente encontrado o `undefined` si no existe
   */
  findPatientByDni(dni: string): Patient | undefined {
    return this._patients.find(p => p.dni === dni.trim());
  }

  /**
   * RF-17: Llama al siguiente ticket en espera con check-in confirmado,
   * respetando prioridad VIP > Preferencial > Normal.
   */
  callNextTicket(serviceId: string, window: number): Ticket | undefined {
    const next = this.waitingTickets().find(t => t.service.id === serviceId);
    if (!next) return undefined;

    const now = new Date();
    const entry: TicketHistoryEntry = {
      id: this._generateId(),
      timestamp: now,
      event: TicketEvent.Llamado,
      detail: `Ventanilla ${window}`,
    };

    return this._updateTicket(next.id, {
      status: TicketStatus.EnAtencion,
      calledAt: now,
      assignedWindow: window,
      history: [...next.history, entry],
    });
  }

  /** Marca un ticket en atención como atendido. */
  completeTicket(ticketId: string, notes?: string): Ticket | undefined {
    const ticket = this._findById(ticketId);
    if (!ticket) return undefined;

    const now = new Date();
    const entry: TicketHistoryEntry = {
      id: this._generateId(),
      timestamp: now,
      event: TicketEvent.Atendido,
      detail: notes ? `Nota: ${notes}` : undefined,
    };

    return this._updateTicket(ticketId, {
      status: TicketStatus.Atendido,
      finishedAt: now,
      notes,
      history: [...ticket.history, entry],
    });
  }

  /** RF-09: Cancela un ticket que aún no ha sido atendido. */
  cancelTicket(ticketId: string): Ticket | undefined {
    const ticket = this._findById(ticketId);
    if (!ticket) return undefined;

    const allowed = TICKET_STATUS_TRANSITIONS[ticket.status];
    if (!allowed.includes(TicketStatus.Cancelado)) return undefined;

    const now = new Date();
    const entry: TicketHistoryEntry = {
      id: this._generateId(),
      timestamp: now,
      event: TicketEvent.Cancelado,
    };

    return this._updateTicket(ticketId, {
      status: TicketStatus.Cancelado,
      history: [...ticket.history, entry],
    });
  }

  /**
   * RF-18: Mueve un ticket en espera a otro servicio.
   * Genera nuevo número con el prefijo del servicio destino.
   */
  transferTicket(ticketId: string, newServiceId: string, reason?: string): Ticket | undefined {
    const ticket = this._findById(ticketId);
    if (!ticket || ticket.status !== TicketStatus.EnEspera) return undefined;

    const newService = this.services().find(s => s.id === newServiceId);
    if (!newService || newService.id === ticket.service.id) return undefined;

    const now = new Date();
    const newNumber = this._nextNumber(newService.prefix);
    const estimatedWait = this._calculateWaitTime(newService, ticket.priority);

    const entry: TicketHistoryEntry = {
      id: this._generateId(),
      timestamp: now,
      event: TicketEvent.Transferido,
      detail: `"${ticket.service.name}" → "${newService.name}"${reason ? ` · ${reason}` : ''}`,
    };

    return this._updateTicket(ticketId, {
      service: newService,
      number: newNumber,
      estimatedWaitMinutes: estimatedWait,
      transferredFrom: { serviceId: ticket.service.id, serviceName: ticket.service.name, at: now },
      history: [...ticket.history, entry],
    });
  }

  /**
   * RF-10: Cambia la prioridad de un ticket en espera.
   * Recalcula el tiempo de espera estimado.
   */
  rescheduleTicket(ticketId: string, priority: TicketPriority): Ticket | undefined {
    const ticket = this._findById(ticketId);
    if (!ticket || ticket.status !== TicketStatus.EnEspera) return undefined;
    if (ticket.priority === priority) return ticket;

    const now = new Date();
    const entry: TicketHistoryEntry = {
      id: this._generateId(),
      timestamp: now,
      event: TicketEvent.Reprogramado,
      detail: `${TICKET_PRIORITY_LABELS[ticket.priority]} → ${TICKET_PRIORITY_LABELS[priority]}`,
    };

    return this._updateTicket(ticketId, {
      priority,
      estimatedWaitMinutes: this._calculateWaitTime(ticket.service, priority),
      rescheduleCount: ticket.rescheduleCount + 1,
      history: [...ticket.history, entry],
    });
  }

  /**
   * RF-20: Confirma la llegada física del titular de un ticket virtual.
   * Tras el check-in el ticket entra a la cola activa.
   */
  checkInTicket(ticketId: string): Ticket | undefined {
    const ticket = this._findById(ticketId);
    if (!ticket) return undefined;
    if (ticket.checkedIn || ticket.status !== TicketStatus.EnEspera) return ticket;

    const now = new Date();
    const entry: TicketHistoryEntry = {
      id: this._generateId(),
      timestamp: now,
      event: TicketEvent.CheckIn,
      detail: 'Llegada física confirmada',
    };

    return this._updateTicket(ticketId, {
      checkedIn: true,
      checkedInAt: now,
      history: [...ticket.history, entry],
    });
  }

  /** RF-14: Registra que el ticket fue impreso. */
  printTicket(ticketId: string): Ticket | undefined {
    const ticket = this._findById(ticketId);
    if (!ticket) return undefined;

    const now = new Date();
    const entry: TicketHistoryEntry = {
      id: this._generateId(),
      timestamp: now,
      event: TicketEvent.Impreso,
    };

    return this._updateTicket(ticketId, { printedAt: now, history: [...ticket.history, entry] });
  }

  /** Busca un ticket por número visible (ej: "A001"). */
  findByNumber(number: string): Ticket | undefined {
    return this._tickets().find(
      t => t.number.toUpperCase() === number.trim().toUpperCase()
    );
  }

  /** Retorna un ticket por su ID. */
  getById(ticketId: string): Ticket | undefined {
    return this._findById(ticketId);
  }

  // ─── Métodos privados ─────────────────────────────────────────────────────

  /**
   * Carga datos semilla realistas para demostración del sistema.
   * Genera 20 tickets con pacientes, estados y prioridades variados.
   */
  private _loadSeedData(): void {
    const svc = (id: string) => this.services().find(s => s.id === id)!;
    const counters: Record<string, number> = {};
    let hc = 0;
    const hid = () => `seed-h-${++hc}`;
    let tc = 0;
    const tid = () => `seed-t-${++tc}`;

    const nextNum = (prefix: string): string => {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      return `${prefix}${String(counters[prefix]).padStart(3, '0')}`;
    };

    const ago = (min: number): Date => {
      const d = new Date();
      d.setMinutes(d.getMinutes() - min);
      return d;
    };

    const h = (t: Date, event: TicketEvent, detail?: string): TicketHistoryEntry => ({
      id: hid(), timestamp: t, event, detail,
    });

    const mk = (
      svcId: string,
      priority: TicketPriority,
      status: TicketStatus,
      source: TicketSource,
      createdMins: number,
      patientDni?: string,
      patientName?: string,
      assignedWindow?: number,
      calledMins?: number,
      finishedMins?: number,
    ): Ticket => {
      const service = svc(svcId);
      const number  = nextNum(service.prefix);
      const createdAt = ago(createdMins);
      const calledAt  = calledMins != null ? ago(calledMins)    : null;
      const finishedAt = finishedMins != null ? ago(finishedMins) : null;
      const history: TicketHistoryEntry[] = [
        h(createdAt, TicketEvent.Creado, `Canal: ${TICKET_SOURCE_LABELS[source]}`),
      ];
      if (calledAt)   history.push(h(calledAt,   TicketEvent.Llamado,   assignedWindow ? `Ventanilla ${assignedWindow}` : undefined));
      if (finishedAt) history.push(h(finishedAt, status === TicketStatus.Atendido ? TicketEvent.Atendido : TicketEvent.Cancelado));
      return {
        id: tid(), number, service, priority, status, source,
        createdAt, calledAt, finishedAt,
        estimatedWaitMinutes: Math.max(5, service.avgAttentionTimeMinutes),
        assignedWindow: assignedWindow ?? null,
        history, virtualQueue: false, checkedIn: true,
        checkedInAt: createdAt, rescheduleCount: 0,
        patientDni, patientName,
      };
    };

    const N = TicketPriority.Normal;
    const P = TicketPriority.Preferencial;
    const V = TicketPriority.VIP;
    const W = TicketStatus.EnEspera;
    const A = TicketStatus.EnAtencion;
    const D = TicketStatus.Atendido;
    const M = TicketSource.Manual;
    const K = TicketSource.Kiosko;

    const tickets: Ticket[] = [
      // ── CAJA / PAGOS ──────────────────────────────────────────────────────
      mk('svc-admision-caja', N, W, K, 47, '12345678', 'García López, María Elena'),
      mk('svc-admision-caja', P, W, K, 42, '44332211', 'Torres Quispe, Juan Manuel'),
      mk('svc-admision-caja', P, A, M, 50, '99887766', 'Mendoza Huanca, Pedro Luis',  1, 12),
      mk('svc-admision-caja', N, A, K, 18, '77889900', 'Pacheco Ramos, Diego Alonso',  2,  6),
      mk('svc-admision-caja', N, W, K, 30, '11223344', 'Flores Mamani, Rosa Angélica'),
      // ── CITAS Y RESERVAS ─────────────────────────────────────────────────
      mk('svc-admision-citas', N, W, M, 35, '87654321', 'Rodríguez Pérez, Carlos Alberto'),
      mk('svc-admision-citas', P, A, K, 20, '33445566', 'Sánchez Vega, Lucía Beatriz',  3,  9),
      mk('svc-admision-citas', N, D, M, 65, '14151617', 'Ramos Flores, Alberto José',  3, 55, 45),
      // ── INFORMACIÓN GENERAL ──────────────────────────────────────────────
      mk('svc-admision-info', N, D, K, 72, '55667788', 'Vargas Chávez, Ana María',    4, 62, 50),
      mk('svc-admision-info', N, W, K, 10, '42434445', 'Pinto Lazo, Susana Patricia'),
      // ── TRIAJE ───────────────────────────────────────────────────────────
      mk('svc-triaje', N, W, M, 55, '66778899', 'Huamán Condori, Silvia Milagros'),
      mk('svc-triaje', N, A, K, 48, '10111213', 'Quispe Mamani, Carmen Rosa',        6, 14),
      mk('svc-triaje', P, A, M, 60, '22334455', 'Castillo Ponce, Roberto Enrique',   5, 18),
      mk('svc-triaje', V, W, M,  5, '46474849', 'Coaquira Llanos, Ángel Rubén'),
      // ── MEDICINA GENERAL ─────────────────────────────────────────────────
      mk('svc-medicina', N, W, K, 65, '18192021', 'Díaz Vega, María Paz'),
      mk('svc-medicina', N, W, K, 58, '22232425', 'León Pérez, César Augusto'),
      mk('svc-medicina', V, A, M, 40, '26272829', 'Flores García, Lucía Isabel',    7, 22),
      mk('svc-medicina', P, W, K, 20, '66676869', 'Huanca Apaza, Graciela Trinidad'),
      // ── PEDIATRÍA ────────────────────────────────────────────────────────
      mk('svc-pediatria', P, W, K, 25, '44332211', 'Torres Quispe, Juan Manuel'),
      mk('svc-pediatria', P, A, K, 15, '34353637', 'Apaza Condo, Elizabeth Noemí',     9,  5),
      // ── ESPECIALIDADES ────────────────────────────────────────────────────
      mk('svc-especialidades', N, A, M, 30, '30313233', 'Morales Ríos, Fernando Antonio', 10, 18),
    ];

    this._tickets.set(tickets);
    this._counters.set(counters);
  }

  private _nextNumber(prefix: string): string {
    this._counters.update(counters => ({
      ...counters,
      [prefix]: (counters[prefix] ?? 0) + 1,
    }));
    const seq = this._counters()[prefix];
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  private _calculateWaitTime(service: ServiceType, priority: TicketPriority): number {
    const waiting = this.waitingTickets().filter(t => t.service.id === service.id);
    const normalWait =
      (waiting.length / service.windowCount) * service.avgAttentionTimeMinutes;

    // Preferencial y VIP reducen el tiempo de espera efectivo
    const reductionFactor =
      priority === TicketPriority.VIP
        ? 0.1
        : priority === TicketPriority.Preferencial
          ? 0.5
          : 1;

    return Math.ceil(normalWait * reductionFactor);
  }

  private _buildQueueSummary(service: ServiceType): QueueSummary {
    const serviceTickets = this._tickets().filter(t => t.service.id === service.id);
    const waiting = serviceTickets.filter(t => t.status === TicketStatus.EnEspera);
    const inProgress = serviceTickets.filter(t => t.status === TicketStatus.EnAtencion);
    const counter = this._counters()[service.prefix] ?? 0;

    const avgWait =
      waiting.length > 0
        ? Math.ceil(
            waiting.reduce((sum, t) => sum + t.estimatedWaitMinutes, 0) / waiting.length
          )
        : 0;

    return {
      service,
      waitingCount: waiting.length,
      inProgressCount: inProgress.length,
      avgWaitMinutes: avgWait,
      lastTicketNumber:
        counter > 0 ? `${service.prefix}${String(counter).padStart(3, '0')}` : '—',
    };
  }

  /**
   * RF-66: Permite al motor de colas adelantar un ticket modificando su timestamp.
   * Usado para implementar saltos de cola (jump to front).
   */
  updateTicketCreatedAt(id: string, newDate: Date): void {
    this._tickets.update(list =>
      list.map(t => t.id === id ? { ...t, createdAt: newDate } : t)
    );
  }

  private _findById(id: string): Ticket | undefined {
    return this._tickets().find(t => t.id === id);
  }

  private _updateTicket(id: string, patch: Partial<Ticket>): Ticket | undefined {
    let updated: Ticket | undefined;

    this._tickets.update(list =>
      list.map(t => {
        if (t.id !== id) return t;
        updated = { ...t, ...patch };
        return updated;
      })
    );

    return updated;
  }

  private _generateId(): string {
    return `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
