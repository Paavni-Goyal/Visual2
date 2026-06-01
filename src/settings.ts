import powerbi from "powerbi-visuals-api";
import { VisualSettings } from "./types";

export function parseVisualSettings(dataView: powerbi.DataView | undefined): VisualSettings {
  const defaults: VisualSettings = {
    themeMode: "auto",
    accentColor: "#217346",
    defaultRowCount: 100,
    defaultColCount: 26,
    showGridLines: true,
    showRibbon: true
  };

  if (!dataView?.metadata?.objects) return defaults;
  const objects = dataView.metadata.objects;

  if (objects.theme) {
    const t = objects.theme as { mode?: { value?: string }; accentColor?: { solid?: { color?: string } } };
    if (t.mode?.value) defaults.themeMode = t.mode.value as VisualSettings["themeMode"];
    if (t.accentColor?.solid?.color) defaults.accentColor = t.accentColor.solid.color;
  }
  if (objects.grid) {
    const g = objects.grid as { defaultRowCount?: number; defaultColCount?: number; showGridLines?: boolean };
    if (g.defaultRowCount) defaults.defaultRowCount = g.defaultRowCount;
    if (g.defaultColCount) defaults.defaultColCount = g.defaultColCount;
    if (g.showGridLines !== undefined) defaults.showGridLines = g.showGridLines;
  }
  if (objects.ribbon) {
    const r = objects.ribbon as { showRibbon?: boolean };
    if (r.showRibbon !== undefined) defaults.showRibbon = r.showRibbon;
  }

  return defaults;
}
