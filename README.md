# AI Search Algorithm Visualizer

A React-based interactive visualization tool for pathfinding algorithms including BFS, DFS, UCS, Greedy Search, and A*.

## Features

- **Interactive Grid**: Click and drag to draw walls and weighted cells
- **Multiple Algorithms**: Visualize BFS, DFS, UCS, Greedy Search, and A* algorithms
- **Real-time Visualization**: Watch algorithms explore the search space step by step
- **Live Metrics**: Track nodes expanded, path length, total cost, and execution time
- **Algorithm Comparison**: Compare performance metrics across different algorithms
- **Responsive Design**: Works on desktop and mobile devices

## Algorithms Implemented

- **BFS (Breadth-First Search)**: Guarantees shortest path when all edges have equal weight
- **DFS (Depth-First Search)**: Explores as far as possible along each branch
- **UCS (Uniform Cost Search)**: Finds optimal path considering edge weights
- **Greedy Search**: Uses heuristic to guide search toward goal
- **A* Search**: Combines UCS and Greedy for optimal pathfinding

### Standalone BFS module

If you want to run BFS independently of the React visualizer, a small, self-contained implementation is available at `src/algorithms/bfs.ts`.

Quick usage:

```
import { bfs, type GridCell } from "./src/algorithms/bfs";

// Build a grid
const R = 5, C = 8;
const grid: GridCell[][] = Array.from({ length: R }, (_, i) =>
  Array.from({ length: C }, (_, j) => ({ x: i, y: j, type: "empty" as const }))
);

// Add a wall
grid[1][3].type = "wall";

// Run BFS (4-neighbor, ignores weights for ordering)
const res = bfs(grid, { x: 0, y: 0 }, { x: 4, y: 7 });

console.log({
  found: res.found,
  pathLength: res.pathLength,
  totalCost: res.totalCost,
  nodesExpanded: res.nodesExpanded,
});
// res.path is an array of {x,y} points; res.visitedOrder is the expansion order.
```

Notes:
- BFS returns the shortest path in number of steps for unweighted grids. If the grid has `weight` cells, BFS still explores by layers (ignoring weight for ordering), so results may not be cost-optimal.
- The weighting convention matches the visualizer: `empty` cells cost 1, `weight` cells cost 5 (used only to compute `totalCost`, not to guide exploration).

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd test_search
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Select Algorithm**: Choose from BFS, DFS, UCS, Greedy, or A* in the dropdown
2. **Edit Mode**: Switch between drawing walls, weights, setting start/goal positions
3. **Draw Obstacles**: Click and drag to create walls or weighted areas
4. **Run Visualization**: Click "Run" to start the algorithm visualization
5. **Control Playback**: Use Pause, Step, Stop, and Reset controls
6. **Adjust Speed**: Use the speed slider to control visualization speed
7. **Compare Results**: Run different algorithms and compare their performance metrics

## Grid Elements

- **White cells**: Empty, passable terrain (cost: 1)
- **Dark gray cells**: Walls, impassable terrain
- **Orange cells**: Weighted terrain (cost: 5)
- **Green border**: Start position
- **Red border**: Goal position
- **Light blue**: Cells in the frontier (to be explored)
- **Purple**: Visited cells (already explored)
- **Green**: Final path from start to goal

## Performance Metrics

- **Nodes Expanded**: Total number of cells visited during search
- **Path Length**: Number of steps in the final path
- **Total Cost**: Sum of all edge weights in the path
- **Frontier Peak**: Maximum number of cells in frontier at any time
- **Time**: Algorithm execution time in milliseconds

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Custom CSS** with utility classes for styling
- **Modern ES6+** features

## Project Structure

```
test_search/
├── src/
│   ├── SearchVisualizer.tsx    # Main algorithm visualizer component
│   ├── App.tsx                 # Root application component
│   ├── main.tsx               # Application entry point
│   ├── index.css              # Global styles and utilities
│   └── App.css                # Component-specific styles
├── public/                    # Static assets
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Educational Use

This visualizer is designed for educational purposes to help understand:
- How different search algorithms work
- The trade-offs between optimality and efficiency
- The impact of heuristics on search performance
- Memory usage patterns in search algorithms

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

Requires a modern browser with ES6+ support.
