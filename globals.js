// --- Global state (canvas, dimensions, constants) ---
window.gameCanvas = document.getElementById("screen");
window.size = Math.min(window.innerHeight, window.innerWidth);
window.gameCanvas.width = window.size;
window.gameCanvas.height = window.size;
window.cx = window.gameCanvas.getContext("2d");

// --- Entities & Constants ---
window.EMPTY = "empty";
window.BOMB = "bomb";
window.COIN = "coin";
window.ENEMY = "enemy";

window.COLORS = {
    bg: "#1a1a2e",
    grid: "#16213e",
    cellCovered: "#0f3460",
    cellRevealed: "#e94560",
    cellEmpty: "#222",
    text: "#eee",
    bomb: "#e94560",
    coin: "#fcd34d",
    enemy: "#4ade80",
    player: "#60a5fa",
};
