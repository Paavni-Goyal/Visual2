export type ThemeMode = "light" | "dark" | "auto";

export interface CellAddress {
  row: number;
  col: number;
  sheetId: string;
}

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  numberFormat?: "general" | "number" | "currency" | "percent" | "decimal";
  decimalPlaces?: number;
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  locked?: boolean;
  merged?: boolean;
  mergeRoot?: { row: number; col: number };
}

export interface CellData {
  raw: string;
  display?: string;
  formula?: string;
  format: CellFormat;
}

export interface ConditionalRule {
  id: string;
  range: string;
  type: "greater" | "less" | "between" | "equal" | "text";
  value1: number | string;
  value2?: number | string;
  backgroundColor: string;
  fontColor?: string;
}

export interface WorksheetState {
  id: string;
  name: string;
  rowCount: number;
  colCount: number;
  frozenRows: number;
  frozenCols: number;
  cells: Map<string, CellData>;
  formats: Map<string, CellFormat>;
  columnWidths: number[];
  rowHeights: number[];
  filters: Map<number, { enabled: boolean; values: Set<string> }>;
  sortCol?: number;
  sortAsc?: boolean;
}

export interface SelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface ChartConfig {
  id: string;
  type: "bar" | "line" | "pie";
  sheetId: string;
  range: string;
  title: string;
}

export interface VisualSettings {
  themeMode: ThemeMode;
  accentColor: string;
  defaultRowCount: number;
  defaultColCount: number;
  showGridLines: boolean;
  showRibbon: boolean;
}

export interface UndoAction {
  type: string;
  payload: unknown;
}
