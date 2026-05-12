// lib/editor.js — Canvas + MediaRecorder lightweight video editor.
// Supports: crop to preset, zoom, brightness/contrast (canvas filter),
// sharpen (convolution), trim (start/end), fade in/out, border, text overlay.
// Output: WebM (VP9 if supported, VP8 fallback) using MediaRecorder.

export class Editor {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this._cancel = false;
  }

  cancel() { this._cancel = true; }

  // Preset → target aspect WxH (logical)
  _targetSize(preset, src) {
    if (preset === "9:16")  return { W: 540, H: 960 };
    if (preset === "1:1")   return { W: 720, H: 720 };
    if (preset === "16:9")  return { W: 960, H: 540 };
    // custom = source size
    return { W: src.videoWidth || 720, H: src.videoHeight || 1280 };
  }

  // Returns crop rect from source video into target aspect, with zoom
  _cropRect(srcW, srcH, W, H, zoomPct) {
    const tAr = W / H;
    const sAr = srcW / srcH;
    let cw, ch;
    if (sAr > tAr) { ch = srcH; cw = srcH * tAr; }
    else           { cw = srcW; ch = srcW / tAr; }
    const z = 1 - Math.min(20, Math.max(0, zoomPct || 0)) / 100; // zoom = shrink crop
    cw *= z; ch *= z;
    const cx = (srcW - cw) / 2;
    const cy = (srcH - ch) / 2;
    return { cx, cy, cw, ch };
  }

  _loadVideo(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.crossOrigin = "anonymous";
      v.preload = "auto";
      v.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:2px;height:2px;opacity:0;pointer-events:none";
      v.src = url;
      v.onloadedmetadata = () => { document.body.appendChild(v); resolve(v); };
      v.onerror = () => reject(new Error("Cannot load video " + file.name));
    });
  }

  async preview(file, opts) {
    this._cancel = false;
    const v = await this._loadVideo(file);
    const { W, H } = this._targetSize(opts.preset, v);
    this.canvas.width = W; this.canvas.height = H;
    v.currentTime = Math.max(0, opts.trimStart || 0);
    await new Promise(r => v.onseeked = r);
    this._drawFrame(v, opts);
  }

  _drawFrame(v, opts) {
    const W = this.canvas.width, H = this.canvas.height;
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0,0,W,H);
    // Filters: brightness & contrast via CSS filter on canvas
    const b = 100 + (opts.brightness || 0);
    const c = 100 + (opts.contrast || 0);
    ctx.filter = `brightness(${b}%) contrast(${c}%)`;
    const r = this._cropRect(v.videoWidth, v.videoHeight, W, H, opts.zoom);
    ctx.drawImage(v, r.cx, r.cy, r.cw, r.ch, 0, 0, W, H);
    ctx.filter = "none";

    // Sharpen via convolution-like overlay (lightweight approximation)
    if (opts.sharpen && opts.sharpen !== "off") {
      this._applySharpen(opts.sharpen === "medium" ? 0.6 : 0.3);
    }
    // Border
    if (opts.border && opts.border > 0) {
      ctx.strokeStyle = "#000"; ctx.lineWidth = opts.border;
      ctx.strokeRect(opts.border/2, opts.border/2, W - opts.border, H - opts.border);
    }
    // Overlay text
    if (opts.overlay && opts.overlay.trim()) {
      ctx.font = `${Math.round(W/22)}px Sora, sans-serif`;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      const tw = ctx.measureText(opts.overlay).width + 24;
      ctx.fillRect((W - tw)/2, H - 100, tw, 60);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(opts.overlay, W/2, H - 70);
    }
    ctx.restore();
  }

  _applySharpen(strength) {
    const W = this.canvas.width, H = this.canvas.height;
    const ctx = this.ctx;
    const src = ctx.getImageData(0,0,W,H);
    const dst = ctx.createImageData(W,H);
    const sd = src.data, dd = dst.data;
    const k = [0,-1,0,-1,5,-1,0,-1,0];
    const blend = Math.min(1, Math.max(0, strength));
    for (let y = 1; y < H-1; y++) {
      for (let x = 1; x < W-1; x++) {
        const o = (y*W + x)*4;
        for (let c = 0; c < 3; c++) {
          let v = 0, ki = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const oo = ((y+ky)*W + (x+kx))*4 + c;
              v += sd[oo] * k[ki++];
            }
          }
          dd[o+c] = Math.max(0, Math.min(255, sd[o+c]*(1-blend) + v*blend));
        }
        dd[o+3] = 255;
      }
    }
    ctx.putImageData(dst, 0, 0);
  }

  async export(file, opts, onProgress) {
    this._cancel = false;
    const v = await this._loadVideo(file);
    const { W, H } = this._targetSize(opts.preset, v);
    this.canvas.width = W; this.canvas.height = H;
    const fps = 30;
    const start = Math.max(0, opts.trimStart || 0);
    const end   = opts.trimEnd && opts.trimEnd > start ? opts.trimEnd : v.duration;
    const dur   = Math.max(0.1, end - start);

    // MediaRecorder on canvas.captureStream
    const stream = this.canvas.captureStream(fps);
    let mime = "video/webm;codecs=vp9";
    if (!MediaRecorder.isTypeSupported(mime)) mime = "video/webm;codecs=vp8";
    if (!MediaRecorder.isTypeSupported(mime)) mime = "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(res => rec.onstop = res);
    rec.start(250);

    return new Promise(async (resolve, reject) => {
      try {
        v.currentTime = start;
        await new Promise(r => v.onseeked = r);
        await v.play().catch(()=>{});

        const t0 = performance.now();
        const fadeIn = opts.fade || 0, fadeOut = opts.fade || 0;
        const render = () => {
          if (this._cancel) { rec.stop(); reject(new Error("cancelled")); return; }
          const t = v.currentTime - start;
          if (t >= dur || v.ended) {
            rec.stop(); return;
          }
          this._drawFrame(v, opts);
          // Fade overlay
          if (fadeIn && t < fadeIn) {
            const a = 1 - (t / fadeIn);
            this.ctx.fillStyle = `rgba(0,0,0,${a})`;
            this.ctx.fillRect(0,0,W,H);
          } else if (fadeOut && (dur - t) < fadeOut) {
            const a = 1 - ((dur - t) / fadeOut);
            this.ctx.fillStyle = `rgba(0,0,0,${a})`;
            this.ctx.fillRect(0,0,W,H);
          }
          onProgress && onProgress(Math.min(1, t / dur));
          requestAnimationFrame(render);
        };
        render();
        await stopped;
        const blob = new Blob(chunks, { type: mime });
        resolve(blob);
      } catch (e) { reject(e); }
    });
  }
}
