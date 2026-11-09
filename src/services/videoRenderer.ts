import { Panel, ProjectSettings, CameraTransform, SubtitleStyle } from '../types/manhwa';
import { audioEngine } from './audioEngine';
import { requestTtsAudio } from './geminiClient';

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number; // Global time in seconds
  project: ProjectSettings;
  loadedImages: Map<string, HTMLImageElement>;
}

// Easing functions
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easePunch(t: number): number {
  // Snappy punch zoom: slow start, rapid snap, slight overshoot
  return t < 0.7 ? Math.pow(t / 0.7, 3) * 0.9 : 0.9 + Math.sin((t - 0.7) / 0.3 * Math.PI) * 0.15 + (t - 0.7) / 0.3 * 0.1;
}

function interpolateTransform(start: CameraTransform, end: CameraTransform, progress: number, easing: string): CameraTransform {
  let eased = progress;
  if (easing === 'ease-in-out') eased = easeInOutCubic(progress);
  else if (easing === 'ease-out') eased = easeOutQuad(progress);
  else if (easing === 'punch') eased = easePunch(progress);

  return {
    x: start.x + (end.x - start.x) * eased,
    y: start.y + (end.y - start.y) * eased,
    zoom: start.zoom + (end.zoom - start.zoom) * eased,
  };
}

export class VideoRenderer {
  // Calculate total duration across all panels
  getTotalDuration(project: ProjectSettings): number {
    return project.panels.reduce((sum, p) => sum + p.duration, 0);
  }

  // Find panel and local time from global timestamp
  getPanelAtTime(project: ProjectSettings, globalTime: number): { panelIndex: number; panel: Panel; localTime: number; panelStartTime: number } {
    let accumulated = 0;
    for (let i = 0; i < project.panels.length; i++) {
      const p = project.panels[i];
      if (globalTime < accumulated + p.duration || i === project.panels.length - 1) {
        return {
          panelIndex: i,
          panel: p,
          localTime: Math.max(0, globalTime - accumulated),
          panelStartTime: accumulated,
        };
      }
      accumulated += p.duration;
    }
    const lastIdx = Math.max(0, project.panels.length - 1);
    const lastPanel = project.panels[lastIdx];
    return {
      panelIndex: lastIdx,
      panel: lastPanel,
      localTime: lastPanel ? lastPanel.duration : 0,
      panelStartTime: accumulated,
    };
  }

  // Render a single frame onto any canvas
  renderFrame(rc: RenderContext) {
    const { ctx, width, height, time, project, loadedImages } = rc;
    ctx.clearRect(0, 0, width, height);

    // Dark sleek backdrop with subtle animated comic grid / vignette
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    if (project.panels.length === 0) {
      this.drawEmptyState(ctx, width, height);
      return;
    }

    const { panelIndex, panel, localTime } = this.getPanelAtTime(project, time);
    const nextPanel = project.panels[panelIndex + 1];

    // Transition calculation (last 0.4s of the current panel)
    const transitionDuration = 0.4;
    const isTransitioning = nextPanel && (panel.duration - localTime) <= transitionDuration;
    const transitionProgress = isTransitioning ? (transitionDuration - (panel.duration - localTime)) / transitionDuration : 0;

    // Draw main panel with camera transforms
    const img = loadedImages.get(panel.imageUrl);
    if (img && img.complete) {
      this.drawTransformedPanel(ctx, img, panel, localTime, width, height);
    } else {
      this.drawLoadingPanel(ctx, panel, width, height);
    }

    // Apply transition effects if transitioning
    if (isTransitioning && nextPanel) {
      const nextImg = loadedImages.get(nextPanel.imageUrl);
      this.applyTransition(ctx, width, height, panel.transition, transitionProgress, nextImg, nextPanel);
    }

    // Draw Cinematic Letterbox Vignette
    this.drawCinematicVignette(ctx, width, height);

    // Draw Dynamic Subtitles (Karaoke / Mamoru style)
    this.drawSubtitles(ctx, panel, localTime, width, height, project.subtitleStyle);

    // Draw Action SFX overlay or Comic Watermark
    this.drawWatermarkBadge(ctx, width, height, project);
  }

