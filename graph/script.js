let nodes = []; 
let edges = []; 
let nodeIdCounter = 0;

let history = [];
let historyIndex = -1;

let currentMode = 'node'; 
let selectedNode = null; 
let draggingNode = null;
let dragStartPos = null; 
let isAlgorithmRunning = false;
let algorithmSteps = [];
let currentStepIndex = -1;
let playInterval = null;

const svg = document.getElementById('graph-svg');
const gNodes = document.getElementById('g-nodes');
const gEdges = document.getElementById('g-edges');
const container = document.getElementById('canvas-container');
const modeIndicator = document.getElementById('mode-indicator');
const logContainer = document.getElementById('algo-log');
const tableBody = document.getElementById('dist-table-body');

function initDefaultGraph() {
    addNode(100, 200, false); 
    addNode(300, 100, false); 
    addNode(300, 300, false); 
    addNode(500, 200, false);
    
    addEdge(0, 1, 4, 'undirected', false);
    addEdge(0, 2, 2, 'undirected', false);
    addEdge(1, 2, 1, 'undirected', false);
    addEdge(1, 3, 5, 'undirected', false);
    addEdge(2, 3, 8, 'undirected', false); 
    
    saveState(); 
}

function setMode(mode) {
    currentMode = mode;
    selectedNode = null;
    document.querySelectorAll('.btn-group button:not(#btn-undo):not(#btn-redo)').forEach(b => b.classList.remove('active'));
    document.getElementById(`mode-${mode}`).classList.add('active');
    
    const weightContainer = document.getElementById('weight-input-container');
    if (weightContainer) {
        weightContainer.style.display = mode === 'edge' ? 'flex' : 'none';
    }
    
    let text = "";
    if(mode === 'node') text = "Mode: Add Node (Click empty space)";
    else if(mode === 'edge') text = "Mode: Add Edge (Select Source, then Target)";
    else text = "Mode: Move (Drag nodes)";
    modeIndicator.innerText = text;
}

container.addEventListener('mousedown', (e) => {
    if(isAlgorithmRunning) return;
    const pt = getSVGPoint(e);
    const clickedNodeId = getClickedNodeId(e.target);
    
    if (clickedNodeId !== null) {
        handleNodeClick(clickedNodeId);
        if (currentMode === 'move') {
            draggingNode = nodes.find(n => n.id === clickedNodeId);
            if(draggingNode) {
                dragStartPos = { x: draggingNode.x, y: draggingNode.y };
            }
        }
    } else {
        if (currentMode === 'node') {
            addNode(pt.x, pt.y);
        } else {
            selectedNode = null;
            render();
        }
    }
});

container.addEventListener('mousemove', (e) => {
    if (draggingNode && currentMode === 'move') {
        const pt = getSVGPoint(e);
        draggingNode.x = pt.x;
        draggingNode.y = pt.y;
        render();
    }
});

container.addEventListener('mouseup', () => {
    if (draggingNode && currentMode === 'move') {
        if (dragStartPos && (dragStartPos.x !== draggingNode.x || dragStartPos.y !== draggingNode.y)) {
            saveState();
        }
    }
    draggingNode = null;
    dragStartPos = null;
});

function getClickedNodeId(target) {
    let el = target;
    while (el && el !== svg) {
        if (el.getAttribute('data-id')) return parseInt(el.getAttribute('data-id'));
        el = el.parentElement;
    }
    return null;
}

function handleNodeClick(id) {
    if (currentMode === 'edge') {
        if (selectedNode === null) {
            selectedNode = id;
            render();
        } else {
            if (selectedNode !== id) {
                const weightInput = document.getElementById('edge-weight');
                const typeInput = document.getElementById('edge-type');
                const weight = weightInput ? parseInt(weightInput.value) : 1;
                const type = typeInput ? typeInput.value : 'undirected';
                
                if (!isNaN(weight)) {
                    addEdge(selectedNode, id, weight, type);
                }
            }
            selectedNode = null;
            render();
        }
    }
}

function getSVGPoint(event) {
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function saveState() {
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    const state = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        nodeIdCounter: nodeIdCounter
    };
    history.push(state);
    historyIndex++;
    updateUndoRedoButtons();
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        loadState(history[historyIndex]);
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        loadState(history[historyIndex]);
    }
}

