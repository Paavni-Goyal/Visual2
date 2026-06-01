import { ChartConfig } from "../types";

export class ChartManager {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(config: ChartConfig, labels: string[], values: number[]): void {
    this.container.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "esp-chart-wrapper";
    const title = document.createElement("div");
    title.className = "esp-chart-title";
    title.textContent = config.title;
    wrapper.appendChild(title);

    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 200;
    wrapper.appendChild(canvas);
    this.container.appendChild(wrapper);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isDark = document.body.classList.contains("esp-dark");
    const textColor = isDark ? "#e8eaed" : "#1a1a2e";
    const gridColor = isDark ? "#3d4451" : "#e0e4ea";
    const colors = ["#217346", "#2b6cb0", "#c05621", "#9f7aea", "#e53e3e", "#38b2ac"];

    ctx.fillStyle = isDark ? "#252830" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (config.type === "pie") {
      this.drawPie(ctx, values, labels, colors, textColor);
    } else if (config.type === "line") {
      this.drawLine(ctx, values, labels, colors[0], gridColor, textColor);
    } else {
      this.drawBar(ctx, values, labels, colors, gridColor, textColor);
    }
  }

  private drawBar(
    ctx: CanvasRenderingContext2D,
    values: number[],
    labels: string[],
    colors: string[],
    gridColor: string,
    textColor: string
  ): void {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const pad = { l: 40, r: 16, t: 24, b: 36 };
    const max = Math.max(...values, 1);
    const barW = (w - pad.l - pad.r) / values.length - 8;

    ctx.strokeStyle = gridColor;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, h - pad.b);
    ctx.lineTo(w - pad.r, h - pad.b);
    ctx.stroke();

    values.forEach((v, i) => {
      const barH = ((h - pad.t - pad.b) * v) / max;
      const x = pad.l + i * (barW + 8) + 4;
      const y = h - pad.b - barH;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(x, y, barW, barH);
      ctx.fillStyle = textColor;
      ctx.font = "10px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(labels[i]?.slice(0, 8) || String(i + 1), x + barW / 2, h - pad.b + 14);
    });
  }

  private drawLine(
    ctx: CanvasRenderingContext2D,
    values: number[],
    labels: string[],
    color: string,
    gridColor: string,
    textColor: string
  ): void {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const pad = { l: 40, r: 16, t: 24, b: 36 };
    const max = Math.max(...values, 1);

    ctx.strokeStyle = gridColor;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, h - pad.b);
    ctx.lineTo(w - pad.r, h - pad.b);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad.l + (i / Math.max(values.length - 1, 1)) * (w - pad.l - pad.r);
      const y = h - pad.b - ((h - pad.t - pad.b) * v) / max;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.fillStyle = textColor;
    ctx.font = "10px Segoe UI, sans-serif";
    labels.forEach((lb, i) => {
      const x = pad.l + (i / Math.max(labels.length - 1, 1)) * (w - pad.l - pad.r);
      ctx.textAlign = "center";
      ctx.fillText(lb?.slice(0, 6) || "", x, h - pad.b + 14);
    });
  }

  private drawPie(
    ctx: CanvasRenderingContext2D,
    values: number[],
    labels: string[],
    colors: string[],
    textColor: string
  ): void {
    const cx = ctx.canvas.width / 2;
    const cy = ctx.canvas.height / 2 - 10;
    const r = Math.min(cx, cy) - 30;
    const total = values.reduce((a, b) => a + b, 0) || 1;
    let angle = -Math.PI / 2;

    values.forEach((v, i) => {
      const slice = (v / total) * Math.PI * 2;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + slice);
      ctx.closePath();
      ctx.fill();
      angle += slice;
    });

    ctx.fillStyle = textColor;
    ctx.font = "11px Segoe UI, sans-serif";
    ctx.textAlign = "left";
    labels.forEach((lb, i) => {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(16, 16 + i * 16, 10, 10);
      ctx.fillStyle = textColor;
      ctx.fillText(`${lb}: ${values[i]}`, 32, 25 + i * 16);
    });
  }

  clear(): void {
    this.container.innerHTML = "";
  }
}
