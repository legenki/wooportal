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
  // Desaturated, near-monochrome blue-grey. R/G/B kept close together so the
  // hue reads as a soft slate rather than vivid blue.
  return {
    ocean1: '#e3e9ef', ocean2: '#ccd5de',
    land: '#a3afb9', land2: '#929fab',
    gratStroke: 'rgba(140,155,170,0.22)',
    fog1: 'rgba(255,255,255,0)', fog2: 'rgba(255,255,255,0.60)',
    atmo1: 'rgba(150,175,200,0)', atmo2: 'rgba(150,175,200,0.22)',
    specular: 'rgba(255,255,255,0.10)',
    border: 'rgba(165,180,195,0.45)',
  };
}

function darkColors(): GlobeColors {
  // Desaturated slate; channels close together for a monochrome feel.
  return {
    ocean1: '#1a2026', ocean2: '#11161b',
    land: '#2c353d', land2: '#353f48',
    gratStroke: 'rgba(90,105,120,0.28)',
    fog1: 'rgba(13,17,23,0)', fog2: 'rgba(13,17,23,0.70)',
    atmo1: 'rgba(120,145,170,0)', atmo2: 'rgba(120,145,170,0.18)',
    specular: 'rgba(255,255,255,0.06)',
    border: 'rgba(130,150,170,0.30)',
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
  private startRotation: [number, number, number] = [0, 0, 0];
  private targetRotation: [number, number, number] = [0, 0, 0];
  private animId: number | null = null;
  private animStart: number | null = null;
  private readonly ANIM_DURATION = 900; // ms

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
    if (this.animId) cancelAnimationFrame(this.animId);
    this.startRotation = [...this.rotation];
    this.targetRotation = [-lon, -lat * 0.28, 0];
    this.animStart = null;
    this.animId = requestAnimationFrame(t => this.animStep(t));
  }

  private lerpAngle(a: number, b: number, t: number): number {
    const d = ((b - a) % 360 + 540) % 360 - 180;
    return a + d * t;
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private animStep(time: number): void {
    if (!this.animStart) this.animStart = time;
    const elapsed = time - this.animStart;
    const progress = Math.min(elapsed / this.ANIM_DURATION, 1);
    const eased = this.easeOutCubic(progress);

    for (let i = 0; i < 3; i++) {
      this.rotation[i] = this.lerpAngle(this.startRotation[i], this.targetRotation[i], eased);
    }

    this.proj.rotate(this.rotation);
    this.draw();

    if (progress < 1) {
      this.animId = requestAnimationFrame(t => this.animStep(t));
    } else {
      this.rotation = [...this.targetRotation];
      this.proj.rotate(this.rotation);
      this.draw();
      this.animId = null;
      this.animStart = null;
    }
  }

  destroy(): void {
    if (this.animId) cancelAnimationFrame(this.animId);
  }
}
