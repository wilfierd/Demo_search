export type CellType = "empty" | "wall" | "weight";

export type GridCell = {
  x: number;
  y: number;
  type: CellType;
};

export type Point = { x: number; y: number };

export type SearchResult = {
  found: boolean;
  path: Point[]; // empty if not found
  visitedOrder: Point[]; // expansion order
  nodesExpanded: number;
  pathLength: number; // steps
  totalCost: number; // 1 for empty, 5 for weight (excluding start)
  timeMs: number;
  frontierPeak: number;
  visitedPeak: number;
  frontierSnapshots: string[][]; // frontier ids after each expansion step (aligned to visitedOrder)
};

export function idOf(x: number, y: number) {
  return `${x},${y}`;
}

export function neighbors4(x: number, y: number, R: number, C: number): Point[] {
  const out: Point[] = [];
  if (x > 0) out.push({ x: x - 1, y });
  if (x < R - 1) out.push({ x: x + 1, y });
  if (y > 0) out.push({ x, y: y - 1 });
  if (y < C - 1) out.push({ x, y: y + 1 });
  return out;
}

export function manhattan(ax: number, ay: number, bx: number, by: number) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function costOf(cell: GridCell) {
  return cell.type === "weight" ? 5 : 1;
}

export function reconstructPath(
  came: Record<string, string | undefined>,
  goalId: string,
): string[] {
  const path: string[] = [];
  let cur: string | undefined = goalId;
  while (cur) {
    path.push(cur);
    cur = came[cur];
  }
  return path.reverse();
}
