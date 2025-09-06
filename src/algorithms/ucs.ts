import {
  GridCell,
  Point,
  SearchResult,
  idOf,
  neighbors4,
  reconstructPath,
} from "./types";

// Uniform Cost Search (Dijkstra on grid). Optimal with non-negative costs.
export function ucs(grid: GridCell[][], start: Point, goal: Point): SearchResult {
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

  type Node = { p: Point; g: number };
  const open: Node[] = [{ p: start, g: 0 }];
  const gScore: Record<string, number> = { [sId]: 0 };
  const cameFrom: Record<string, string | undefined> = {};
  const visitedOrder: Point[] = [];
  let frontierPeak = open.length;
  let visitedPeak = 0;
  const frontierSnapshots: string[][] = [];

  while (open.length > 0) {
    // pick min g
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) if (open[i].g < open[bestIdx].g) bestIdx = i;
    const node = open.splice(bestIdx, 1)[0];
    const cur = node.p;
    const curId = idOf(cur.x, cur.y);
    visitedOrder.push(cur);
    if (visitedOrder.length > visitedPeak) visitedPeak = visitedOrder.length;

    if (curId === gId) {
      frontierSnapshots.push(open.map((n) => idOf(n.p.x, n.p.y)));
      const ids = reconstructPath(cameFrom, gId);
      const path: Point[] = ids.map((s) => {
        const [xStr, yStr] = s.split(",");
        return { x: parseInt(xStr), y: parseInt(yStr) };
      });
      // total cost = g at goal
      const totalCost = gScore[gId] ?? 0;
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

    for (const nb of neighbors4(cur.x, cur.y, R, C)) {
      if (grid[nb.x][nb.y].type === "wall") continue;
      const nid = idOf(nb.x, nb.y);
      const step = grid[nb.x][nb.y].type === "weight" ? 5 : 1;
      const tentativeG = (gScore[curId] ?? Infinity) + step;
      if (tentativeG < (gScore[nid] ?? Infinity)) {
        gScore[nid] = tentativeG;
        cameFrom[nid] = curId;
        const idx = open.findIndex((n) => n.p.x === nb.x && n.p.y === nb.y);
        if (idx === -1) open.push({ p: nb, g: tentativeG });
        else open[idx] = { p: nb, g: tentativeG };
        if (open.length > frontierPeak) frontierPeak = open.length;
      }
    }
    frontierSnapshots.push(open.map((n) => idOf(n.p.x, n.p.y)));
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
