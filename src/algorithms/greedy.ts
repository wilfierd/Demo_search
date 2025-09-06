import {
  GridCell,
  Point,
  SearchResult,
  idOf,
  neighbors4,
  reconstructPath,
  manhattan,
} from "./types";

// Greedy Best-First Search: picks node with lowest h (Manhattan)
// Not optimal with weights; ignores g for ordering.
export function greedy(
  grid: GridCell[][],
  start: Point,
  goal: Point,
): SearchResult {
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

  type Node = { p: Point; h: number };
  const open: Node[] = [{ p: start, h: manhattan(start.x, start.y, goal.x, goal.y) }];
  const cameFrom: Record<string, string | undefined> = {};
  const visitedOrder: Point[] = [];
  const seen = new Set<string>([sId]);
  let frontierPeak = open.length;
  let visitedPeak = 0;
  const frontierSnapshots: string[][] = [];

  while (open.length > 0) {
    // pick min h
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) if (open[i].h < open[bestIdx].h) bestIdx = i;
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
      // compute total cost along path
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

    for (const nb of neighbors4(cur.x, cur.y, R, C)) {
      if (grid[nb.x][nb.y].type === "wall") continue;
      const nid = idOf(nb.x, nb.y);
      if (seen.has(nid)) continue;
      seen.add(nid);
      cameFrom[nid] = curId;
      open.push({ p: nb, h: manhattan(nb.x, nb.y, goal.x, goal.y) });
      if (open.length > frontierPeak) frontierPeak = open.length;
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
