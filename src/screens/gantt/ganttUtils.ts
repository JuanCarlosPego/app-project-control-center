// ─────────────────────────────────────────────────────────
//  src/screens/gantt/ganttUtils.ts
//  Utilidades de cálculo para el timeline Gantt (sin librerías externas)
// ─────────────────────────────────────────────────────────

export type ZoomLevel = "month" | "week";

// ── Constantes de píxeles ────────────────────────────────
/** Píxeles por día en zoom Mes (≈5px → ~150px/mes) */
export const DAY_PX_MONTH = 5;
/** Píxeles por día en zoom Semana (≈16px → ~112px/sem) */
export const DAY_PX_WEEK  = 16;
/** Ancho fijo del panel izquierdo (tabla de filas) */
export const LEFT_WIDTH   = 400;
/** Altura de cada fila del Gantt (px) */
export const ROW_HEIGHT   = 36;
/** Altura de la fila de cabecera del timeline (px) */
export const HEADER_HEIGHT = 40;
/** Padding extra al inicio y fin del timeline (días) */
const TIMELINE_PAD_DAYS = 7;

export const getDayWidth = (zoom: ZoomLevel): number =>
  zoom === "week" ? DAY_PX_WEEK : DAY_PX_MONTH;

// ── Helpers de fecha (vanilla JS) ────────────────────────
const DAY_MS = 86_400_000;

/** Parsea "yyyy-MM-dd" → Date medianoche local */
export const parseDate = (s: string): Date =>
  new Date(s.slice(0, 10) + "T00:00:00");

/** Diferencia en días (puede ser negativa) */
export const daysBetween = (a: Date, b: Date): number =>
  Math.round((b.getTime() - a.getTime()) / DAY_MS);

export const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export const startOfMonth = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), 1);

export const endOfMonth = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0);

export const addMonths = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  r.setDate(1);
  return r;
};

export const daysInMonth = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

/** Devuelve el lunes de la semana que contiene `d` */
export const startOfWeek = (d: Date): Date => {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dow = r.getDay() === 0 ? 7 : r.getDay(); // 0=Dom → 7
  r.setDate(r.getDate() - (dow - 1));
  return r;
};

const MONTH_LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export const formatMonthLabel = (d: Date): string =>
  `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;

export const formatWeekLabel = (d: Date): string =>
  `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;

export const formatDate = (s: string): string => {
  if (!s) return "–";
  const d = parseDate(s);
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
};

// ── Columnas del timeline ────────────────────────────────
export interface TimelineColumn {
  key: string;
  label: string;
  sublabel?: string;  // para zoom Semana: "Sem N"
  widthPx: number;    // ancho en px de esta columna
  offsetLeft: number; // px desde el inicio del timeline
  startDate: Date;
  endDate: Date;
}

/**
 * Genera la lista de columnas del timeline (meses o semanas)
 * que cubren el rango [rangeStart, rangeEnd].
 */