function loadState(state) {
    nodes = JSON.parse(JSON.stringify(state.nodes));
    edges = JSON.parse(JSON.stringify(state.edges));
    nodeIdCounter = state.nodeIdCounter;
    render();
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    document.getElementById('btn-undo').disabled = (historyIndex <= 0) || isAlgorithmRunning;
    document.getElementById('btn-redo').disabled = (historyIndex >= history.length - 1) || isAlgorithmRunning;
}

function addNode(x, y, shouldSave = true) {
    const label = String.fromCharCode(65 + (nodeIdCounter % 26)) + (nodeIdCounter >= 26 ? Math.floor(nodeIdCounter/26) : '');
    nodes.push({ id: nodeIdCounter++, x, y, label });
    render();
    if(shouldSave) saveState();
    return nodeIdCounter - 1;
}

function addEdge(source, target, weight, type = 'undirected', shouldSave = true) {
    const existing = edges.find(e => (e.source === source && e.target === target) || (e.source === target && e.target === source));
    if (existing) {
        existing.weight = weight;
        existing.type = type;
        if(type === 'directed') {
            existing.source = source;
            existing.target = target;
        }
    } else {
        edges.push({ source, target, weight, type });
    }
    render();
    if(shouldSave) saveState();
}

function resetGraph() {
    stopPlayback();
    nodes = [];
    edges = [];
    nodeIdCounter = 0;
    currentStepIndex = -1;
    algorithmSteps = [];
    isAlgorithmRunning = false;
    document.querySelectorAll('.toolbar button').forEach(b => b.disabled = false);
    render();
    logContainer.innerHTML = '';
    tableBody.innerHTML = '';
    setMode('node');
    saveState();
}

function render() {
    gEdges.innerHTML = '';
    edges.forEach(e => {
        const n1 = nodes.find(n => n.id === e.source);
        const n2 = nodes.find(n => n.id === e.target);
        if (!n1 || !n2) return;

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", n1.x);
        line.setAttribute("y1", n1.y);
        line.setAttribute("x2", n2.x);
        line.setAttribute("y2", n2.y);
        line.setAttribute("class", "edge-line");
        line.setAttribute("id", `edge-${e.source}-${e.target}`);
        
        if(e.type === 'directed') {
            line.setAttribute("marker-end", "url(#arrowhead)");
        }
        gEdges.appendChild(line);

        const midX = (n1.x + n2.x) / 2;
        const midY = (n1.y + n2.y) / 2;
        
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", midX - 10);
        rect.setAttribute("y", midY - 10);
        rect.setAttribute("width", 20);
        rect.setAttribute("height", 20);
        rect.setAttribute("class", "edge-weight-bg");
        gEdges.appendChild(rect);

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", midX);
        text.setAttribute("y", midY);
        text.setAttribute("class", "edge-weight-text");
        text.textContent = e.weight;
        gEdges.appendChild(text);
    });

    gNodes.innerHTML = '';
    nodes.forEach(n => {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("transform", `translate(${n.x}, ${n.y})`);
        g.setAttribute("data-id", n.id);
        g.style.cursor = "pointer";

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("r", 20);
        circle.setAttribute("class", "node-circle");
        circle.setAttribute("id", `node-${n.id}`);
        
        if (selectedNode === n.id) {
            circle.style.stroke = "var(--accent)";
            circle.style.strokeWidth = "4px";
        }

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("class", "node-label");
        label.textContent = n.label;

        g.appendChild(circle);
        g.appendChild(label);
        gNodes.appendChild(g);
    });
}

function prepareAlgorithm() {
    if (nodes.length === 0) {
        alert("Please add nodes first.");
        return;
    }
    
    let hasNegativeEdge = false;
    for(let e of edges) {
        if(e.weight < 0) {
            hasNegativeEdge = true;
            break;
        }
    }
    
    const selectedAlgo = hasNegativeEdge ? 'bellman' : 'dijkstra';
    const algoName = hasNegativeEdge ? "Bellman-Ford Algorithm" : "Dijkstra Algorithm";
    
    logContainer.innerHTML = `<span style="color:var(--primary); font-weight:bold;">System selected ${algoName}.<br>👉 Click any node on the graph to start...</span>`;
    
    const selectionHandler = (e) => {
        if (isAlgorithmRunning) return;
        const clickedNodeId = getClickedNodeId(e.target);
        if (clickedNodeId !== null) {
            container.removeEventListener('mousedown', selectionHandler);
            logContainer.innerHTML = '';
            
            if (selectedAlgo === 'dijkstra') {
                runDijkstra(clickedNodeId);
            } else {
                runBellmanFord(clickedNodeId);
            }
        } 
    };
    
    container.addEventListener('mousedown', selectionHandler);
}

