<script>
    import { onMount } from 'svelte';
    import { cameraX, cameraY, scale, selectedSegments } from './stores.js';
    import { get } from 'svelte/store';
    import { hexToPixel, pixelToHex, roundAxial, makeFullHex } from './hex.js';
  
    let canvas, ctx;
  
    const HEX_SIZE   = 40;    // how big each hex (outer radius in px)
    const INCLUDE_CENTER = true;  
    // set false if you DON'T want lines from center→corners/midpoints
  
    // Precompute the local geometry once (radius=1 in local space).
    const fullHex = makeFullHex(INCLUDE_CENTER);

    // Calculate how many hexes we need to draw to fill the viewport (for infinite background)
    function calculateDrawRange(canvasWidth, canvasHeight, currentScale, camX, camY) {
      // Calculate the visible world space bounds
      const worldLeft = (0 - camX) / currentScale;
      const worldTop = (0 - camY) / currentScale;
      const worldRight = (canvasWidth - camX) / currentScale;
      const worldBottom = (canvasHeight - camY) / currentScale;

      // Convert world bounds to hex coordinates
      const topLeft = pixelToHex(worldLeft, worldTop, HEX_SIZE);
      const topRight = pixelToHex(worldRight, worldTop, HEX_SIZE);
      const bottomLeft = pixelToHex(worldLeft, worldBottom, HEX_SIZE);
      const bottomRight = pixelToHex(worldRight, worldBottom, HEX_SIZE);

      // Find the min/max hex coordinates that cover the viewport (with buffer)
      const minQ = Math.floor(Math.min(topLeft.q, topRight.q, bottomLeft.q, bottomRight.q)) - 2;
      const maxQ = Math.ceil(Math.max(topLeft.q, topRight.q, bottomLeft.q, bottomRight.q)) + 2;
      const minR = Math.floor(Math.min(topLeft.r, topRight.r, bottomLeft.r, bottomRight.r)) - 2;
      const maxR = Math.ceil(Math.max(topLeft.r, topRight.r, bottomLeft.r, bottomRight.r)) + 2;

      return { minQ, maxQ, minR, maxR };
    }

    // For each cell, we'll scale & offset that local geometry by HEX_SIZE + (cx, cy).
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
      if (!canvas || !ctx) return; // Guard against early calls
      const w = canvas.width  = canvas.clientWidth;
      const h = canvas.height = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
  
      ctx.save();
      const currentScale = get(scale);
      const camX = get(cameraX);
      const camY = get(cameraY);

      ctx.translate(camX, camY);
      ctx.scale(currentScale, currentScale);

      const sel = get(selectedSegments);

      // Calculate dynamic draw range for infinite background
      const { minQ, maxQ, minR, maxR } = calculateDrawRange(w, h, currentScale, camX, camY);

      // Use a Set to track already-drawn edges and prevent overlap
      const drawnEdges = new Set();

      for (let q = minQ; q <= maxQ; q++) {
        for (let r = minR; r <= maxR; r++) {
          const segs = cellSegments(q, r);
          for (const seg of segs) {
            // Create a normalized edge key (same for both hexes sharing this edge)
            // Round to 2 decimal places to handle floating point precision
            const x1 = Math.round(seg.x1 * 100) / 100;
            const y1 = Math.round(seg.y1 * 100) / 100;
            const x2 = Math.round(seg.x2 * 100) / 100;
            const y2 = Math.round(seg.y2 * 100) / 100;

            // Always put the "smaller" point first for consistent edge keys
            const edgeKey = (x1 < x2 || (x1 === x2 && y1 < y2))
              ? `${x1},${y1}-${x2},${y2}`
              : `${x2},${y2}-${x1},${y1}`;

            // Skip if this edge was already drawn
            if (drawnEdges.has(edgeKey)) continue;
            drawnEdges.add(edgeKey);

            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);

            const isSel = sel.has(seg.key);
            ctx.strokeStyle = isSel ? '#f33' : '#555';
            ctx.lineWidth   = isSel ? (3 / currentScale) : (1 / currentScale);
            ctx.stroke();
          }
        }
      }

      ctx.restore();
    }
  
    // onMount
    onMount(() => {
      ctx = canvas.getContext('2d');
      // Ensure initial draw happens after canvas dimensions are set
      requestAnimationFrame(draw);
  
      const unsub = [
        cameraX.subscribe(draw),
        cameraY.subscribe(draw),
        scale.subscribe(draw),
        selectedSegments.subscribe(draw),
      ];
      return () => unsub.forEach(u => u());
    });
  
    // --- Mouse pan & zoom ---
    let dragging = false, lastMouseDownX, lastMouseDownY, lastDragX, lastDragY;
    function mDown(e) {
      if (e.button !== 0) return; // Only handle left clicks
      dragging = true;
      lastMouseDownX = e.clientX;
      lastMouseDownY = e.clientY;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
      canvas.style.cursor = 'grabbing';
    }
    function mMove(e) {
      if (!dragging) return;
      cameraX.update(cx => cx + (e.clientX - lastDragX));
      cameraY.update(cy => cy + (e.clientY - lastDragY));
      lastDragX = e.clientX;
      lastDragY = e.clientY;
    }
    function mUp(e) {
      if (!dragging || e.button !== 0) return;
      dragging = false;
      canvas.style.cursor = 'grab';
       // Check if it was a click (minimal movement)
       const movedDist = Math.hypot(e.clientX - lastMouseDownX, e.clientY - lastMouseDownY);
       if (movedDist < 5) { // Treat as click if moved less than 5px
          handleInteraction(e.clientX, e.clientY);
       }
    }
    function wheel(e) {
      e.preventDefault();
      zoomCanvas(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY);
    }
  
    // --- Touch pan & zoom ---
    let touchDragging = false;
    let lastTouchX = null, lastTouchY = null;
    let initialPinchDistance = null;
    let touchStartTime = 0;
    let startTouchX = 0, startTouchY = 0; // To detect taps vs drags
  
    function tDown(e) {
        e.preventDefault(); // Prevent default touch behaviors like scrolling
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            touchDragging = true;
            touchStartTime = Date.now();
            startTouchX = touch.clientX;
            startTouchY = touch.clientY;
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
            initialPinchDistance = null; // Reset pinch on new single touch
            canvas.style.cursor = 'grabbing';
        } else if (e.touches.length === 2) {
            touchDragging = false; // Stop single-touch drag if second finger comes down
            initialPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }
  
    function tMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && touchDragging) {
            const touch = e.touches[0];
            cameraX.update(cx => cx + (touch.clientX - lastTouchX));
            cameraY.update(cy => cy + (touch.clientY - lastTouchY));
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
        } else if (e.touches.length === 2 && initialPinchDistance !== null) {
            const currentPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            // Avoid division by zero or extreme zoom on very small initial distance
            if (initialPinchDistance > 1) { 
                 const zoomFactor = currentPinchDistance / initialPinchDistance;
                 const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                 const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                 zoomCanvas(zoomFactor, midX, midY);
            }
            // Update initial distance for continuous zoom feel
            initialPinchDistance = currentPinchDistance;
        }
    }
  
    function tEnd(e) {
        e.preventDefault();
        const touchEndTime = Date.now();
  
        if (e.changedTouches.length === 1 && touchDragging) {
             // Check if it was a tap (short duration, minimal movement)
             const touch = e.changedTouches[0];
             const duration = touchEndTime - touchStartTime;
             const movedDist = Math.hypot(touch.clientX - startTouchX, touch.clientY - startTouchY);
  
             if (duration < 250 && movedDist < 10) { // Tap thresholds (adjust as needed)
                 handleInteraction(touch.clientX, touch.clientY);
             }
        }
  
        // Reset flags based on remaining touches
        if (e.touches.length < 2) {
             initialPinchDistance = null;
        }
        if (e.touches.length < 1) {
             touchDragging = false;
             canvas.style.cursor = 'grab';
             lastTouchX = null;
             lastTouchY = null;
        }
    }
  
    // --- Unified Zoom Logic ---
    function zoomCanvas(zoomFactor, screenX, screenY) {
        const oldScale = get(scale);
        let newScale = oldScale * zoomFactor;
        newScale = Math.min(Math.max(newScale, 0.2), 5); // Clamp scale
  
        if (Math.abs(newScale - oldScale) < 1e-5) return; // No significant change
  
        const rect = canvas.getBoundingClientRect();
        const sx = screenX - rect.left;
        const sy = screenY - rect.top;
  
        // Convert screen point to world coordinates before zoom
        const wx = (sx - get(cameraX)) / oldScale;
        const wy = (sy - get(cameraY)) / oldScale;
  
        // Update scale
        scale.set(newScale);
  
        // Calculate the new camera position to keep the world point under the screen point
        cameraX.set(sx - wx * newScale);
        cameraY.set(sy - wy * newScale);
    }
  
    // --- Unified Interaction Handler (Click/Tap) ---
    function handleInteraction(screenX, screenY) {
      const rect = canvas.getBoundingClientRect();
      const sx = screenX - rect.left;
      const sy = screenY - rect.top;
      const s  = get(scale);
  
      // screen -> world
      const wx = (sx - get(cameraX)) / s;
      const wy = (sy - get(cameraY)) / s;
  
      let nearestKey = null;
      let nearestDistSq = (6 / s) * (6 / s); // Use squared distance for efficiency, tolerance in world space
  
      // Iterate through a smaller range around the click/tap first for performance
      const centerHex = pixelToHex(wx, wy, HEX_SIZE);
      const roundedCenter = roundAxial(centerHex.q, centerHex.r);
      const searchRadius = 2; // Search nearby hexes
  
      for (let dq = -searchRadius; dq <= searchRadius; dq++) {
          for (let dr = -searchRadius; dr <= searchRadius; dr++) {
             const q = roundedCenter.q + dq;
             const r = roundedCenter.r + dr;

             const segs = cellSegments(q, r);
             for (const seg of segs) {
                 const dSq = pointToSegmentDistSq(wx, wy, seg.x1, seg.y1, seg.x2, seg.y2);
                 if (dSq < nearestDistSq) {
                     nearestDistSq = dSq;
                     nearestKey = seg.key;
                 }
             }
         }
      }
  
      // Note: With infinite background, local search is sufficient for performance
  
      if (nearestKey) {
        selectedSegments.update(old => {
          const copy = new Set(old);
          copy.has(nearestKey) ? copy.delete(nearestKey) : copy.add(nearestKey);
          return copy;
        });
      }
    }
  
    // Squared distance from point(px,py) to line segment(x1,y1 -> x2,y2)
    function pointToSegmentDistSq(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1, dy = y2 - y1;
      const lengthSq = dx * dx + dy * dy;
      if (lengthSq === 0) { // Segment is a point
        const pdx = px - x1;
        const pdy = py - y1;
        return pdx * pdx + pdy * pdy;
      }
      // Project point (px, py) onto the line containing the segment
      let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
      // Clamp t to the range [0, 1] to stay within the segment
      t = Math.max(0, Math.min(1, t));
      // Calculate the closest point (cx, cy) on the segment to (px, py)
      const cx = x1 + t * dx;
      const cy = y1 + t * dy;
      // Return the squared distance
      const distDx = px - cx;
      const distDy = py - cy;
      return distDx * distDx + distDy * distDy;
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
      background-color: rgba(255, 255, 255, 0);
      border-radius: 4px;
      padding: 8px;
      
    }
    .save-buttons button {
      margin-right: 8px;
      padding: 6px 12px;
      font-size: 14px;
      cursor: pointer;
      color:white;
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
    on:touchstart={tDown}
    on:touchmove={tMove}
    on:touchend={tEnd}
    on:touchcancel={tEnd}
    style="display: block; width: 100%; height: 100%; cursor: grab; touch-action: none;"
  >
  
  </canvas>

  <!-- Save buttons -->
  <div class="save-buttons">
    <button on:click={saveAsPng}>Save as PNG</button>
    <button on:click={saveAsJpeg}>Save as JPEG</button>
  </div>
  