export function buildColumns(
  rangeStart: Date,
  rangeEnd: Date,
  zoom: ZoomLevel,
): TimelineColumn[] {
  const dayW = getDayWidth(zoom);
  const cols: TimelineColumn[] = [];
  let offset = 0;

  if (zoom === "month") {
    let cur = startOfMonth(rangeStart);
    while (cur <= rangeEnd) {
      const days = daysInMonth(cur);
      const w = days * dayW;
      cols.push({
        key:      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`,
        label:    formatMonthLabel(cur),
        widthPx:  w,
        offsetLeft: offset,
        startDate: new Date(cur),
        endDate:   endOfMonth(cur),
      });
      offset += w;
      cur = addMonths(cur, 1);
    }
  } else {
    // week
    let cur = startOfWeek(rangeStart);
    let weekNum = 1;
    while (cur <= rangeEnd) {
      const wEnd = addDays(cur, 6);
      const w    = 7 * dayW;
      cols.push({
        key:      `w-${cur.toISOString().slice(0, 10)}`,
        label:    formatWeekLabel(cur),
        sublabel: `Sem ${weekNum}`,
        widthPx:  w,
        offsetLeft: offset,
        startDate:  new Date(cur),
        endDate:    wEnd,
      });
      offset += w;
      cur = addDays(cur, 7);
      weekNum++;
    }
  }

  return cols;
}

/**
 * Calcula el rango total del timeline.
 * - Si se proporcionan `forcedStart` / `forcedEnd` (yyyy-MM-dd), el timeline
 *   queda exactamente entre inicio-de-mes(forcedStart) y fin-de-mes(forcedEnd).
 *   Hoy sigue renderizándose (línea roja) aunque no se añade como cota del rango.
 * - Sin bounds forzados: comportamiento previo con ±7 días de padding e inclusión de hoy.
 */
export function computeTimelineRange(
  dates: string[],      // startDate y endDate de los items visibles
  zoom: ZoomLevel,
  forcedStart?: string, // "yyyy-MM-dd" — cota mínima exacta (sin padding)
  forcedEnd?:   string, // "yyyy-MM-dd" — cota máxima exacta (sin padding)
): { start: Date; end: Date; totalPx: number; cols: TimelineColumn[] } {
  const dayW = getDayWidth(zoom);

  let snapStart: Date;
  let snapEnd:   Date;

  if (forcedStart && forcedEnd) {
    // Bounds explícitos → snap directo, sin padding, sin incluir hoy como cota
    const fs = parseDate(forcedStart);
    const fe = parseDate(forcedEnd);
    snapStart = zoom === "month" ? startOfMonth(fs) : startOfWeek(fs);
    snapEnd   = zoom === "month" ? endOfMonth(fe)   : addDays(startOfWeek(fe), 6);
  } else {
    const valid = dates.filter(Boolean).map(parseDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rangeMin = valid.length > 0
      ? new Date(Math.min(...valid.map((d) => d.getTime())))
      : new Date(today.getFullYear(), 0, 1);
    const rangeMax = valid.length > 0
      ? new Date(Math.max(...valid.map((d) => d.getTime())))
      : new Date(today.getFullYear(), 11, 31);

    const start = addDays(new Date(Math.min(rangeMin.getTime(), today.getTime())), -TIMELINE_PAD_DAYS);
    const end   = addDays(new Date(Math.max(rangeMax.getTime(), today.getTime())), TIMELINE_PAD_DAYS);

    snapStart = zoom === "month" ? startOfMonth(start) : startOfWeek(start);
    snapEnd   = zoom === "month" ? endOfMonth(end)     : addDays(startOfWeek(end), 6);
  }

  const cols    = buildColumns(snapStart, snapEnd, zoom);
  const totalPx = cols.reduce((acc, c) => acc + c.widthPx, 0) || daysBetween(snapStart, snapEnd) * dayW;

  return { start: snapStart, end: snapEnd, totalPx, cols };
}

// ── Posición de barras ────────────────────────────────────
export interface BarPosition {
  left: number;   // px desde inicio del timeline
  width: number;  // px (mínimo 6)
}

export function getBarPosition(
  timelineStart: Date,
  startDate: string,
  endDate: string,
  zoom: ZoomLevel,
): BarPosition {
  const dayW  = getDayWidth(zoom);
  const sDate = parseDate(startDate);
  const eDate = parseDate(endDate);

  const left  = Math.max(0, daysBetween(timelineStart, sDate) * dayW);
  const width = Math.max(6, daysBetween(sDate, eDate) * dayW + dayW); // +dayW: inclusive
  return { left, width };
}

/** Posición horizontal de la línea "Hoy" */
export function getTodayOffset(timelineStart: Date, zoom: ZoomLevel): number {
  const dayW  = getDayWidth(zoom);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, daysBetween(timelineStart, today) * dayW);
}
