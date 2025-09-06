// Standalone BFS implementation (grid-based, 4-neighbor)
// Independent from the visualizer component; can be imported anywhere.
import {
  GridCell,
  Point,
  SearchResult,
  idOf,
  neighbors4,
  reconstructPath,
} from "./types";

export function bfs(grid: GridCell[][], start: Point, goal: Point): SearchResult {
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

  // Trivial/blocked checks
  if (start.x === goal.x && start.y === goal.y) {
    const t1 =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    return {
      found: true,
      path: [start],
      visitedOrder: [],
      nodesExpanded: 0,
      pathLength: 0,
      totalCost: 0,
      timeMs: t1 - t0,
      frontierPeak: 1,
      visitedPeak: 0,
      frontierSnapshots: [],
    };
  }
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

  const sId = idOf(start.x, start.y);
  const gId = idOf(goal.x, goal.y);

  const queue: Point[] = [start];
  const seen = new Set<string>([sId]);
  const cameFrom: Record<string, string | undefined> = {};
  const visitedOrder: Point[] = [];
  let frontierPeak = queue.length;
  let visitedPeak = 0;
  const frontierSnapshots: string[][] = [];

  while (queue.length > 0) {
    // FIFO dequeue
    const cur = queue.shift()!;
    const curId = idOf(cur.x, cur.y);
    visitedOrder.push(cur);
    if (visitedOrder.length > visitedPeak) visitedPeak = visitedOrder.length;

    if (curId === gId) {
      // snapshot current frontier (queue) at goal encounter
      frontierSnapshots.push(queue.map((p) => idOf(p.x, p.y)));
      // Reconstruct path and compute cost
      const ids = reconstructPath(cameFrom, gId);
      const path: Point[] = ids.map((s) => {
        const [xStr, yStr] = s.split(",");
        return { x: parseInt(xStr), y: parseInt(yStr) };
      });
      // Compute total cost using 1 for empty and 5 for weight (like visualizer)
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

    // Expand neighbors (skip walls)
    for (const nb of neighbors4(cur.x, cur.y, R, C)) {
      if (grid[nb.x][nb.y].type === "wall") continue;
      const nid = idOf(nb.x, nb.y);
      if (seen.has(nid)) continue;
      seen.add(nid);
      cameFrom[nid] = curId;
      queue.push(nb);
      if (queue.length > frontierPeak) frontierPeak = queue.length;
    }
    // snapshot frontier after expanding this node
    frontierSnapshots.push(queue.map((p) => idOf(p.x, p.y)));
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

// Example usage:
// import { bfs } from "./algorithms/bfs";
// const result = bfs(grid, { x: 0, y: 0 }, { x: 3, y: 7 });
// console.log(result.path, result.visitedOrder, result.found);
