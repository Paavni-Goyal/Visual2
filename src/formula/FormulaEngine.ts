import { HyperFormula, ConfigParams } from "hyperformula";

export class FormulaEngine {
  private hf: HyperFormula | null = null;
  /** Maps app sheet id → HyperFormula sheet display name */
  private sheetNameMap: Map<string, string> = new Map();

  initialize(sheetIds: string[]): void {
    const config: Partial<ConfigParams> = {
      licenseKey: "gpl-v3",
      useArrayArithmetic: true,
      useColumnIndex: true,
      precisionRounding: 10
    };
    this.hf = HyperFormula.buildEmpty(config);
    this.sheetNameMap.clear();
    sheetIds.forEach((id) => this.registerSheet(id));
  }

  private registerSheet(sheetId: string): void {
    if (!this.hf) return;
    const existing = this.hf.getSheetId(sheetId);
    if (existing !== undefined) {
      this.sheetNameMap.set(sheetId, sheetId);
      return;
    }
    const name = this.hf.addSheet(sheetId);
    this.sheetNameMap.set(sheetId, name);
  }

  private getSheetIndex(sheetId: string): number | undefined {
    if (!this.hf) return undefined;
    const name = this.sheetNameMap.get(sheetId) ?? sheetId;
    return this.hf.getSheetId(name);
  }

  ensureSheet(sheetId: string): number {
    if (!this.hf) this.initialize([sheetId]);
    let idx = this.getSheetIndex(sheetId);
    if (idx === undefined) {
      this.registerSheet(sheetId);
      idx = this.getSheetIndex(sheetId);
    }
    if (idx === undefined) {
      throw new Error(`Unable to create formula sheet: ${sheetId}`);
    }
    return idx;
  }

  setCellValue(sheetId: string, row: number, col: number, value: string | number | null): void {
    if (!this.hf) return;
    const sheetIdx = this.ensureSheet(sheetId);
    if (value === null || value === "") {
      this.hf.setCellContents({ sheet: sheetIdx, row, col }, null);
      return;
    }
    this.hf.setCellContents({ sheet: sheetIdx, row, col }, value);
  }

  getCellValue(sheetId: string, row: number, col: number): unknown {
    if (!this.hf) return null;
    const sheetIdx = this.getSheetIndex(sheetId);
    if (sheetIdx === undefined) return null;
    return this.hf.getCellValue({ sheet: sheetIdx, row, col });
  }

  getCellFormula(sheetId: string, row: number, col: number): string | undefined {
    if (!this.hf) return undefined;
    const sheetIdx = this.getSheetIndex(sheetId);
    if (sheetIdx === undefined) return undefined;
    const formula = this.hf.getCellFormula({ sheet: sheetIdx, row, col });
    return formula ? `=${formula}` : undefined;
  }

  bulkSetSheet(sheetId: string, matrix: (string | number | null)[][]): void {
    if (!this.hf) this.initialize([sheetId]);
    const sheetIdx = this.ensureSheet(sheetId);
    this.hf!.setSheetContent(sheetIdx, matrix);
  }

  getDisplayValue(sheetId: string, row: number, col: number): string {
    const val = this.getCellValue(sheetId, row, col);
    if (val === null || val === undefined) return "";
    if (typeof val === "object" && val !== null && "type" in val) {
      const err = val as { type: string };
      return `#${err.type}`;
    }
    if (typeof val === "number") {
      if (!Number.isFinite(val)) return String(val);
      return String(val);
    }
    if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
    return String(val);
  }

  destroy(): void {
    if (this.hf) {
      this.hf.destroy();
      this.hf = null;
    }
    this.sheetNameMap.clear();
  }

  static formatWithNumberFormat(value: string, format: string, decimals = 2): string {
    const num = parseFloat(value);
    if (isNaN(num) || value === "") return value;
    switch (format) {
      case "currency":
        return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(num);
      case "percent":
        return new Intl.NumberFormat(undefined, { style: "percent", minimumFractionDigits: decimals }).format(num);
      case "decimal":
        return num.toFixed(decimals);
      case "number":
        return new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals }).format(num);
      default:
        return value;
    }
  }
}
