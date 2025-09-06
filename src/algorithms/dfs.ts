import {
  GridCell,
  Point,
  SearchResult,
  idOf,
  neighbors4,
  reconstructPath,
} from "./types";

// Depth-First Search (stack/LIFO). Ignores weights for ordering.
export function dfs(grid: GridCell[][], start: Point, goal: Point): SearchResult {
  const t0 =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();

  const R = grid.length;
  const C = grid[0]?.length ?? 0;
  if (R === 0 || C === 0)
    return {
      found: false,
      path: [],
      visitedOrder: [],
      nodesExpanded: 0,
      pathLength: 0,
      totalCost: 0,
      timeMs: 0,
      frontierPeak: 0,
      visitedPeak: 0,
      frontierSnapshots: [],
    };

  const sId = idOf(start.x, start.y);
  const gId = idOf(goal.x, goal.y);
  if (
    grid[start.x][start.y].type === "wall" ||
    grid[goal.x][goal.y].type === "wall"
  ) {
    const t1 =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    return {
      found: false,
      path: [],
      visitedOrder: [],
      nodesExpanded: 0,
      pathLength: 0,
      totalCost: 0,
      timeMs: t1 - t0,
      frontierPeak: 0,
      visitedPeak: 0,
      frontierSnapshots: [],
    };
  }

  const stack: Point[] = [start];
  const seen = new Set<string>([sId]);
  const cameFrom: Record<string, string | undefined> = {};
  const visitedOrder: Point[] = [];
  let frontierPeak = stack.length;
  let visitedPeak = 0;
  const frontierSnapshots: string[][] = [];

  while (stack.length > 0) {
    const cur = stack.pop()!;
    const curId = idOf(cur.x, cur.y);
    visitedOrder.push(cur);
    if (visitedOrder.length > visitedPeak) visitedPeak = visitedOrder.length;

    if (curId === gId) {
      frontierSnapshots.push(stack.map((p) => idOf(p.x, p.y)));
      const ids = reconstructPath(cameFrom, gId);
      const path: Point[] = ids.map((s) => {
        const [xStr, yStr] = s.split(",");
        return { x: parseInt(xStr), y: parseInt(yStr) };
      });
      let totalCost = 0;
      for (let i = 1; i < path.length; i++) {
        const p = path[i];
        totalCost += grid[p.x][p.y].type === "weight" ? 5 : 1;
      }
      const t1 =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();
      return {
        found: true,
        path,
        visitedOrder,
        nodesExpanded: visitedOrder.length,
        pathLength: Math.max(0, path.length - 1),
        totalCost,
        timeMs: t1 - t0,
        frontierPeak,
        visitedPeak,
        frontierSnapshots,
      };
    }

    // DFS order: reverse neighbors for deterministic traversal
    const neigh = neighbors4(cur.x, cur.y, R, C).reverse();
    for (const nb of neigh) {
      if (grid[nb.x][nb.y].type === "wall") continue;
      const nid = idOf(nb.x, nb.y);
      if (seen.has(nid)) continue;
      seen.add(nid);
      cameFrom[nid] = curId;
      stack.push(nb);
      if (stack.length > frontierPeak) frontierPeak = stack.length;
    }
    frontierSnapshots.push(stack.map((p) => idOf(p.x, p.y)));
  }

  const t1 =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  return {
    found: false,
    path: [],
    visitedOrder,
    nodesExpanded: visitedOrder.length,
    pathLength: 0,
    totalCost: 0,
    timeMs: t1 - t0,
    frontierPeak,
    visitedPeak,
    frontierSnapshots,
  };
}
