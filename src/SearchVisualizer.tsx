import React, { useEffect, useMemo, useRef, useState } from "react";

// === Utility types ===
const ALGOS = ["BFS", "DFS", "UCS", "Greedy", "A*"] as const;
type Algo = (typeof ALGOS)[number];

type CellType = "empty" | "wall" | "weight";

type Cell = {
  x: number;
  y: number;
  type: CellType;
};

// Node data tracked during search
type NodeData = {
  id: string;
  x: number;
  y: number;
  g: number; // cost so far
  h: number; // heuristic
  f: number; // g + h
  parent?: string;
};

type Metrics = {
  nodesExpanded: number; // visited size
  visitedCurrent: number;
  visitedPeak: number;
  frontierCurrent: number;
  frontierPeak: number;
  pathLength: number; // steps
  totalCost: number; // g(goal)
  timeMs: number; // elapsed runtime
  found: boolean;
};

function idOf(x: number, y: number) {
  return `${x},${y}`;
}

function manhattan(ax: number, ay: number, bx: number, by: number) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

// === Main Component ===
export default function SearchVisualizer() {
  // Grid config
  const [rows, setRows] = useState(15);
  const [cols, setCols] = useState(25);
  const [grid, setGrid] = useState<Cell[][]>(() => makeGrid(15, 25));

  // Start / Goal
  const [start, setStart] = useState<{ x: number; y: number }>({ x: 2, y: 2 });
  const [goal, setGoal] = useState<{ x: number; y: number }>({ x: 12, y: 22 });

  // Editing mode
  const EDIT_MODES = ["Walls", "Weights", "Start", "Goal"] as const;
  type EditMode = (typeof EDIT_MODES)[number];
  const [editMode, setEditMode] = useState<EditMode>("Walls");

  // Algorithm & speed
  const [algo, setAlgo] = useState<Algo>("A*");
  const [speedMs, setSpeedMs] = useState(40); // lower = faster

  // Search runtime state
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [noPath, setNoPath] = useState(false);

  // Frontier / visited / path for rendering
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [frontierSet, setFrontierSet] = useState<Set<string>>(new Set());
  const [pathSet, setPathSet] = useState<Set<string>>(new Set());

  // Metrics (live) & history for comparisons
  const initialMetrics: Metrics = {
    nodesExpanded: 0,
    visitedCurrent: 0,
    visitedPeak: 0,
    frontierCurrent: 0,
    frontierPeak: 0,
    pathLength: 0,
    totalCost: 0,
    timeMs: 0,
    found: false,
  };
  const [liveMetrics, setLiveMetrics] = useState<Metrics>(initialMetrics);
  const [history, setHistory] = useState<
    Array<{
      algo: Algo;
      nodesExpanded: number;
      pathLength: number;
      totalCost: number;
      frontierPeak: number;
      timeMs: number;
    }>
  >([]);

  // Internal algorithm structures (kept in refs so they persist across renders)
  const refFrontier = useRef<NodeData[]>([]);
  const refCameFrom = useRef<Record<string, string | undefined>>({});
  const refG = useRef<Record<string, number>>({});
  const refH = useRef<Record<string, number>>({});
  const refF = useRef<Record<string, number>>({});
  const refExplored = useRef<Set<string>>(new Set());
  const refDone = useRef(false);
  const refStartTime = useRef<number | null>(null);
  const refFrontierPeak = useRef(0);
  const refVisitedPeak = useRef(0);

  // Mouse drag painting
  const mouseDownRef = useRef(false);

  // Re-make grid when size changes
  useEffect(() => {
    setGrid(makeGrid(rows, cols));
    // clamp start/goal into bounds
    setStart(({ x, y }) => ({
      x: clamp(x, 0, rows - 1),
      y: clamp(y, 0, cols - 1),
    }));
    setGoal(({ x, y }) => ({
      x: clamp(x, 0, rows - 1),
      y: clamp(y, 0, cols - 1),
    }));
    hardResetVisual();
  }, [rows, cols]);

  function hardResetVisual() {
    setVisited(new Set());
    setFrontierSet(new Set());
    setPathSet(new Set());
    refFrontier.current = [];
    refCameFrom.current = {};
    refG.current = {};
    refH.current = {};
    refF.current = {};
    refExplored.current = new Set();
    refDone.current = false;
    setRunning(false);
    setPaused(false);
    setNoPath(false);
    setLiveMetrics(initialMetrics);
  }

  function handleCellClick(r: number, c: number) {
    if (running) return; // avoid editing during run
    if (editMode === "Walls") {
      setGrid((prev) => toggleCell(prev, r, c, "wall"));
    } else if (editMode === "Weights") {
      setGrid((prev) => toggleCell(prev, r, c, "weight"));
    } else if (editMode === "Start") {
      setStart({ x: r, y: c });
    } else if (editMode === "Goal") {
      setGoal({ x: r, y: c });
    }
  }

  function handleMouseDown() {
    mouseDownRef.current = true;
  }
  function handleMouseUp() {
    mouseDownRef.current = false;
  }

  function handleCellEnter(r: number, c: number) {
    if (!mouseDownRef.current || running) return;
    if (editMode === "Walls") {
      setGrid((prev) => setCell(prev, r, c, "wall"));
    } else if (editMode === "Weights") {
      setGrid((prev) => setCell(prev, r, c, "weight"));
    }
  }

  function randomObstacles(density = 0.25) {
    if (running) return;
    setGrid((prev) =>
      prev.map((row, i) =>
        row.map((cell, j) => {
          if (
            (i === start.x && j === start.y) ||
            (i === goal.x && j === goal.y)
          )
            return cell;
          const r = Math.random();
          if (r < density) return { ...cell, type: "wall" };
          if (r < density + 0.08) return { ...cell, type: "weight" };
          return { ...cell, type: "empty" };
        }),
      ),
    );
    hardResetVisual();
  }

  function clearBoard() {
    if (running) return;
    setGrid((prev) =>
      prev.map((row) => row.map((cell) => ({ ...cell, type: "empty" }))),
    );
    hardResetVisual();
  }

  function resetRunOnly() {
    setVisited(new Set());
    setFrontierSet(new Set());
    setPathSet(new Set());
    refFrontier.current = [];
    refCameFrom.current = {};
    refG.current = {};
    refH.current = {};
    refF.current = {};
    refExplored.current = new Set();
    refDone.current = false;
    setNoPath(false);
    setLiveMetrics(initialMetrics);
  }

  function initRun() {
    resetRunOnly();
    
    // Safety checks
    if (start.x === goal.x && start.y === goal.y) {
      setNoPath(false);
      refDone.current = true;
      setRunning(false);
      return;
    }
    
    if (grid[start.x][start.y].type === "wall" || grid[goal.x][goal.y].type === "wall") {
      setNoPath(true);
      refDone.current = true;
      setRunning(false);
      return;
    }
    
    const sId = idOf(start.x, start.y);
    const sNode: NodeData = {
      id: sId,
      x: start.x,
      y: start.y,
      g: 0,
      h: manhattan(start.x, start.y, goal.x, goal.y),
      f: manhattan(start.x, start.y, goal.x, goal.y),
      parent: undefined,
    };
    refFrontier.current = [sNode];
    refG.current[sId] = 0;
    refH.current[sId] = sNode.h;
    refF.current[sId] = sNode.f;
    setFrontierSet(new Set([sId]));
    refStartTime.current = performance.now();
    refFrontierPeak.current = 1;
    refVisitedPeak.current = 0;
    setLiveMetrics({
      nodesExpanded: 0,
      visitedCurrent: 0,
      visitedPeak: 0,
      frontierCurrent: 1,
      frontierPeak: 1,
      pathLength: 0,
      totalCost: 0,
      timeMs: 0,
      found: false,
    });
  }

  function run() {
    if (running && paused) {
      setPaused(false);
      return;
    }
    if (!running) {
      initRun();
      setRunning(true);
      setPaused(false);
    }
  }

  function pause() {
    if (!running) return;
    setPaused(true);
  }
  function stop() {
    setRunning(false);
    setPaused(false);
  }

  // Core stepping loop using setInterval
  useEffect(() => {
    if (!running || paused) return;
    if (refDone.current) return;

    const timer = setInterval(() => {
      stepOnce();
    }, speedMs);
    return () => clearInterval(timer);
  }, [running, paused, speedMs, algo]);

  function updateLiveMetricsPartial() {
    const visitedCount = refExplored.current.size;
    const frontierCount = refFrontier.current.length;
    if (visitedCount > refVisitedPeak.current)
      refVisitedPeak.current = visitedCount;
    if (frontierCount > refFrontierPeak.current)
      refFrontierPeak.current = frontierCount;
    const timeMs = refStartTime.current
      ? performance.now() - refStartTime.current
      : 0;
    setLiveMetrics((prev) => ({
      ...prev,
      nodesExpanded: visitedCount,
      visitedCurrent: visitedCount,
      visitedPeak: refVisitedPeak.current,
      frontierCurrent: frontierCount,
      frontierPeak: refFrontierPeak.current,
      timeMs,
    }));
  }

  function stepOnce() {
    if (refDone.current) return;

    // choose next node based on algo
    const frontier = refFrontier.current;
    if (frontier.length === 0) {
      refDone.current = true;
      setRunning(false);
      updateLiveMetricsPartial();
      setNoPath(true);
      return;
    }

    let idx = 0;
    if (algo === "BFS")
      idx = 0; // queue (FIFO - first in, first out)
    else if (algo === "DFS")
      idx = frontier.length - 1; // stack (LIFO - last in, first out)
    else if (algo === "UCS") idx = argMin(frontier, (n) => n.g);
    else if (algo === "Greedy") idx = argMin(frontier, (n) => n.h);
    else if (algo === "A*") idx = argMin(frontier, (n) => n.f);

    const current = frontier.splice(idx, 1)[0];

    // goal check BEFORE adding to visited (important for optimal path finding)
    if (current.x === goal.x && current.y === goal.y) {
      // Add to visited for accurate metrics
      refExplored.current.add(current.id);
      setVisited((prev) => new Set(prev).add(current.id));
      setFrontierSet((prev) => {
        const s = new Set(prev);
        s.delete(current.id);
        return s;
      });

      const pathIds = reconstructPath(refCameFrom.current, current.id);
      setPathSet(new Set(pathIds));
      const visitedCount = refExplored.current.size;
      const frontierCount = refFrontier.current.length;
      if (visitedCount > refVisitedPeak.current)
        refVisitedPeak.current = visitedCount;
      if (frontierCount > refFrontierPeak.current)
        refFrontierPeak.current = frontierCount;
      const timeMs = refStartTime.current
        ? performance.now() - refStartTime.current
        : 0;
      const pathLength = Math.max(0, pathIds.length - 1);
      const totalCost = current.g; // g at goal is total path cost

      setLiveMetrics({
        nodesExpanded: visitedCount,
        visitedCurrent: visitedCount,
        visitedPeak: refVisitedPeak.current,
        frontierCurrent: frontierCount,
        frontierPeak: refFrontierPeak.current,
        pathLength,
        totalCost,
        timeMs,
        found: true,
      });

      setHistory((prev) =>
        [
          {
            algo,
            nodesExpanded: visitedCount,
            pathLength,
            totalCost,
            frontierPeak: refFrontierPeak.current,
            timeMs,
          },
          ...prev,
        ].slice(0, 8),
      );

      refDone.current = true;
      setRunning(false);
      setNoPath(false);
      return;
    }

    // book-keeping: add current node to visited set
    refExplored.current.add(current.id);
    setVisited((prev) => new Set(prev).add(current.id));
    setFrontierSet((prev) => {
      const s = new Set(prev);
      s.delete(current.id);
      return s;
    });

    // expand neighbors
    let neigh = neighbors(current.x, current.y, rows, cols).filter(
      ([nx, ny]) => grid[nx][ny].type !== "wall",
    );

    // For DFS: We want to explore in a specific direction first to get the characteristic
    // deep exploration behavior. Since we use the end of the array as stack top,
    // we should add neighbors in reverse priority order (last added = first explored)
    if (algo === "DFS") {
      // Sort neighbors to get predictable DFS behavior
      // Priority: Left, Up, Down, Right (so Right gets explored first)
      neigh.sort((a, b) => {
        const [ax, ay] = a;
        const [bx, by] = b;
        const [cx, cy] = [current.x, current.y];
        
        // Calculate direction relative to current position
        const dirA = getDirPriority(ax - cx, ay - cy);
        const dirB = getDirPriority(bx - cx, by - cy);
        
        return dirB - dirA; // Reverse order for stack (higher priority pushed last)
      });
    }

    for (const [nx, ny] of neigh) {
      const nid = idOf(nx, ny);
      const w = grid[nx][ny].type === "weight" ? 5 : 1; // weighted cells cost 5
      const tentativeG = current.g + w;

      if (refExplored.current.has(nid)) continue;

      // For DFS: don't check frontier duplicates, just add to stack
      // For other algorithms: check if node is already in frontier
      if (algo === "DFS") {
        // DFS: just push to stack, no duplicate frontier checking
        const h = manhattan(nx, ny, goal.x, goal.y);
        const node = {
          id: nid,
          x: nx,
          y: ny,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current.id,
        };
        refFrontier.current.push(node); // Push to end (stack behavior)
        setFrontierSet((prev) => new Set(prev).add(nid));
        refCameFrom.current[nid] = current.id;
        refG.current[nid] = tentativeG;
        refH.current[nid] = h;
        refF.current[nid] = node.f;
      } else {
        // Other algorithms: check frontier duplicates and update if better
        const inFrontierIdx = refFrontier.current.findIndex((n) => n.id === nid);
        const oldG = refG.current[nid] ?? Infinity; // Use Infinity if not set
        
        // Add to frontier if not present, or update if we found a better path
        if (inFrontierIdx === -1 || tentativeG < oldG) {
          const h = manhattan(nx, ny, goal.x, goal.y);
          const node = {
            id: nid,
            x: nx,
            y: ny,
            g: tentativeG,
            h,
            f: tentativeG + h,
            parent: current.id,
          };
          
          if (inFrontierIdx === -1) {
            // Add new node to frontier
            refFrontier.current.push(node);
            setFrontierSet((prev) => new Set(prev).add(nid));
          } else {
            // Update existing node in frontier
            refFrontier.current[inFrontierIdx] = node;
          }
          
          // Update tracking records
          refCameFrom.current[nid] = current.id;
          refG.current[nid] = tentativeG;
          refH.current[nid] = h;
          refF.current[nid] = node.f;
        }
      }
    }

    // update live metrics after expansion
    updateLiveMetricsPartial();
  }

  // Helper function for DFS direction priority
  function getDirPriority(dx: number, dy: number): number {
    // Priority: Right=0, Down=1, Up=2, Left=3
    // (Higher number = lower priority = pushed later = explored first)
    if (dx === 0 && dy === 1) return 0;  // Right
    if (dx === 1 && dy === 0) return 1;  // Down  
    if (dx === -1 && dy === 0) return 2; // Up
    if (dx === 0 && dy === -1) return 3; // Left
    return 4; // Unknown direction
  }

  function step() {
    if (!running) {
      initRun();
      setRunning(true);
      setPaused(true);
    }
    stepOnce();
  }

  const cellSize = useMemo(() => {
    // keep grid roughly responsive
    const maxW = 900; // px
    const size = Math.floor(Math.min(28, Math.max(14, maxW / (cols + 4))));
    return size;
  }, [cols]);

  return (
    <div className="w-full flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">AI Search – Live Demo Visualizer</h1>
      <div className="text-sm opacity-80">
        Click to draw walls/weights or set Start/Goal. Run the selected
        algorithm and watch expansions live. <b>Note:</b> BFS is optimal only
        when all step costs are equal (no weights).
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Algorithm</label>
          <select
            className="px-2 py-1 rounded-lg border"
            value={algo}
            onChange={(e) => setAlgo(e.target.value as Algo)}
            disabled={running}
          >
            {ALGOS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Speed</label>
          <input
            type="range"
            min={10}
            max={200}
            step={5}
            value={speedMs}
            onChange={(e) => setSpeedMs(parseInt(e.target.value))}
          />
          <span className="text-xs w-10 text-right">{speedMs}ms</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Rows</label>
          <input
            type="number"
            className="w-16 px-2 py-1 rounded-lg border"
            value={rows}
            onChange={(e) =>
              setRows(clamp(parseInt(e.target.value || "0"), 5, 40))
            }
            disabled={running}
          />
          <label className="text-sm font-medium">Cols</label>
          <input
            type="number"
            className="w-16 px-2 py-1 rounded-lg border"
            value={cols}
            onChange={(e) =>
              setCols(clamp(parseInt(e.target.value || "0"), 5, 60))
            }
            disabled={running}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Edit</label>
          <div className="flex items-center gap-1">
            {EDIT_MODES.map((m) => (
              <button
                key={m}
                className={`px-2 py-1 rounded-lg border ${editMode === m ? "bg-black text-white" : "bg-white"}`}
                onClick={() => setEditMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            className="px-3 py-1 rounded-lg bg-slate-100 border"
            onClick={() => randomObstacles(0.25)}
            disabled={running}
          >
            Random
          </button>
          <button
            className="px-3 py-1 rounded-lg bg-slate-100 border"
            onClick={clearBoard}
            disabled={running}
          >
            Clear
          </button>
        </div>

        <div className="w-full flex items-center gap-2">
          <button
            className="px-3 py-1 rounded-lg bg-emerald-600 text-white"
            onClick={run}
            disabled={running && !paused}
          >
            Run
          </button>
          <button
            className="px-3 py-1 rounded-lg bg-amber-500 text-white"
            onClick={pause}
            disabled={!running || paused}
          >
            Pause
          </button>
          <button
            className="px-3 py-1 rounded-lg bg-blue-600 text-white"
            onClick={step}
          >
            Step
          </button>
          <button
            className="px-3 py-1 rounded-lg bg-gray-800 text-white"
            onClick={stop}
            disabled={!running}
          >
            Stop
          </button>
          <button
            className="px-3 py-1 rounded-lg bg-slate-200"
            onClick={resetRunOnly}
          >
            Reset Run
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Legend colorClass="bg-white border" label="Empty" />
        <Legend colorClass="bg-slate-700" label="Wall" />
        <Legend colorClass="bg-amber-400" label="Weight (cost 5)" />
        <Legend colorClass="bg-sky-300" label="Frontier" />
        <Legend colorClass="bg-indigo-300" label="Visited" />
        <Legend colorClass="bg-emerald-400" label="Path" />
        <div className="text-xs opacity-70">
          Start = green border, Goal = red border
        </div>
      </div>

      {/* Live Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Stat
          label="Nodes expanded"
          value={liveMetrics.nodesExpanded}
          hint="visited"
        />
        <Stat label="Path length" value={liveMetrics.pathLength} hint="steps" />
        <Stat
          label="Total cost"
          value={liveMetrics.totalCost}
          hint="sum of weights"
        />
        <Stat
          label="Frontier peak"
          value={liveMetrics.frontierPeak}
          hint="memory proxy"
        />
        <Stat
          label="Visited peak"
          value={liveMetrics.visitedPeak}
          hint="state space touched"
        />
        <Stat label="Time" value={`${liveMetrics.timeMs.toFixed(0)} ms`} />
      </div>
      {noPath && (
        <div className="text-sm text-rose-600">
          No path found with current map & algorithm.
        </div>
      )}

      {/* Grid */}
      <div
        className="inline-block select-none"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {grid.map((row, r) => (
          <div className="flex" key={r}>
            {row.map((cell, c) => {
              const cid = idOf(r, c);
              const isStart = r === start.x && c === start.y;
              const isGoal = r === goal.x && c === goal.y;
              const isVisited = visited.has(cid);
              const isFrontier = frontierSet.has(cid);
              const inPath = pathSet.has(cid);

              let bg = "bg-white";
              if (cell.type === "wall") bg = "bg-slate-700";
              else if (cell.type === "weight") bg = "bg-amber-400";
              if (isVisited) bg = "bg-indigo-300";
              if (isFrontier) bg = "bg-sky-300";
              if (inPath) bg = "bg-emerald-400";

              const borderColor = isStart
                ? "border-2 border-emerald-600"
                : isGoal
                  ? "border-2 border-rose-600"
                  : "border border-slate-300";

              return (
                <div
                  key={c}
                  className={`${bg} ${borderColor}`}
                  style={{ width: cellSize, height: cellSize }}
                  onClick={() => handleCellClick(r, c)}
                  onMouseEnter={() => handleCellEnter(r, c)}
                  title={`(${r},${c})`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="text-sm opacity-80">
        <p className="mb-2 font-medium">How to demo</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>
            Chọn <b>BFS</b>, bấm Random, Run → sóng nở đồng tâm, chạm goal =
            shortest path (khi bước đều).
          </li>
          <li>
            Chuyển <b>Weights</b>, tô vài ô vàng gần đường thẳng. Chọn{" "}
            <b>UCS</b> → thuật toán đi vòng nhưng rẻ hơn.
          </li>
          <li>
            Chọn <b>Greedy</b> với tường chắn ngay trước mặt → dễ lao vào bế
            tắc, phải vòng lại.
          </li>
          <li>
            Chọn <b>A*</b> → mở ít node hơn UCS/BFS (nhanh hơn khi heuristic
            tốt). Tăng speed để thấy rõ.
          </li>
          <li>
            Thiếu RAM (ý tưởng): tăng Rows/Cols cho thấy BFS ngốn nhiều
            visited/frontier hơn A*.
          </li>
        </ul>
      </div>

      {/* History / Comparison */}
      <div className="mt-2">
        <div className="text-sm font-medium mb-2">
          Runs history (for comparison)
        </div>
        {history.length === 0 ? (
          <div className="text-sm opacity-70">
            Run a few algorithms to populate this table.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Algo</Th>
                  <Th>Nodes expanded</Th>
                  <Th>Path length</Th>
                  <Th>Total cost</Th>
                  <Th>Frontier peak</Th>
                  <Th>Time (ms)</Th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-t">
                    <Td>{h.algo}</Td>
                    <Td>{h.nodesExpanded}</Td>
                    <Td>{h.pathLength}</Td>
                    <Td>{h.totalCost}</Td>
                    <Td>{h.frontierPeak}</Td>
                    <Td>{h.timeMs.toFixed(0)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-5 h-5 rounded ${colorClass}`}></div>
      <span>{label}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="p-3 rounded-xl border bg-white shadow-sm">
      <div className="text-xs opacity-60">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {hint && <div className="text-[11px] opacity-60">{hint}</div>}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-2 py-1 border-l first:border-l-0">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1 border-l first:border-l-0">{children}</td>;
}

// === Helpers ===
function makeGrid(r: number, c: number): Cell[][] {
  return Array.from({ length: r }, (_, i) =>
    Array.from({ length: c }, (_, j) => ({
      x: i,
      y: j,
      type: "empty" as CellType,
    })),
  );
}

function toggleCell(
  prev: Cell[][],
  r: number,
  c: number,
  t: "wall" | "weight",
) {
  return prev.map((row, i) =>
    row.map((cell, j) => {
      if (i !== r || j !== c) return cell;
      const next: Cell = { ...cell };
      // toggling priority: if click sets wall → wall <-> empty; same for weight
      if (t === "wall") {
        next.type = cell.type === "wall" ? "empty" : "wall";
      } else {
        next.type = cell.type === "weight" ? "empty" : "weight";
      }
      return next;
    }),
  );
}

function setCell(prev: Cell[][], r: number, c: number, t: "wall" | "weight") {
  return prev.map((row, i) =>
    row.map((cell, j) => (i === r && j === c ? { ...cell, type: t } : cell)),
  );
}

function neighbors(
  x: number,
  y: number,
  R: number,
  C: number,
): [number, number][] {
  const out: [number, number][] = [];
  if (x > 0) out.push([x - 1, y]);
  if (x < R - 1) out.push([x + 1, y]);
  if (y > 0) out.push([x, y - 1]);
  if (y < C - 1) out.push([x, y + 1]);
  return out;
}

function reconstructPath(
  came: Record<string, string | undefined>,
  goalId: string,
) {
  const path: string[] = [];
  let cur: string | undefined = goalId;
  while (cur) {
    path.push(cur);
    cur = came[cur];
  }
  return path.reverse();
}

function argMin<T>(arr: T[], key: (t: T) => number) {
  if (arr.length === 0) return 0; // Safety check for empty arrays
  
  let idx = 0;
  let best = key(arr[0]);
  for (let i = 1; i < arr.length; i++) {
    const v = key(arr[i]);
    if (v < best) {
      best = v;
      idx = i;
    }
  }
  return idx;
}