function runDijkstra(startNodeId) {
    startCommonAlgo();
    const dist = {};
    const parent = {};
    const visited = new Set();
    const unvisited = new Set();
    
    nodes.forEach(n => {
        dist[n.id] = Infinity;
        parent[n.id] = null;
        unvisited.add(n.id);
    });
    dist[startNodeId] = 0;

    recordStep(`<strong>Auto-Selection: Dijkstra Algorithm.</strong> All weights non-negative.<br>Initialize: Start at Node ${nodes.find(n=>n.id===startNodeId).label}.`, startNodeId, visited, dist, parent, null);

    while (unvisited.size > 0) {
        let u = null;
        let minDist = Infinity;
        unvisited.forEach(id => {
            if (dist[id] < minDist) {
                minDist = dist[id];
                u = id;
            }
        });

        if (u === null || dist[u] === Infinity) break;
        const uLabel = nodes.find(n=>n.id===u).label;
        recordStep(`Select Node ${uLabel} (Dist: ${dist[u]}).`, u, visited, dist, parent, null);

        unvisited.delete(u);
        visited.add(u);

        const neighbors = getNeighbors(u);
        for (let n of neighbors) {
            const v = n.target;
            if (visited.has(v)) continue;
            const vLabel = nodes.find(node=>node.id===v).label;
            const alt = dist[u] + n.weight;
            recordStep(`Check ${vLabel}: ${dist[u]} + ${n.weight} = ${alt}`, u, visited, dist, parent, n.edgeObj);
            if (alt < dist[v]) {
                dist[v] = alt;
                parent[v] = u;
                recordStep(`Update ${vLabel}: New dist ${alt}`, u, visited, dist, parent, n.edgeObj);
            }
        }
    }
    finishAlgo();
}

function runBellmanFord(startNodeId) {
    startCommonAlgo();
    const dist = {};
    const parent = {};
    nodes.forEach(n => {
        dist[n.id] = Infinity;
        parent[n.id] = null;
    });
    dist[startNodeId] = 0;
    
    const getReached = () => {
        const reached = new Set();
        for (const id in dist) {
            if (dist[id] !== Infinity) reached.add(parseInt(id));
        }
        return reached;
    };
    
    recordStep(`<strong>Auto-Selection: Bellman-Ford Algorithm.</strong> Negative edges detected.<br>Initialize: Start at Node ${nodes.find(n=>n.id===startNodeId).label}.`, startNodeId, getReached(), dist, parent, null);

    const V = nodes.length;
    let finalIter = 0;

    for (let i = 1; i < V; i++) {
        let changeHappened = false;
        for (let edge of edges) {
            let checks = [];
            if (edge.type === 'directed') {
                checks.push({u: edge.source, v: edge.target});
            } else {
                checks.push({u: edge.source, v: edge.target});
                checks.push({u: edge.target, v: edge.source});
            }

            for (let check of checks) {
                const u = check.u;
                const v = check.v;
                const w = edge.weight;
                if (dist[u] !== Infinity && dist[u] + w < dist[v]) {
                    dist[v] = dist[u] + w;
                    parent[v] = u;
                    changeHappened = true;
                    const uLabel = nodes.find(n=>n.id===u).label;
                    const vLabel = nodes.find(n=>n.id===v).label;
                    recordStep(`Relaxation (Iter ${i}): ${uLabel}→${vLabel} updated to ${dist[v]}`, u, getReached(), dist, parent, edge);
                }
            }
        }
        if(!changeHappened) {
            recordStep(`Optimization: No changes in Iteration ${i}. Shortest paths found early.`, null, getReached(), dist, parent, null);
            finalIter = i;
            break;
        }
        finalIter = i;
    }

    let hasNegCycle = false;
    if (finalIter === V - 1) { 
        for (let edge of edges) {
            let checks = [];
            if (edge.type === 'directed') {
                checks.push({u: edge.source, v: edge.target});
            } else {
                checks.push({u: edge.source, v: edge.target});
                checks.push({u: edge.target, v: edge.source});
            }
            for (let check of checks) {
                const u = check.u;
                const v = check.v;
                const w = edge.weight;
                if (dist[u] !== Infinity && dist[u] + w < dist[v]) {
                    hasNegCycle = true;
                    recordStep(`🔴 Negative Cycle Detected! Shortest path is not well-defined.`, u, getReached(), dist, parent, edge);
                    break; 
                }
            }
            if(hasNegCycle) break;
        }
    }

    if (!hasNegCycle) {
        recordStep("Algorithm Complete. Shortest paths found (No negative cycles).", null, getReached(), dist, parent, null);
    } else {
        recordStep("Algorithm Terminated: Negative Cycle Exists. Distances are undefined.", null, getReached(), dist, parent, null);
        document.getElementById('error-reasons').innerHTML = '❌ Graphs with negative cycles';
        document.getElementById('error-modal').style.display = 'flex';
    }
    finishAlgo();
}

