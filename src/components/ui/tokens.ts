// ─────────────────────────────────────────────────────────
//  src/components/ui/tokens.ts
//  Design System — Project Center · Air Europa IT
//
//  Patrón: Microsoft Fluent / Azure DevOps adaptado.
//  Usar estas constantes en TODOS los componentes nuevos.
//  Evitar colores, espaciados o radios hardcodeados fuera
//  de este archivo (excepción: componentes legados).
// ─────────────────────────────────────────────────────────

// ── Color palette ──────────────────────────────────────────
export const color = {
  // Brand
  primary:        "#0078D4",   // azul Microsoft
  primaryHover:   "#106EBE",
  primaryActive:  "#005A9E",
  primaryBg:      "#EFF6FF",   // fondo tintado primario
  primaryBorder:  "#C7E0F4",

  // Neutrals
  surface:        "#FFFFFF",
  surfaceAlt:     "#FAF9F8",   // fondo de página
  surfaceRaised:  "#FFFFFF",   // cards
  border:         "#EDEBE9",
  borderStrong:   "#D2D0CE",
  borderSubtle:   "#F3F2F1",

  // Text
  text:           "#201F1E",
  textSecondary:  "#605E5C",
  textMuted:      "#A19F9D",
  textDisabled:   "#C8C6C4",
  textInverted:   "#FFFFFF",

  // Sidebar
  sidebarBg:      "#1B2A3E",
  sidebarAccent:  "#2899F5",
  sidebarText:    "rgba(255,255,255,0.90)",
  sidebarMuted:   "rgba(255,255,255,0.42)",
  sidebarBorder:  "rgba(255,255,255,0.08)",
  sidebarHover:   "rgba(255,255,255,0.07)",
  sidebarActive:  "rgba(255,255,255,0.13)",

  // Semantic
  success:        "#107C10",
  successBg:      "#DFF6DD",
  successBorder:  "#A4D4A4",

  warning:        "#CA5010",   // más naranja-oscuro (legible)
  warningAlt:     "#835B00",
  warningBg:      "#FFF4CE",
  warningBorder:  "#F4D180",

  danger:         "#D13438",
  dangerHover:    "#B52E32",
  dangerBg:       "#FDF3F0",
  dangerBorder:   "#F1BBBA",

  info:           "#0078D4",
  infoBg:         "#EFF6FF",
  infoBorder:     "#C7E0F4",

  // Project statuses
  statusEnCurso:  "#0078D4",
  statusPendiente:"#605E5C",
  statusBloqueado:"#D83B01",
  statusCerrado:  "#107C10",

  // Priority
  prioAlta:       "#D13438",
  prioMedia:      "#CA8B00",
  prioBaja:       "#0078D4",

  // Sync
  syncOK:         "#107C10",
  syncPending:    "#CA8B00",
  syncError:      "#D13438",
} as const;

// ── Spacing scale (px) ────────────────────────────────────
export const spacing = {
  0:    0,
  1:    2,
  2:    4,
  3:    6,
  4:    8,
  5:   12,
  6:   16,
  7:   20,
  8:   24,
  9:   32,
  10:  40,
  11:  48,
  12:  64,
} as const;

// ── Border radius ─────────────────────────────────────────
export const radius = {
  xs:  3,
  sm:  5,
  md:  8,
  lg: 10,
  xl: 14,
  full: 9999,
} as const;

// ── Typography ────────────────────────────────────────────
export const font = {
  family: "'Segoe UI', system-ui, -apple-system, sans-serif",
  size: {
    xs:  10,
    sm:  11,
    md:  12,
    base:13,
    lg:  15,
    xl:  18,
    "2xl": 22,
    "3xl": 28,
  },
  weight: {
    regular: 400,
    medium:  500,
    semibold:600,
    bold:    700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.2,
    base:  1.5,
    loose: 1.75,
  },
} as const;

// ── Shadows ───────────────────────────────────────────────
export const shadow = {
  xs:  "0 1px 2px rgba(0,0,0,0.06)",
  sm:  "0 2px 6px rgba(0,0,0,0.08)",
  md:  "0 4px 12px rgba(0,0,0,0.10)",
  lg:  "0 8px 24px rgba(0,0,0,0.14)",
  xl:  "0 12px 40px rgba(0,0,0,0.18)",
} as const;

// ── Z-index stack ─────────────────────────────────────────
export const zIndex = {
  base:    0,
  raised:  1,
  sticky: 10,
  banner: 20,
  drawer: 30,
  modal:  40,
  toast:  50,
} as const;

// ── Transition ────────────────────────────────────────────
export const transition = {
  fast:   "120ms ease",
  base:   "180ms ease",
  slow:   "280ms ease",
} as const;

// ── Layout widths ─────────────────────────────────────────
export const layout = {
  sidebarOpen:    232,
  sidebarClosed:   52,
  containedMax:  1100,   // max-width para pantallas "contained"
  pageGutter:      24,   // padding H de las páginas
  pageGutterV:     20,   // padding V de las páginas
} as const;

// ── Status map helpers ────────────────────────────────────
export const statusConfig = {
  "En curso":  { color: color.statusEnCurso,  bg: color.primaryBg,  label: "En curso"  },
  "Pendiente": { color: color.statusPendiente, bg: "#F3F2F1",        label: "Pendiente" },
  "Bloqueado": { color: color.statusBloqueado, bg: color.dangerBg,   label: "Bloqueado" },
  "Cerrado":   { color: color.statusCerrado,   bg: color.successBg,  label: "Cerrado"   },
} as const;

export const priorityConfig = {
  "Alta": { color: color.prioAlta,  bg: "#FFF0F0", label: "Alta"  },
  "Media":{ color: color.prioMedia, bg: "#FFFBEE", label: "Media" },
  "Baja": { color: color.prioBaja,  bg: color.primaryBg, label: "Baja" },
} as const;

export const syncConfig = {
  "OK":      { color: color.syncOK,      bg: color.successBg, label: "Sync OK"      },
  "Pending": { color: color.syncPending, bg: color.warningBg, label: "Pendiente"    },
  "Error":   { color: color.syncError,   bg: color.dangerBg,  label: "Error sync"   },
} as const;
