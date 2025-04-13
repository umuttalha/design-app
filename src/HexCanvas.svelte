<script>
    import { onMount } from 'svelte';
    import { cameraX, cameraY, scale, selectedSegments } from './stores.js';
    import { get } from 'svelte/store';
    import { hexToPixel, pixelToHex, roundAxial, makeFullHex } from './hex.js';
  
    let canvas, ctx;
  
    const HEX_SIZE   = 40;    // how big each hex (outer radius in px)
    const DRAW_RANGE = 15;    // how many hexes in each direction
    const INCLUDE_CENTER = true;  
    // set false if you DON’T want lines from center→corners/midpoints
  
    // Precompute the local geometry once (radius=1 in local space).
    const fullHex = makeFullHex(INCLUDE_CENTER);
  
    // For each cell, we’ll scale & offset that local geometry by HEX_SIZE + (cx, cy).
    function cellSegments(q, r) {
      const cxy = hexToPixel(q, r, HEX_SIZE);
      return fullHex.segments.map(([p1, p2]) => {
        const x1 = cxy.x + p1.x * HEX_SIZE;
        const y1 = cxy.y + p1.y * HEX_SIZE;
        const x2 = cxy.x + p2.x * HEX_SIZE;
        const y2 = cxy.y + p2.y * HEX_SIZE;
        // build a key that identifies this line in that cell
        const key = `(${q},${r}):[${p1.x.toFixed(2)},${p1.y.toFixed(2)}]->[${p2.x.toFixed(2)},${p2.y.toFixed(2)}]`;
        return { x1, y1, x2, y2, key };
      });
    }
  
    // main drawing
    function draw() {
      const w = canvas.width  = canvas.clientWidth;
      const h = canvas.height = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
  
      ctx.save();
      ctx.translate(get(cameraX), get(cameraY));
      ctx.scale(get(scale), get(scale));
  
      const sel = get(selectedSegments);
  
      for (let q = -DRAW_RANGE; q <= DRAW_RANGE; q++) {
        for (let r = -DRAW_RANGE; r <= DRAW_RANGE; r++) {
          const segs = cellSegments(q, r);
          for (const seg of segs) {
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
  
            const isSel = sel.has(seg.key);
            ctx.strokeStyle = isSel ? '#f33' : '#555';
            ctx.lineWidth   = isSel ? (3 / get(scale)) : (1 / get(scale));
            ctx.stroke();
          }
        }
      }
  
      ctx.restore();
    }
  
    // onMount
    onMount(() => {
      ctx = canvas.getContext('2d');
      draw();
  
      const unsub = [
        cameraX.subscribe(draw),
        cameraY.subscribe(draw),
        scale.subscribe(draw),
        selectedSegments.subscribe(draw),
      ];
      return () => unsub.forEach(u => u());
    });
  
    // pan & zoom
    let dragging = false, lastX, lastY;
    function mDown(e) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
    function mMove(e) {
      if (!dragging) return;
      cameraX.update(cx => cx + (e.clientX - lastX));
      cameraY.update(cy => cy + (e.clientY - lastY));
      lastX = e.clientX;
      lastY = e.clientY;
    }
    function mUp() {
      dragging = false;
    }
    function wheel(e) {
      e.preventDefault();
      const oldScale = get(scale);
      let newScale = oldScale * (e.deltaY < 0 ? 1.1 : 0.9);
      newScale = Math.min(Math.max(newScale, 0.2), 5);
  
      // zoom around mouse
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      // convert screen→world
      const wx = (sx - get(cameraX)) / oldScale;
      const wy = (sy - get(cameraY)) / oldScale;
      scale.set(newScale);
      cameraX.set(sx - wx * newScale);
      cameraY.set(sy - wy * newScale);
    }
  
    // click to toggle nearest segment
    function click(e) {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const s  = get(scale);
  
      // screen -> world
      const wx = (sx - get(cameraX)) / s;
      const wy = (sy - get(cameraY)) / s;
  
      let nearestKey = null;
      let nearestDist = 6; // px tolerance
      for (let q = -DRAW_RANGE; q <= DRAW_RANGE; q++) {
        for (let r = -DRAW_RANGE; r <= DRAW_RANGE; r++) {
          const segs = cellSegments(q, r);
          for (const seg of segs) {
            const d = pointToSegmentDist(wx, wy, seg.x1, seg.y1, seg.x2, seg.y2);
            if (d < nearestDist) {
              nearestDist = d;
              nearestKey  = seg.key;
            }
          }
        }
      }
  
      if (nearestKey) {
        selectedSegments.update(old => {
          const copy = new Set(old);
          copy.has(nearestKey) ? copy.delete(nearestKey) : copy.add(nearestKey);
          return copy;
        });
      }
    }
  
    // distance from point(px,py) to line segment(x1,y1 -> x2,y2)
    function pointToSegmentDist(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1, dy = y2 - y1;
      if (dx === 0 && dy === 0) {
        return Math.hypot(px - x1, py - y1);
      }
      let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
      t = Math.max(0, Math.min(1, t));
      const cx = x1 + t * dx, cy = y1 + t * dy;
      return Math.hypot(px - cx, py - cy);
    }
  
    // ---- Save as PNG & JPEG code ----
    // This function creates a temporary anchor element to trigger the download.
    function saveAs(filename, type) {
      // Get a data URL representing the content of the canvas
      const dataURL = canvas.toDataURL(type);
      // Create a temporary link element
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  
    function saveAsPng() {
      saveAs('hex-canvas.png', 'image/png');
    }
  
    function saveAsJpeg() {
      saveAs('hex-canvas.jpeg', 'image/jpeg');
    }
  </script>
  
  <style>
    canvas {
      width: 100%;
      height: 100%;
      display: block;
      cursor: grab;
    }
    canvas:active {
      cursor: grabbing;
    }
    /* Optional: style the save buttons */
    .save-buttons {
      position: fixed;
      bottom: 10px;
      left: 10px;
      z-index: 10;
      background-color: rgba(52, 33, 33, 0.351);
      border-radius: 4px;
      padding: 8px;
    }
    .save-buttons button {
      margin-right: 8px;
      padding: 6px 12px;
      font-size: 14px;
      cursor: pointer;
    }
  </style>
  
  <!-- Canvas element -->
  <canvas
    bind:this={canvas}
    on:mousedown={mDown}
    on:mousemove={mMove}
    on:mouseup={mUp}
    on:mouseleave={mUp}
    on:wheel={wheel}
    on:click={click}
  >
  
  </canvas>

  <!-- Save buttons -->
  <div class="save-buttons">
    <button on:click={saveAsPng}>Save as PNG</button>
    <button on:click={saveAsJpeg}>Save as JPEG</button>
  </div>
  