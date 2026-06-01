import powerbi from "powerbi-visuals-api";
import DataView = powerbi.DataView;
import DataViewTable = powerbi.DataViewTable;
import DataViewCategorical = powerbi.DataViewCategorical;

export interface BoundRow {
  values: (string | number | boolean | null)[];
}

export interface BoundDataset {
  headers: string[];
  rows: BoundRow[];
  categoryLabels: string[];
}

export class PowerBIDataBinder {
  static extract(dataView: DataView | undefined): BoundDataset | null {
    if (!dataView) return null;

    const table = dataView.table as DataViewTable | undefined;
    if (table && table.rows && table.rows.length > 0) {
      const headers = (table.columns || []).map((c) => String(c.displayName || c.queryName || ""));
      const rows: BoundRow[] = table.rows.map((row) => ({
        values: row.map((v) => PowerBIDataBinder.coerceValue(v))
      }));
      return { headers, rows, categoryLabels: [] };
    }

    const categorical = dataView.categorical as DataViewCategorical | undefined;
    if (categorical && categorical.categories && categorical.categories.length > 0) {
      const cat = categorical.categories[0];
      const catValues = cat.values || [];
      const categoryLabels = catValues.map((v) => String(v ?? ""));

      const valueGroups = categorical.values || [];
      const headers: string[] = valueGroups.map((vg, i) => {
        const meta = vg.source;
        return String(meta?.displayName || meta?.queryName || `Value ${i + 1}`);
      });

      if (headers.length === 0 && categorical.categories.length > 1) {
        categorical.categories.forEach((c, i) => {
          headers.push(String(c.source?.displayName || `Category ${i + 1}`));
        });
      }

      const rowCount = categoryLabels.length;
      const rows: BoundRow[] = [];
      for (let r = 0; r < rowCount; r++) {
        const values: (string | number | boolean | null)[] = [];
        valueGroups.forEach((vg) => {
          const val = vg.values?.[r];
          values.push(PowerBIDataBinder.coerceValue(val));
        });
        if (values.length === 0) {
          categorical.categories.forEach((c) => {
            values.push(PowerBIDataBinder.coerceValue(c.values?.[r]));
          });
        }
        rows.push({ values });
      }

      if (headers.length === 0) headers.push("Category");
      return { headers, rows, categoryLabels };
    }

    return null;
  }

  private static coerceValue(v: unknown): string | number | boolean | null {
    if (v === null || v === undefined) return null;
    if (typeof v === "number" || typeof v === "boolean") return v;
    if (typeof v === "string") return v;
    if (typeof v === "object" && v !== null && "value" in v) {
      return PowerBIDataBinder.coerceValue((v as { value: unknown }).value);
    }
    return String(v);
  }

  static toMatrix(dataset: BoundDataset, includeCategoryCol = true): (string | number | null)[][] {
    const matrix: (string | number | null)[][] = [];
    const headerRow: (string | number | null)[] = [];
    if (includeCategoryCol && dataset.categoryLabels.length > 0) {
      headerRow.push("Category");
    }
    dataset.headers.forEach((h) => headerRow.push(h));
    matrix.push(headerRow);

    dataset.rows.forEach((row, i) => {
      const dataRow: (string | number | null)[] = [];
      if (includeCategoryCol && dataset.categoryLabels.length > 0) {
        dataRow.push(dataset.categoryLabels[i] ?? "");
      }
      row.values.forEach((v) => {
        if (v === null) dataRow.push("");
        else if (typeof v === "boolean") dataRow.push(v ? "TRUE" : "FALSE");
        else dataRow.push(v);
      });
      matrix.push(dataRow);
    });
    return matrix;
  }
}
