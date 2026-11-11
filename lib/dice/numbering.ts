/**
 * Real d20 numbering, framework-free: opposite faces always sum to 21, and the
 * values 1..20 each appear exactly once. Input is the icosahedron's face
 * normals (one per triangle); output is the number printed on each face.
 */
export type Vec3 = [number, number, number];

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Normals from a non-indexed triangle position array (9 numbers per face). */
export function faceNormals(positions: ArrayLike<number>): Vec3[] {
  const out: Vec3[] = [];
  for (let f = 0; f < positions.length; f += 9) {
    const [ax, ay, az] = [positions[f], positions[f + 1], positions[f + 2]];
    const [bx, by, bz] = [positions[f + 3], positions[f + 4], positions[f + 5]];
    const [cx, cy, cz] = [positions[f + 6], positions[f + 7], positions[f + 8]];
    const u: Vec3 = [bx - ax, by - ay, bz - az];
    const v: Vec3 = [cx - ax, cy - ay, cz - az];
    const n: Vec3 = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const len = Math.hypot(...n) || 1;
    out.push([n[0] / len, n[1] / len, n[2] / len]);
  }
  return out;
}

// Low half of each opposite pair, in an order that scatters small and large
// numbers around the die instead of clustering them.
const LOW_ORDER = [1, 7, 3, 9, 5, 10, 2, 8, 4, 6];

export function numberFaces(normals: Vec3[]): number[] {
  const values: number[] = new Array(normals.length).fill(0);
  let pair = 0;
  for (let i = 0; i < normals.length; i++) {
    if (values[i]) continue;
    const j = normals.findIndex((n, k) => k !== i && !values[k] && dot(n, normals[i]) < -0.99);
    if (j < 0) throw new Error("face has no opposite");
    const low = LOW_ORDER[pair++];
    values[i] = low;
    values[j] = 21 - low;
  }
  return values;
}
