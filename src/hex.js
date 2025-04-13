const SQRT3 = Math.sqrt(3);

/** Axial → pixel (pointy-topped orientation) */
/** Axial → pixel ( **flat‑topped** orientation) */
export function hexToPixel(q, r, size) {
    return {
      //  x‑axis is horizontal; every column is 1½ * size apart
      x: size * (1.5 * q),
      //  y‑axis is slanted so that hexes stack vertically
      y: size * (SQRT3 * r + SQRT3 / 2 * q)
    };
  }
  
  /** Pixel → axial (fractional, flat‑topped) */
  export function pixelToHex(x, y, size) {
    // invert the matrix above
    const q = (2 / 3) * x / size;
    const r = (-1 / 3) * x / size + (1 / SQRT3) * y / size;
    return { q, r };
  }

/** Round fractional axial to nearest integer axial coords */
export function roundAxial(q, r) {
  let x = q, z = r, y = -x - z;
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);

  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);

  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz)        ry = -rx - rz;
  else                     rz = -rx - ry;

  return { q: rx, r: rz };
}

/**
 * Return an object describing all key points (corners, midpoints, center)
 * and line segments for a "full" hex, including:
 * - perimeter (corners->corners)
 * - diagonals corner->opposite corner
 * - mid-edge ring
 * - corner->midpoint lines
 * - optional center lines
 */
export function makeFullHex(includeCenter = true) {
  // -- Key points in local (radius=1) coords --

  // 6 corners (pointy-topped). corner i is at angle = 30° + 60°*i
  const corners = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i);
    return { x: Math.cos(a), y: Math.sin(a) };
  });

  // 6 midpoints, each halfway between corner[i] and corner[i+1].
  // (But for i=5, corner[i+1] => corner[0]).
  const midpoints = corners.map((c, i) => {
    const n = corners[(i + 1) % 6];
    return { x: (c.x + n.x) / 2, y: (c.y + n.y) / 2 };
  });

  // Optional center
  const center = { x: 0, y: 0 };

  // -- Build line segments. Each segment = [ {x,y}, {x,y} ] --

  const segments = [];

  // 1) perimeter corner->corner
  for (let i = 0; i < 6; i++) {
    const cA = corners[i];
    const cB = corners[(i + 1) % 6];
    segments.push([cA, cB]);
  }

  // 2) diagonals (corner->opposite corner)
  //    c0->c3, c1->c4, c2->c5
  // for (let i = 0; i < 3; i++) {
  //   segments.push([corners[i], corners[i + 3]]);
  // }

  // 3) mid-edge ring: m0->m1->...->m5->m0
  // for (let i = 0; i < 6; i++) {
  //   const mA = midpoints[i];
  //   const mB = midpoints[(i + 1) % 6];
  //   segments.push([mA, mB]);
  // }

  // 4) corner->midpoint lines
  //    each corner connects to the two midpoints on either side
  for (let i = 0; i < 6; i++) {
    const c = corners[i];
    const mA = midpoints[i];
    const mB = midpoints[(i + 5) % 6]; // the previous midpoint
    segments.push([c, mA], [c, mB]);
  }

  // 5) optional center lines
  if (includeCenter) {
    for (const c of corners) {
      segments.push([center, c]);
    }
    for (const m of midpoints) {
      segments.push([center, m]);
    }
  }

  return {
    corners,
    midpoints,
    center,
    segments
  };
}
