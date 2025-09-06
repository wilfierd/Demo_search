import React, { useEffect, useMemo, useRef, useState } from "react";
import { bfs } from "./algorithms/bfs";
import { dfs } from "./algorithms/dfs";
import { ucs } from "./algorithms/ucs";
import { greedy } from "./algorithms/greedy";
import { astar } from "./algorithms/astar";
import { idOf, type GridCell, type Point, type SearchResult } from "./algorithms/types";

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
// Legacy NodeData removed; logic moved to standalone modules

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

// idOf and manhattan now imported from algorithms/types as needed

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

  // Precomputed search plan/result and playback state
  const refPlan = useRef<SearchResult | null>(null);
  const refStartTime = useRef<number | null>(null);
  const [playIdx, setPlayIdx] = useState(0); // how many visited nodes are shown

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
    refPlan.current = null;
    setPlayIdx(0);
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
    
    // ===== RANDOM OBSTACLES FUNCTION COMPLETED =====
    // PRESENTATION NOTES:
    // - Creates random maze with ~25% walls (black) and ~8% weights (yellow)
    // - Preserves start (green) and goal (red) positions
    // - Resets all algorithm states for fresh start
    // - Use this to test algorithm behavior on different terrains
    // ================================================
  }

  function clearBoard() {
    if (running) return;
    setGrid((prev) =>
      prev.map((row) => row.map((cell) => ({ ...cell, type: "empty" }))),
    );
    hardResetVisual();
    
    // ===== CLEAR BOARD FUNCTION COMPLETED =====
    // PRESENTATION NOTES:
    // - Removes all walls and weights from grid
    // - Creates clean empty grid for new experiments
    // - Resets all search algorithm states
    // - Keeps start and goal positions unchanged
    // ===========================================
  }

  function resetRunOnly() {
    setVisited(new Set());
    setFrontierSet(new Set());
    setPathSet(new Set());
    refPlan.current = null;
    setPlayIdx(0);
    setNoPath(false);
    setLiveMetrics(initialMetrics);
    
    // ===== RESET RUN FUNCTION COMPLETED =====
    // PRESENTATION NOTES:
    // - Clears all algorithm search states
    // - Removes visited nodes (green), frontier (blue), path (purple)
    // - Resets all internal data structures
    // - Keeps grid layout unchanged (walls, weights, start, goal)
    // - Ready for fresh algorithm run
    // =========================================
  }

  function computePlan(): SearchResult {
    // Run selected algorithm to completion and return its result
    const asGrid: GridCell[][] = grid.map((row) => row.map((c) => ({ ...c })));
    if (algo === "BFS") return bfs(asGrid, start as Point, goal as Point);
    if (algo === "DFS") return dfs(asGrid, start as Point, goal as Point);
    if (algo === "UCS") return ucs(asGrid, start as Point, goal as Point);
    if (algo === "Greedy") return greedy(asGrid, start as Point, goal as Point);
    return astar(asGrid, start as Point, goal as Point);
  }

  function run() {
    if (running && paused) {
      setPaused(false);
      return;
    }
    if (!running) {
      resetRunOnly();
      const res = computePlan();
      refPlan.current = res;
      refStartTime.current = performance.now();
      setVisited(new Set());
      setPathSet(new Set());
      setFrontierSet(new Set()); // frontier not animated in simplified mode
      setNoPath(!res.found);
      setPlayIdx(0);
      setLiveMetrics({
        nodesExpanded: 0,
        visitedCurrent: 0,
        visitedPeak: 0,
        frontierCurrent: 0,
        frontierPeak: res.frontierPeak,
        pathLength: 0,
        totalCost: 0,
        timeMs: 0,
        found: false,
      });
      setRunning(true);
      setPaused(false);
    }
  }

  function pause() {
    if (!running) return;
    setPaused(true);
    
    // ===== PAUSE FUNCTION COMPLETED =====
    // PRESENTATION NOTES:
    // - Pauses algorithm execution mid-run
    // - Preserves current search state
    // - Can resume with run() button
    // - Useful for explaining current algorithm state
    // =====================================
  }
  
  function stop() {
    setRunning(false);
    setPaused(false);
    
    // ===== STOP FUNCTION COMPLETED =====
    // PRESENTATION NOTES:
    // - Completely stops algorithm execution
    // - Keeps final results visible (path, visited nodes)
    // - Algorithm can be restarted with run() button
    // - Final metrics show algorithm performance
    // ====================================
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

  // Simplified step/animation: reveal one more visited node from precomputed plan
  function stepOnce() {
    const res = refPlan.current;
    if (!res) return;
    if (playIdx >= res.visitedOrder.length) return;
    const pt = res.visitedOrder[playIdx];
    const id = idOf(pt.x, pt.y);
    setVisited((prev) => new Set(prev).add(id));
    const nodesExpanded = playIdx + 1;
    const timeMs = refStartTime.current ? performance.now() - refStartTime.current : 0;
    setLiveMetrics((prev) => ({
      ...prev,
      nodesExpanded,
      visitedCurrent: nodesExpanded,
      visitedPeak: Math.max(prev.visitedPeak, nodesExpanded),
      frontierCurrent: 0,
      timeMs,
    }));
    setPlayIdx((i) => i + 1);
  }

  function step() {
    if (!running) {
      resetRunOnly();
      const res = computePlan();
      refPlan.current = res;
      refStartTime.current = performance.now();
      setNoPath(!res.found);
      setRunning(true);
      setPaused(true);
    }
    stepOnce();
    
    // ===== STEP FUNCTION COMPLETED =====
    // PRESENTATION NOTES:
    // - Executes ONE step of the selected algorithm
    // - If not running: initializes algorithm and starts
    // - If running: advances algorithm by one iteration
    // - Perfect for step-by-step demonstration
    // - Shows exactly how each algorithm explores nodes
    // ====================================
  }

  // Drive animation when running
  useEffect(() => {
    if (!running || paused) return;
    const res = refPlan.current;
    if (!res) return;
    if (playIdx >= res.visitedOrder.length) {
      // Finished revealing visited nodes; render path if found
      if (res.found) {
        const pathIds = new Set(res.path.map((p) => idOf(p.x, p.y)));
        setPathSet(pathIds);
        setLiveMetrics((prev) => ({
          ...prev,
          pathLength: res.pathLength,
          totalCost: res.totalCost,
          visitedPeak: res.visitedPeak,
          frontierPeak: res.frontierPeak,
          found: true,
        }));
        setHistory((prev) => [
          {
            algo,
            nodesExpanded: res.nodesExpanded,
            pathLength: res.pathLength,
            totalCost: res.totalCost,
            frontierPeak: res.frontierPeak,
            timeMs: res.timeMs,
          },
          ...prev,
        ].slice(0, 8));
        setNoPath(false);
      } else {
        setNoPath(true);
      }
      setRunning(false);
      return;
    }
    const handle = setTimeout(() => {
      stepOnce();
    }, speedMs);
    return () => clearTimeout(handle);
  }, [running, paused, speedMs, playIdx, algo]);

  const cellSize = useMemo(() => {
    // keep grid roughly responsive
    const maxW = 900; // px
    const size = Math.floor(Math.min(28, Math.max(14, maxW / (cols + 4))));
    return size;
  }, [cols]);

  return (
    <div className="w-full flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">AI Search Visualizer</h1>
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
        <Stat label="TiBme" value={`${liveMetrics.timeMs.toFixed(0)} ms`} />
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

// Removed in-component search helpers; algorithms now live in src/algorithms/*