function startCommonAlgo() {
    isAlgorithmRunning = true;
    algorithmSteps = [];
    currentStepIndex = -1;
    document.querySelectorAll('.toolbar button').forEach(b => {
        if(!b.id.startsWith('btn-') || b.id === 'btn-run-algo') b.disabled = true;
    });
    document.querySelectorAll('.playback-controls button').forEach(b => b.disabled = false);
    updateUndoRedoButtons();
}

function finishAlgo() {
    recordStep("Algorithm Complete.", null, new Set(), {}, {}, null);
    document.getElementById('step-total').innerText = algorithmSteps.length;
    step(1);
}

function recordStep(msg, activeNodeId, visitedSet, distTable, parentTable, highlightedEdge) {
    let finalTable = distTable;
    let finalParent = parentTable;
    if(Object.keys(distTable).length === 0 && algorithmSteps.length > 0) {
        finalTable = algorithmSteps[algorithmSteps.length-1].table;
        finalParent = algorithmSteps[algorithmSteps.length-1].parentTable;
    }
    algorithmSteps.push({
        msg: msg,
        activeNode: activeNodeId,
        visited: new Set(visitedSet),
        table: JSON.parse(JSON.stringify(finalTable)),
        parentTable: JSON.parse(JSON.stringify(finalParent)),
        edge: highlightedEdge
    });
}

function getNeighbors(u) {
    const neighbors = [];
    edges.forEach(edge => {
        if (edge.type === 'directed') {
            if (edge.source === u) neighbors.push({ target: edge.target, weight: edge.weight, edgeObj: edge });
        } 
        else {
            if (edge.source === u) neighbors.push({ target: edge.target, weight: edge.weight, edgeObj: edge });
            else if (edge.target === u) neighbors.push({ target: edge.source, weight: edge.weight, edgeObj: edge });
        }
    });
    return neighbors;
}