  private drawTransformedPanel(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    panel: Panel,
    localTime: number,
    targetW: number,
    targetH: number
  ) {
    const progress = Math.min(1, Math.max(0, localTime / panel.duration));
    const cam = interpolateTransform(panel.camera.start, panel.camera.end, progress, panel.camera.easing);

    // Screen shake calculation (e.g., around soundEffectTime or shakeTime)
    let shakeX = 0;
    let shakeY = 0;
    let shakeRot = 0;

    const shakeCenter = panel.camera.shakeTime ?? (panel.soundEffectTime || 0.5);
    const shakeDist = Math.abs(localTime - shakeCenter);
    if (shakeDist < 0.35 && panel.camera.shakeIntensity > 0) {
      const decay = 1 - (shakeDist / 0.35);
      const intensity = panel.camera.shakeIntensity * 28 * decay;
      shakeX = (Math.sin(localTime * 120) + Math.cos(localTime * 85)) * intensity;
      shakeY = (Math.cos(localTime * 110) - Math.sin(localTime * 70)) * intensity;
      shakeRot = (Math.sin(localTime * 90) * 0.04) * decay;
    }

    ctx.save();

    // Center pivot
    ctx.translate(targetW / 2 + shakeX, targetH / 2 + shakeY);
    if (shakeRot !== 0) ctx.rotate(shakeRot);

    // Scale
    ctx.scale(cam.zoom, cam.zoom);

    // Target translation
    // cam.x and cam.y are normalized 0 to 1 where 0.5 is image center
    // Cover the canvas dimensions
    const imgRatio = img.width / img.height;
    const canvasRatio = targetW / targetH;
    let renderW = targetW;
    let renderH = targetH;

    if (canvasRatio > imgRatio) {
      renderW = targetW;
      renderH = targetW / imgRatio;
    } else {
      renderH = targetH;
      renderW = targetH * imgRatio;
    }

    // Offset based on normalized camera pos (0.5 is centered)
    const offsetX = (0.5 - cam.x) * (renderW * 0.85);
    const offsetY = (0.5 - cam.y) * (renderH * 0.85);

    ctx.drawImage(
      img,
      -renderW / 2 + offsetX,
      -renderH / 2 + offsetY,
      renderW,
      renderH
    );

    ctx.restore();
  }

