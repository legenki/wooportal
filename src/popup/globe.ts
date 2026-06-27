import { geoOrthographic, geoPath, geoGraticule, type GeoPath, type GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeoPermissibleObjects } from 'd3-geo';

interface GlobeColors {
  ocean1: string; ocean2: string;
  land: string; land2: string;
  gratStroke: string;
  fog1: string; fog2: string;
  atmo1: string; atmo2: string;
  specular: string;
  border: string;
}

function lightColors(): GlobeColors {
  return {
    ocean1: '#d6e8f7', ocean2: '#bad4ed',
    land: '#8baabf', land2: '#7595ae',
    gratStroke: 'rgba(100,150,190,0.25)',
    fog1: 'rgba(255,255,255,0)', fog2: 'rgba(255,255,255,0.65)',
    atmo1: 'rgba(100,160,240,0)', atmo2: 'rgba(100,160,240,0.22)',
    specular: 'rgba(255,255,255,0.10)',
    border: 'rgba(130,175,220,0.5)',
  };
}

function darkColors(): GlobeColors {
  return {
    ocean1: '#0d1b2a', ocean2: '#08111c',
    land: '#1e3448', land2: '#243d54',
    gratStroke: 'rgba(30,80,140,0.3)',
    fog1: 'rgba(13,17,23,0)', fog2: 'rgba(13,17,23,0.72)',
    atmo1: 'rgba(40,100,220,0)', atmo2: 'rgba(40,100,220,0.18)',
    specular: 'rgba(255,255,255,0.06)',
    border: 'rgba(60,130,220,0.25)',
  };
}

export class Globe {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private proj: GeoProjection;
  private pathGen: GeoPath;
  private graticule: GeoPermissibleObjects;
  private land: GeoPermissibleObjects | null = null;
  private rotation: [number, number, number] = [0, 0, 0];
  private targetRotation: [number, number, number] = [0, 0, 0];
  private animId: number | null = null;
  private lastTime: number | null = null;

  private readonly DPR: number;
  private readonly W: number;
  private readonly CX: number;
  private readonly CY: number;
  private readonly R: number;

  onDotPosition?: (x: number, y: number) => void;

  constructor(canvas: HTMLCanvasElement, displaySize: number = 200) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.DPR = Math.min(window.devicePixelRatio || 2, 3);
    this.W = displaySize * this.DPR;
    this.CX = this.W / 2;
    this.CY = this.W / 2;
    this.R = this.CX * 0.92;

    canvas.width = this.W;
    canvas.height = this.W;

    this.proj = geoOrthographic()
      .scale(this.R)
      .translate([this.CX, this.CY])
      .rotate(this.rotation)
      .clipAngle(90)
      .precision(0.8);

    this.pathGen = geoPath(this.proj, this.ctx);
    this.graticule = geoGraticule().step([30, 30])();
  }

  async loadData(topoUrl: string): Promise<void> {
    const res = await fetch(topoUrl);
    const world = await res.json();
    this.land = feature(world, world.objects.land) as unknown as GeoPermissibleObjects;
    this.draw();
  }

  private colors(): GlobeColors {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? darkColors() : lightColors();
  }

  draw(): void {
    if (!this.land) return;
    const { ctx, CX, CY, R, proj, pathGen } = this;
    const c = this.colors();

    ctx.clearRect(0, 0, this.W, this.W);

    // Ocean
    const og = ctx.createRadialGradient(CX - R * 0.25, CY - R * 0.22, 0, CX, CY, R);
    og.addColorStop(0, c.ocean1); og.addColorStop(1, c.ocean2);
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.fillStyle = og; ctx.fill();

    // Graticule
    ctx.beginPath(); pathGen(this.graticule);
    ctx.strokeStyle = c.gratStroke; ctx.lineWidth = 0.8; ctx.stroke();

    // Land
    const lg = ctx.createRadialGradient(CX - R * 0.2, CY - R * 0.2, 0, CX, CY, R * 0.9);
    lg.addColorStop(0, c.land); lg.addColorStop(1, c.land2);
    ctx.beginPath(); pathGen(this.land);
    ctx.fillStyle = lg; ctx.fill();
    ctx.strokeStyle = c.specular; ctx.lineWidth = 0.7; ctx.stroke();

    // Fog (sphere depth)
    const fg = ctx.createRadialGradient(CX, CY, R * 0.55, CX, CY, R);
    fg.addColorStop(0, c.fog1); fg.addColorStop(1, c.fog2);
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.fillStyle = fg; ctx.fill();

    // Atmosphere
    const ag = ctx.createRadialGradient(CX, CY, R * 0.88, CX, CY, R * 1.08);
    ag.addColorStop(0, c.atmo2); ag.addColorStop(1, c.atmo1);
    ctx.beginPath(); ctx.arc(CX, CY, R * 1.06, 0, Math.PI * 2);
    ctx.fillStyle = ag; ctx.fill();

    // Specular highlight
    const sg = ctx.createRadialGradient(CX - R * 0.3, CY - R * 0.32, 0, CX - R * 0.1, CY - R * 0.1, R * 0.7);
    sg.addColorStop(0, 'rgba(255,255,255,0.10)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.03)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.fillStyle = sg; ctx.fill();

    // Border
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.strokeStyle = c.border; ctx.lineWidth = 1.5; ctx.stroke();

    // Dot position callback — project target onto sphere
    const dot = proj([-(this.targetRotation[0]), -(this.targetRotation[1] / 0.28)]);
    if (dot && this.onDotPosition) {
      const displayScale = (this.canvas.offsetWidth || this.W / this.DPR) / this.W;
      this.onDotPosition(dot[0] * displayScale, dot[1] * displayScale);
    }
  }

  rotateTo(lon: number, lat: number): void {
    this.targetRotation = [-lon, -lat * 0.28, 0];
    if (this.animId) cancelAnimationFrame(this.animId);
    this.lastTime = null;
    this.animId = requestAnimationFrame(t => this.animStep(t));
  }

  private lerpAngle(a: number, b: number, t: number): number {
    const d = ((b - a) % 360 + 540) % 360 - 180;
    return a + d * t;
  }

  private animStep(time: number): void {
    if (!this.lastTime) this.lastTime = time;
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    const factor = Math.min(dt * 7, 1);
    let settled = true;
    for (let i = 0; i < 3; i++) {
      const next = this.lerpAngle(this.rotation[i], this.targetRotation[i], factor);
      if (Math.abs(next - this.rotation[i]) > 0.01) settled = false;
      this.rotation[i] = next;
    }

    this.proj.rotate(this.rotation);
    this.draw();

    if (!settled) {
      this.animId = requestAnimationFrame(t => this.animStep(t));
    } else {
      this.rotation = [...this.targetRotation];
      this.proj.rotate(this.rotation);
      this.draw();
      this.animId = null;
      this.lastTime = null;
    }
  }

  destroy(): void {
    if (this.animId) cancelAnimationFrame(this.animId);
  }
}