function step(direction) {
    const nextIndex = currentStepIndex + direction;
    if (nextIndex < 0 || nextIndex >= algorithmSteps.length) {
        if (direction === 1) stopPlayback();
        return;
    }
    currentStepIndex = nextIndex;
    const state = algorithmSteps[currentStepIndex];
    document.getElementById('step-count').innerText = currentStepIndex + 1;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span style="color:#64748b; font-size:0.8em">[Step ${currentStepIndex+1}]</span> ${state.msg}`;
    logContainer.prepend(entry);
    renderTable(state.table, state.parentTable, state.activeNode);
    updateVisuals(state);
    if (currentStepIndex === algorithmSteps.length - 1) {
        stopPlayback();
        isAlgorithmRunning = false;
        document.querySelectorAll('.toolbar button').forEach(b => b.disabled = false);
        updateUndoRedoButtons();
    }
}

function updateVisuals(state) {
    document.querySelectorAll('.node-circle').forEach(c => {
        c.style.fill = 'var(--node-default)';
        c.style.stroke = 'var(--text-main)';
    });
    document.querySelectorAll('.edge-line').forEach(l => {
        l.style.stroke = 'var(--edge-default)';
        l.style.strokeWidth = '2px';
        const originalType = l.getAttribute('marker-end');
        if(originalType && originalType.includes('highlight')) {
                l.setAttribute('marker-end', 'url(#arrowhead)');
        }
    });
    state.visited.forEach(id => {
        const el = document.getElementById(`node-${id}`);
        if(el) el.style.fill = 'var(--node-visited)';
    });
    if (state.activeNode !== null) {
        const el = document.getElementById(`node-${state.activeNode}`);
        if(el) {
            el.style.fill = 'var(--node-current)';
            el.style.stroke = 'var(--accent)';
        }
    }
    if (state.edge) {
        let el = document.getElementById(`edge-${state.edge.source}-${state.edge.target}`);
        if (!el) el = document.getElementById(`edge-${state.edge.target}-${state.edge.source}`);
        if (el) {
            el.style.stroke = 'var(--edge-highlight)';
            el.style.strokeWidth = '4px';
            if(state.edge.type === 'directed') {
                el.setAttribute('marker-end', 'url(#arrowhead-highlight)');
            }
        }
    }
}

function renderTable(distMap, parentMap, activeNode) {
    tableBody.innerHTML = '';
    nodes.forEach(n => {
        const tr = document.createElement('tr');
        const d = distMap[n.id];
        const displayDist = (d === Infinity || d === null) ? '∞' : d;
        let parentLabel = '-';
        if (parentMap && parentMap[n.id] !== null) {
            const pNode = nodes.find(node => node.id === parentMap[n.id]);
            if (pNode) parentLabel = pNode.label;
        }
        let pathStr = '-';
        if (d !== Infinity && d !== null) {
            let pathNodes = [];
            let currId = n.id;
            let safeGuard = 0;
            while (currId !== null && currId !== undefined && safeGuard < 100) {
                const currNode = nodes.find(x => x.id === currId);
                if (currNode) pathNodes.unshift(currNode.label);
                if (distMap[currId] === 0) break;
                if (parentMap && parentMap[currId] !== undefined) currId = parentMap[currId];
                else break;
                safeGuard++;
            }
            pathStr = pathNodes.join(' → ');
        }
        tr.innerHTML = `<td><strong>${n.label}</strong></td><td>${displayDist}</td><td>${parentLabel}</td><td style="font-size: 0.85rem; color: #555;">${pathStr}</td>`;
        if (n.id === activeNode) tr.classList.add('row-updated');
        tableBody.appendChild(tr);
    });
}

function togglePlay() {
    const btn = document.getElementById('btn-play');
    if (playInterval) stopPlayback();
    else {
        btn.innerText = "❚❚ Pause";
        playInterval = setInterval(() => step(1), 1500);
    }
}

function stopPlayback() {
    clearInterval(playInterval);
    playInterval = null;
    document.getElementById('btn-play').innerText = "▶ Play";
}

(function initResizers() {
    
    const resizerX = document.getElementById('resizer-x');
    const sidebar = document.getElementById('sidebar');
    
    resizerX.addEventListener('mousedown', (e) => {
        e.preventDefault();
        resizerX.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        
        const moveX = (moveEvent) => {
            const newWidth = window.innerWidth - moveEvent.clientX;
            
            if (newWidth > 200 && newWidth < 800) {
                sidebar.style.width = newWidth + 'px';
            }
        };
        
        const stopX = () => {
            resizerX.classList.remove('resizing');
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', moveX);
            document.removeEventListener('mouseup', stopX);
        };
        
        document.addEventListener('mousemove', moveX);
        document.addEventListener('mouseup', stopX);
    });

    const resizerY = document.getElementById('resizer-y');
    const tablePanel = document.getElementById('table-panel');
    
    resizerY.addEventListener('mousedown', (e) => {
        e.preventDefault();
        resizerY.classList.add('resizing');
        document.body.style.cursor = 'row-resize';
        
        const moveY = (moveEvent) => {
           
            const sidebarRect = sidebar.getBoundingClientRect();
            
            const newHeight = sidebarRect.bottom - moveEvent.clientY;
            
            if (newHeight > 100 && newHeight < sidebarRect.height * 0.8) {
                tablePanel.style.height = newHeight + 'px';
            }
        };
        
        const stopY = () => {
            resizerY.classList.remove('resizing');
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', moveY);
            document.removeEventListener('mouseup', stopY);
        };
        
        document.addEventListener('mousemove', moveY);
        document.addEventListener('mouseup', stopY);
    });
})();

initDefaultGraph();
render();