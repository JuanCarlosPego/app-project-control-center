// ─────────────────────────────────────────────────────────
//  src/screens/roadmap/tokens.ts
//  Design tokens compartidos en el módulo Roadmap
// ─────────────────────────────────────────────────────────

export const STATUS_COLOR: Record<string, string> = {
  "En curso":  "#0078D4",
  "Pendiente": "#8A8886",
  "Bloqueado": "#D83B01",
  "Cerrado":   "#107C10",
};

export const PRIORITY_COLOR: Record<string, string> = {
  "Alta":  "#D83B01",
  "Media": "#C8A600",
  "Baja":  "#8A8886",
};

export const DELIVERY_COLOR: Record<string, string> = {
  "IT":        "#5C2D91",
  "Proveedor": "#00B294",
};

/** Zoom levels disponibles en el roadmap */
export type ZoomLevel = "year" | "quarter" | "month" | "week";

/** Modos de agrupación disponibles */
export type GroupBy = "area" | "provider" | "deliveryOwner" | "category";

export const GROUP_LABELS: Record<GroupBy, string> = {
  area:          "Área",
  provider:      "Proveedor",
  deliveryOwner: "Ejecutor",
  category:      "Categoría",
};