  private applyTransition(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    transition: string,
    progress: number,
    nextImg?: HTMLImageElement,
    nextPanel?: Panel
  ) {
    if (!nextImg || !nextImg.complete || !nextPanel) {
      // Fallback simple flash if next image not loaded yet
      const alpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.95, alpha)})`;
      ctx.fillRect(0, 0, width, height);
      return;
    }

    // 1. Comic Book Page Turn / Flip
    if (transition === 'page-turn') {
      ctx.save();
      const curlX = (1 - progress) * width;
      const curlWidth = Math.min(width * 0.25, width * (1 - Math.abs(progress - 0.5) * 1.5));

      // Draw next panel underneath the turning page
      ctx.save();
      ctx.beginPath();
      ctx.rect(curlX, 0, width - curlX, height);
      ctx.clip();
      this.drawTransformedPanel(ctx, nextImg, nextPanel, 0, width, height);
      ctx.restore();

      // Shadow cast by turning page
      const shadowGrad = ctx.createLinearGradient(curlX - 25, 0, curlX + 10, 0);
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(curlX - 25, 0, 35, height);

      // Back of the turning paper page (white paper highlight)
      const pageGrad = ctx.createLinearGradient(curlX - curlWidth, 0, curlX, 0);
      pageGrad.addColorStop(0, '#f8fafc');
      pageGrad.addColorStop(0.85, '#e2e8f0');
      pageGrad.addColorStop(1, '#94a3b8');

      ctx.fillStyle = pageGrad;
      ctx.beginPath();
      ctx.moveTo(curlX, 0);
      ctx.quadraticCurveTo(curlX - curlWidth * 0.8, height * 0.5, curlX - curlWidth, height);
      ctx.lineTo(curlX, height);
      ctx.closePath();
      ctx.fill();

      // Manga page edge line
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.restore();
    }

    // 2. Action Manga Speed Lines Burst
    else if (transition === 'speed-lines') {
      ctx.save();
      // Reveal next panel proportionally
      ctx.globalAlpha = Math.min(1, progress * 1.4);
      this.drawTransformedPanel(ctx, nextImg, nextPanel, 0, width, height);
      ctx.restore();

      // Dynamic radial and horizontal speed lines overlay
      ctx.save();
      const lineAlpha = (1 - Math.abs(progress - 0.5) * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${lineAlpha * 0.95})`;
      ctx.fillStyle = `rgba(0, 0, 0, ${lineAlpha * 0.6})`;

      const cx = width / 2;
      const cy = height / 2;
      const numLines = 48;

      for (let i = 0; i < numLines; i++) {
        const angle = (i / numLines) * Math.PI * 2 + progress * 0.8;
        const length = Math.max(width, height) * 1.2;
        const innerRadius = Math.max(50, (1 - progress) * 240);
        
        const x1 = cx + Math.cos(angle) * innerRadius;
        const y1 = cy + Math.sin(angle) * innerRadius;
        const x2 = cx + Math.cos(angle) * length;
        const y2 = cy + Math.sin(angle) * length;

        ctx.lineWidth = (i % 3 === 0 ? 5 : 2.5);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Manga Ink Splash & Bleed
    else if (transition === 'ink-splash') {
      ctx.save();
      const maxRadius = Math.sqrt(width * width + height * height) * 0.65;
      const currentRadius = maxRadius * Math.pow(progress, 1.4);

      // Create organic ink blot mask
      ctx.beginPath();
      const cx = width / 2;
      const cy = height / 2;
      const numPoints = 28;

      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        // Procedural jagged organic bleed
        const noise = Math.sin(angle * 7 + progress * 10) * 0.22 + Math.cos(angle * 4) * 0.15;
        const r = currentRadius * (1 + noise);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.clip();

      // Next panel revealed inside ink
      this.drawTransformedPanel(ctx, nextImg, nextPanel, 0, width, height);
      ctx.restore();

      // Ink border splatter droplets
      ctx.save();
      ctx.fillStyle = '#09090b';
      const dropletCount = 18;
      for (let d = 0; d < dropletCount; d++) {
        const dAngle = (d / dropletCount) * Math.PI * 2 + d;
        const dDist = currentRadius * (1.1 + (d % 4) * 0.12);
        const dx = cx + Math.cos(dAngle) * dDist;
        const dy = cy + Math.sin(dAngle) * dDist;
        const dropR = Math.max(3, (1 - progress) * 16 * ((d % 3) + 1));

        ctx.beginPath();
        ctx.arc(dx, dy, dropR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 4. Katana Sword Slash (Diagonal Cut with Blade Glint)
    else if (transition === 'diagonal-slash') {
      const splitOffset = progress * width * 0.35;

      // Draw next panel behind
      ctx.save();
      this.drawTransformedPanel(ctx, nextImg, nextPanel, 0, width, height);
      ctx.restore();

      // Half 1: Upper Triangle (slides up-left)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-splitOffset, -splitOffset);
      ctx.lineTo(width - splitOffset, -splitOffset);
      ctx.lineTo(-splitOffset, height - splitOffset);
      ctx.closePath();
      ctx.clip();
      ctx.globalAlpha = Math.max(0, 1 - progress * 1.5);
      // Previous panel drawn
      ctx.drawImage(ctx.canvas, -splitOffset, -splitOffset);
      ctx.restore();

      // Half 2: Lower Triangle (slides down-right)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(width + splitOffset, splitOffset);
      ctx.lineTo(width + splitOffset, height + splitOffset);
      ctx.lineTo(splitOffset, height + splitOffset);
      ctx.closePath();
      ctx.clip();
      ctx.globalAlpha = Math.max(0, 1 - progress * 1.5);
      ctx.drawImage(ctx.canvas, splitOffset, splitOffset);
      ctx.restore();

      // White-hot blade cut line with glint
      ctx.save();
      const cutAlpha = 1 - progress;
      ctx.strokeStyle = `rgba(255, 255, 255, ${cutAlpha})`;
      ctx.lineWidth = 14 * cutAlpha;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 25;

      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(width, 0);
      ctx.stroke();

      // Glint starburst along blade
      if (progress < 0.6) {
        const gx = width * progress * 1.6;
        const gy = height * (1 - progress * 1.6);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(gx, gy, 18 * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 5. Anime Impact White Flash
    else if (transition === 'white-flash') {
      if (progress > 0.4) {
        ctx.save();
        ctx.globalAlpha = (progress - 0.4) / 0.6;
        this.drawTransformedPanel(ctx, nextImg, nextPanel, 0, width, height);
        ctx.restore();
      }

      const flashIntensity = progress < 0.35 
        ? progress / 0.35 
        : Math.max(0, 1 - (progress - 0.35) / 0.65);

      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1.0, flashIntensity * 1.2)})`;
      ctx.fillRect(0, 0, width, height);

      // Starburst rays
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.strokeStyle = `rgba(254, 240, 138, ${flashIntensity * 0.65})`;
      ctx.lineWidth = 8;
      for (let a = 0; a < 8; a++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, Math.max(width, height));
        ctx.stroke();
      }
      ctx.restore();
    }

    // 6. System Window Glitch (Chromatic Aberration)
    else if (transition === 'glitch') {
      if (progress > 0.5) {
        ctx.save();
        ctx.globalAlpha = (progress - 0.5) * 2;
        this.drawTransformedPanel(ctx, nextImg, nextPanel, 0, width, height);
        ctx.restore();
      }

      ctx.save();
      const numSlices = 8;
      for (let i = 0; i < numSlices; i++) {
        const sliceY = (height / numSlices) * i;
        const sliceH = height / numSlices;
        const shiftX = (Math.sin(i * 12 + progress * 20)) * 55 * (1 - progress);
        ctx.drawImage(ctx.canvas, 0, sliceY, width, sliceH, shiftX, sliceY, width, sliceH);
      }
      ctx.fillStyle = `rgba(0, 255, 255, ${progress * 0.2})`;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = `rgba(255, 0, 128, ${(1 - progress) * 0.15})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // 7. Crash Zoom Blur
    else if (transition === 'zoom-blur') {
      ctx.save();
      const zoomProgress = 1 - progress;
      const blurSteps = 4;
      for (let b = 0; b < blurSteps; b++) {
        ctx.save();
        ctx.globalAlpha = (1 / blurSteps) * progress;
        const scale = 1 + zoomProgress * 0.4 * (b / blurSteps);
        ctx.translate(width / 2, height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-width / 2, -height / 2);
        this.drawTransformedPanel(ctx, nextImg, nextPanel, 0, width, height);
        ctx.restore();
      }
      ctx.restore();
    }

    // 8. Kinetic Whip Pan (Slide Left)
    else if (transition === 'slide-left') {
      ctx.save();
      const slideX = (1 - progress) * width;
      ctx.beginPath();
      ctx.rect(slideX, 0, width - slideX, height);
      ctx.clip();
      ctx.translate(slideX, 0);
      this.drawTransformedPanel(ctx, nextImg, nextPanel, 0, width, height);
      ctx.restore();

      // Motion streak border
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(slideX - 4, 0, 4, height);
    }

    // 9. Cinematic Cross-Fade
    else if (transition === 'fade') {
      ctx.save();
      ctx.globalAlpha = progress;
      this.drawTransformedPanel(ctx, nextImg, nextPanel, 0, width, height);
      ctx.restore();
    }

    // 10. Cut (Direct swap)
    else if (transition === 'cut') {
      if (progress >= 0.5) {
        this.drawTransformedPanel(ctx, nextImg, nextPanel, 0, width, height);
      }
    }
  }

  private drawCinematicVignette(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.35,
      width / 2, height / 2, Math.max(width, height) * 0.75
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.7, 'rgba(0,0,0,0.25)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  private drawSubtitles(
    ctx: CanvasRenderingContext2D,
    panel: Panel,
    localTime: number,
    width: number,
    height: number,
    style: ProjectSettings['subtitleStyle']
  ) {
    if (!panel.commentary) return;

    // Merge project default subtitle style with panel's individual custom subtitle style
    const effectiveStyle: SubtitleStyle = {
      ...style,
      ...(panel.subtitleStyle || {}),
    };

    // Determine words and timings
    let words = panel.subtitles;
    if (!words || words.length === 0) {
      // Auto-generate words from commentary
      const rawWords = panel.commentary.split(/\s+/).filter(Boolean);
      const wordDuration = panel.duration / Math.max(1, rawWords.length);
      words = rawWords.map((w, idx) => ({
        text: w,
        startTime: idx * wordDuration,
        endTime: (idx + 1) * wordDuration,
        isPunch: /^[A-Z0-9!]{3,}|bro|wait|dead|what|he|him|fr/i.test(w) || w.includes('!') || w.includes('?'),
      }));
    }

    // Active chunk (display 3 to 6 words at once for snappy reading)
    const activeWordIndex = words.findIndex(w => localTime >= w.startTime && localTime <= w.endTime);
    const targetIdx = activeWordIndex !== -1 ? activeWordIndex : Math.min(words.length - 1, Math.floor((localTime / panel.duration) * words.length));

    // Show window around current word
    const windowSize = 5;
    const startWordIdx = Math.max(0, Math.min(words.length - windowSize, targetIdx - 1));
    const currentBatch = words.slice(startWordIdx, startWordIdx + windowSize);

    if (currentBatch.length === 0) return;

    ctx.save();

    // Scale font size based on 1080p width baseline
    const scaleFactor = width / 1080;
    const baseFontSize = Math.round((effectiveStyle.fontSize || 54) * scaleFactor);
    const fontStyleStr = effectiveStyle.fontStyle === 'italic' ? 'italic ' : '';
    const fontWeightStr = effectiveStyle.fontWeight || '900';
    const fontFamilyStr = effectiveStyle.fontFamily || 'Cabinet Grotesk';

    ctx.font = `${fontStyleStr}${fontWeightStr} ${baseFontSize}px '${fontFamilyStr}', 'Cabinet Grotesk', 'Bangers', 'Montserrat', 'Plus Jakarta Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const posY = (effectiveStyle.positionY / 100) * height;

    // Text casing transform helper
    const transformText = (raw: string) => {
      if (effectiveStyle.textTransform === 'uppercase') return raw.toUpperCase();
      if (effectiveStyle.textTransform === 'capitalize') return raw.charAt(0).toUpperCase() + raw.slice(1);
      return raw;
    };

    // Measure total line width to position words
    const spaceWidth = ctx.measureText(' ').width;
    const wordWidths = currentBatch.map(w => ctx.measureText(transformText(w.text)).width);
    const totalLineWidth = wordWidths.reduce((a, b) => a + b, 0) + spaceWidth * (currentBatch.length - 1);

    // Draw comic backdrop pill for high readability (if enabled)
    if (effectiveStyle.showBackdrop !== false && effectiveStyle.backdropColor !== 'transparent') {
      const pillPaddingX = 24 * scaleFactor;
      const pillPaddingY = 14 * scaleFactor;
      const pillW = totalLineWidth + pillPaddingX * 2;
      const pillH = baseFontSize * 1.5 + pillPaddingY;

      ctx.fillStyle = effectiveStyle.backdropColor || 'rgba(10, 10, 15, 0.82)';
      ctx.strokeStyle = effectiveStyle.highlightColor || '#f59e0b';
      ctx.lineWidth = 3 * scaleFactor;

      // Rounded pill
      const rx = 16 * scaleFactor;
      const px = width / 2 - pillW / 2;
      const py = posY - pillH / 2;
      ctx.beginPath();
      ctx.roundRect(px, py, pillW, pillH, rx);
      ctx.fill();
      ctx.stroke();
    }

    // Shadow configuration
    const hasCustomShadow = effectiveStyle.shadowBlur !== undefined || (effectiveStyle.shadowOffsetX ?? 0) !== 0 || (effectiveStyle.shadowOffsetY ?? 0) !== 0;
    const shadowColor = effectiveStyle.shadowColor || 'rgba(0, 0, 0, 0.9)';
    const shadowBlur = (effectiveStyle.shadowBlur ?? 0) * scaleFactor;
    const shadowOffsetX = (effectiveStyle.shadowOffsetX ?? 0) * scaleFactor;
    const shadowOffsetY = (effectiveStyle.shadowOffsetY ?? 0) * scaleFactor;

    // Draw each word with karaoke styling
    let cursorX = width / 2 - totalLineWidth / 2;

    currentBatch.forEach((w, idx) => {
      const wWidth = wordWidths[idx];
      const wordMidX = cursorX + wWidth / 2;
      const isActive = (startWordIdx + idx) === targetIdx;
      const textToRender = transformText(w.text);

      ctx.save();

      // Setup Shadow effect on text
      if (hasCustomShadow && (shadowBlur > 0 || shadowOffsetX !== 0 || shadowOffsetY !== 0)) {
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetX = shadowOffsetX;
        ctx.shadowOffsetY = shadowOffsetY;
      }

      if (isActive) {
        // Pop-scale on active karaoke word
        ctx.translate(wordMidX, posY);
        ctx.scale(1.18, 1.18);
        ctx.translate(-wordMidX, -posY);

        // Highlight color (e.g. Neon Yellow / Gold)
        ctx.fillStyle = effectiveStyle.highlightColor || '#fbbf24';
        if (!hasCustomShadow) {
          ctx.shadowColor = 'rgba(251, 191, 36, 0.85)';
          ctx.shadowBlur = 18 * scaleFactor;
        }
      } else {
        ctx.fillStyle = effectiveStyle.textColor || '#ffffff';
        if (!hasCustomShadow) {
          ctx.shadowBlur = 0;
        }
      }

      // Stroke outline
      const strokeW = (effectiveStyle.strokeWidth !== undefined ? effectiveStyle.strokeWidth : 6) * scaleFactor;
      if (strokeW > 0) {
        ctx.lineWidth = strokeW;
        ctx.strokeStyle = effectiveStyle.strokeColor || '#000000';
        ctx.lineJoin = 'round';
        ctx.strokeText(textToRender, wordMidX, posY);
      }
      ctx.fillText(textToRender, wordMidX, posY);

      ctx.restore();

      cursorX += wWidth + spaceWidth;
    });

    ctx.restore();
  }

  private drawWatermarkBadge(ctx: CanvasRenderingContext2D, width: number, height: number, project: ProjectSettings) {
    ctx.save();
    const scale = width / 1080;
    ctx.font = `800 ${Math.round(18 * scale)}px 'Cabinet Grotesk', sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('⚡ RECAP STUDIO // 4TH-WALL MODE', 32 * scale, 36 * scale);

    // Audio status indicator badge
    if (project.bgmTrack !== 'none') {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`♫ ${project.bgmTrack.toUpperCase()}`, width - 32 * scale, 36 * scale);
    }
    ctx.restore();
  }

  private drawEmptyState(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save();
    ctx.fillStyle = '#71717a';
    ctx.font = `600 24px 'Plus Jakarta Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No panels loaded. Click "Load Sample Chapter" or upload images.', width / 2, height / 2);
    ctx.restore();
  }

  private drawLoadingPanel(ctx: CanvasRenderingContext2D, panel: Panel, width: number, height: number) {
    ctx.save();
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#e4e4e7';
    ctx.font = `bold 22px 'Plus Jakarta Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Loading panel: ${panel.title || 'Manhwa Panel'}...`, width / 2, height / 2);
    ctx.restore();
  }

  // Preload all panel images into memory
  async preloadImages(panels: Panel[]): Promise<Map<string, HTMLImageElement>> {
    const map = new Map<string, HTMLImageElement>();
    const promises = panels.map((panel) => {
      return new Promise<void>((resolve) => {
        if (!panel.imageUrl) {
          resolve();
          return;
        }
        if (map.has(panel.imageUrl)) {
          resolve();
          return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          map.set(panel.imageUrl, img);
          resolve();
        };
        img.onerror = () => {
          console.warn('Failed to load image for panel:', panel.id);
          resolve();
        };
        img.src = panel.imageUrl;
      });
    });

    await Promise.all(promises);
    return map;
  }

  // High Bitrate 1080p Video Exporter
  async exportVideo1080p(
    project: ProjectSettings,
    options: {
      fps?: number;
      bitrate?: number; // e.g. 14_000_000 for 14 Mbps
      resolution?: '1080x1920' | '1920x1080' | '1080x1080';
      aspectRatio?: '9:16' | '16:9' | '1:1';
      onProgress: (progress: number, currentSec: number, totalSec: number) => void;
      onStatus: (status: string) => void;
    }
  ): Promise<Blob> {
    const { fps = 30, bitrate = 14_000_000, resolution, aspectRatio, onProgress, onStatus } = options;

    onStatus('Preloading high-resolution panels...');
    const loadedImages = await this.preloadImages(project.panels);

    // Pre-synthesize any missing AI voiceover clips so audio track is 100% complete
    const missingPanels = project.panels.filter(p => p.commentary && !p.audioBase64);
    if (missingPanels.length > 0) {
      onStatus(`Synthesizing AI voiceover clips (0/${missingPanels.length})...`);
      let voiceDone = 0;
      for (const panel of project.panels) {
        if (panel.commentary && !panel.audioBase64) {
          voiceDone++;
          onStatus(`🎙️ Synthesizing AI voice (${voiceDone}/${missingPanels.length})...`);
          try {
            const persona = panel.voiceSettings?.voicePersona || project.voicePersona || 'Puck';
            const style = panel.voiceSettings?.stylePrompt || 'Energetic comedic YouTube manhwa recap narrator breaking the fourth wall';
            panel.audioBase64 = await requestTtsAudio(panel.commentary, persona, style);
          } catch (e) {
            console.warn('Voice synthesis error during exportVideo1080p:', e);
          }
        }
      }
    }

    // Determine target dimensions and effective aspect ratio:
    // Support 16:9 Landscape (1920x1080), 9:16 Shorts (1080x1920), or 1:1 Square (1080x1080)
    let width = 1920;
    let height = 1080;
    let effectiveAspectRatio: '9:16' | '16:9' | '1:1' = '16:9';

    if (resolution === '1920x1080' || aspectRatio === '16:9') {
      width = 1920;
      height = 1080;
      effectiveAspectRatio = '16:9';
    } else if (resolution === '1080x1920' || aspectRatio === '9:16') {
      width = 1080;
      height = 1920;
      effectiveAspectRatio = '9:16';
    } else if (resolution === '1080x1080' || aspectRatio === '1:1') {
      width = 1080;
      height = 1080;
      effectiveAspectRatio = '1:1';
    } else {
      // Fallback based on project settings
      const isVertical = project.aspectRatio === '9:16';
      const isSquare = project.aspectRatio === '1:1';
      width = isVertical ? 1080 : (isSquare ? 1080 : 1920);
      height = isVertical ? 1920 : (isSquare ? 1080 : 1080);
      effectiveAspectRatio = project.aspectRatio || (width === 1920 ? '16:9' : '9:16');
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not get 2D context for export canvas');

    const totalDuration = this.getTotalDuration(project);
    if (totalDuration <= 0) throw new Error('Video duration must be greater than 0');

    onStatus('Initializing 1080p high-bitrate recorder...');

    // Video stream from canvas
    const videoStream = exportCanvas.captureStream(fps);

    // Audio stream mixing
    audioEngine.init();
    const dest = audioEngine.getMediaStreamDestination();
    const combinedTracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

    if (dest && dest.stream.getAudioTracks().length > 0) {
      combinedTracks.push(...dest.stream.getAudioTracks());
    }

    const combinedStream = new MediaStream(combinedTracks);

    // Supported mime types with fallback
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
    }

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: bitrate,
    });

    const recordedChunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    recorder.start(100);

    // Start background music and audio engine for export
    if (project.bgmTrack !== 'none') {
      audioEngine.startBgm(project.bgmTrack);
    }
    audioEngine.setVolumes(project.bgmVolume, project.voiceVolume);

    onStatus('Rendering high-bitrate video frames & audio...');

    // Playback and record timeline
    const startTime = performance.now();
    let currentPanelIndex = -1;

    return new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        audioEngine.stopBgm();
        audioEngine.stopVoice();
        const blob = new Blob(recordedChunks, { type: mimeType });
        resolve(blob);
      };

      recorder.onerror = (e) => {
        audioEngine.stopBgm();
        audioEngine.stopVoice();
        reject(e);
      };

      const frameIntervalMs = 1000 / fps;
      let virtualTime = 0;

      const renderInterval = window.setInterval(async () => {
        try {
          if (virtualTime >= totalDuration) {
            clearInterval(renderInterval);
            onStatus('Finalizing video container...');
            setTimeout(() => {
              recorder.stop();
            }, 300);
            return;
          }

          // Check panel switch to trigger SFX / Voice
          const { panelIndex, panel, localTime } = this.getPanelAtTime(project, virtualTime);
          if (panelIndex !== currentPanelIndex) {
            currentPanelIndex = panelIndex;
            // Play sound effect if at start
            if (panel.soundEffect && panel.soundEffect !== 'none') {
              audioEngine.playSoundEffect(panel.soundEffect);
            }
            // Play voiceover if available
            if (panel.audioBase64) {
              audioEngine.duckBgm(true);
              audioEngine.playVoiceBase64(panel.audioBase64, panel.voiceSettings);
            }
          }

          // Render canvas frame
          this.renderFrame({
            canvas: exportCanvas,
            ctx,
            width,
            height,
            time: virtualTime,
            project: {
              ...project,
              aspectRatio: effectiveAspectRatio,
            },
            loadedImages,
          });

          virtualTime += frameIntervalMs / 1000;
          const progress = Math.min(100, Math.round((virtualTime / totalDuration) * 100));
          onProgress(progress, virtualTime, totalDuration);
        } catch (err) {
          clearInterval(renderInterval);
          recorder.stop();
          reject(err);
        }
      }, frameIntervalMs);
    });
  }
}

export const videoRenderer = new VideoRenderer();
