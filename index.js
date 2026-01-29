const screen = document.getElementById("screen");

const size = Math.min(window.innerHeight, window.innerWidth);
screen.width = size;
screen.height = size;

const cx = screen.getContext("2d");

// --- Audio System ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

const SoundManager = {
    playTone: (freq, type, duration, vol = 0.1) => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },
    playMove: () => SoundManager.playTone(300, 'sine', 0.1, 0.05),
    playReveal: () => SoundManager.playTone(800, 'triangle', 0.1, 0.05),
    playCoin: () => {
        SoundManager.playTone(1200, 'sine', 0.1, 0.1);
        setTimeout(() => SoundManager.playTone(1800, 'square', 0.2, 0.1), 50);
    },
    playAttack: () => {
        const duration = 0.1;
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = audioCtx.createGain();
        gain.gain.value = 0.1;
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        noise.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start();
    },
    playDamage: () => SoundManager.playTone(100, 'sawtooth', 0.3, 0.2),
    playWin: () => {
        [400, 500, 600, 800].forEach((f, i) => setTimeout(() => SoundManager.playTone(f, 'square', 0.2, 0.1), i * 100));
    },
    playLose: () => {
        [300, 200, 100].forEach((f, i) => setTimeout(() => SoundManager.playTone(f, 'sawtooth', 0.4, 0.2), i * 200));
    }
};

// --- Entities & Constants ---
const EMPTY = "empty";
const BOMB = "bomb";
const COIN = "coin";
const ENEMY = "enemy";

// Visual Polish
const COLORS = {
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

const board_size = 13;
const cell_size = size / (4 + board_size + 4);

let player = { x: 0, y: 0, coins: 0, renderX: 0, renderY: 0 };
let enemies = [];
let particles = [];
let gameState = "PLAYING"; // PLAYING, WON, LOST
let shake = 0;

// --- Helper Functions ---
function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5;
        this.life = 1.0;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.05;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 4, 4);
        ctx.restore();
    }
}

function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function fillCircle(cX, cY, r, color) {
    cx.beginPath();
    cx.arc(cX, cY, r, 0, 2 * Math.PI, false);
    cx.fillStyle = color;
    cx.fill();
    cx.lineWidth = 2;
    cx.strokeStyle = '#000000';
    cx.stroke();
    cx.lineWidth = 1;
}

function makeBoard() {
    let board = [];
    for (let i = 0; i < board_size; i++) {
        let row = [];
        for (let j = 0; j < board_size; j++) {
            row.push({ entity: EMPTY, covered: true, hint: 0 });
        }
        board.push(row);
    }
    return board;
}

function drawBoard(board) {
    const start = (size / 2) - (cell_size * (board_size / 2));

    // UI: Coin Counter
    cx.fillStyle = COLORS.coin;
    cx.font = "bold 24px Arial";
    cx.textAlign = "left";
    cx.textBaseline = "top";
    cx.fillText(`Coins: ${player.coins}/3`, 20, 20);

    // Draw Grid
    for (let i = 0; i < board_size; i++) {
        for (let j = 0; j < board_size; j++) {
            const x = start + (j * cell_size);
            const y = start + (i * cell_size);

            const cell = board[i][j];

            // Base Cell
            cx.fillStyle = COLORS.grid;
            cx.fillRect(x, y, cell_size, cell_size);
            cx.strokeStyle = "#000";
            cx.lineWidth = 2;
            cx.strokeRect(x, y, cell_size, cell_size);

            // Revealed Content
            if (!cell.covered || gameState !== "PLAYING") {
                cx.fillStyle = COLORS.cellEmpty;
                cx.fillRect(x, y, cell_size, cell_size);
                cx.strokeRect(x, y, cell_size, cell_size);

                const centerX = x + cell_size / 2;
                const centerY = y + cell_size / 2;

                if (cell.entity === BOMB) {
                    fillCircle(centerX, centerY, (cell_size / 2) - 4, COLORS.bomb);
                    // Bomb Highlight
                    cx.fillStyle = "rgba(255, 255, 255, 0.3)";
                    cx.beginPath();
                    cx.arc(centerX - 5, centerY - 5, 4, 0, Math.PI * 2);
                    cx.fill();
                } else if (cell.entity === COIN) {
                    fillCircle(centerX, centerY, (cell_size / 2) - 6, COLORS.coin);
                    cx.fillStyle = "rgba(255, 255, 255, 0.5)";
                    cx.beginPath();
                    cx.arc(centerX - 4, centerY - 4, 3, 0, Math.PI * 2);
                    cx.fill();
                } else if (cell.entity === ENEMY) {
                    // Static placeholder if needed, but we draw dynamic enemies below
                } else if (cell.hint > 0) {
                    cx.fillStyle = COLORS.text;
                    cx.font = `bold ${cell_size * 0.6}px monospace`;
                    cx.textAlign = "center";
                    cx.textBaseline = "middle";
                    cx.fillText(cell.hint.toString(), centerX, centerY - 5);

                    // Neighbor Dots
                    let hasCoin = false;
                    let hasEnemy = false;

                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const ny = i + dy;
                            const nx = j + dx;
                            if (valid(nx, ny)) {
                                if (board[ny][nx].entity === COIN) hasCoin = true;
                                if (board[ny][nx].entity === ENEMY) hasEnemy = true;
                            }
                        }
                    }

                    const dotY = y + cell_size - 8;
                    if (hasCoin && hasEnemy) {
                        fillCircle(centerX - 5, dotY, 3, COLORS.coin);
                        fillCircle(centerX + 5, dotY, 3, COLORS.enemy);
                    } else if (hasCoin) {
                        fillCircle(centerX, dotY, 3, COLORS.coin);
                    } else if (hasEnemy) {
                        fillCircle(centerX, dotY, 3, COLORS.enemy);
                    }
                }
            }

            // Cover
            if (cell.covered && gameState === "PLAYING") {
                cx.fillStyle = COLORS.cellCovered;
                cx.fillRect(x + 2, y + 2, cell_size - 4, cell_size - 4);

                // Bevel effect
                cx.fillStyle = "rgba(255,255,255,0.1)";
                cx.fillRect(x + 2, y + 2, cell_size - 4, (cell_size - 4) / 2);
            }
        }
    }

    // Draw Enemies (from list)
    enemies.forEach(e => {
        if (e.dead) return;

        // Don't draw if the tile is covered (hidden)
        if (board[e.y][e.x].covered) return;

        const rx = (e.renderX !== undefined ? e.renderX : e.x);
        const ry = (e.renderY !== undefined ? e.renderY : e.y);

        const px = start + (rx * cell_size);
        const py = start + (ry * cell_size);

        fillCircle(px + cell_size / 2, py + cell_size / 2, (cell_size / 2) - 4, COLORS.enemy);

        // Eyes
        cx.fillStyle = "#000";
        cx.fillRect(px + cell_size / 2 - 6, py + cell_size / 2 - 4, 4, 4);
        cx.fillRect(px + cell_size / 2 + 2, py + cell_size / 2 - 4, 4, 4);
    });

    // Draw Player
    if (gameState !== "LOST") {
        const rx = (player.renderX !== undefined ? player.renderX : player.x);
        const ry = (player.renderY !== undefined ? player.renderY : player.y);

        const px = start + (rx * cell_size);
        const py = start + (ry * cell_size);

        fillCircle(px + cell_size / 2, py + cell_size / 2, (cell_size / 2) - 4, COLORS.player);

        // Simple face
        cx.fillStyle = "#fff";
        cx.fillRect(px + cell_size / 2 - 5, py + cell_size / 2 - 3, 3, 3);
        cx.fillRect(px + cell_size / 2 + 2, py + cell_size / 2 - 3, 3, 3);
    }

    // Particles
    particles.forEach(p => p.draw(cx));

    // Game Over / Win UI
    if (gameState !== "PLAYING") {
        cx.fillStyle = "rgba(0, 0, 0, 0.7)";
        cx.fillRect(0, size / 2 - 60, size, 120);

        cx.fillStyle = gameState === "WON" ? COLORS.coin : COLORS.bomb;
        cx.font = "bold 48px Arial";
        cx.textAlign = "center";
        cx.textBaseline = "middle";
        cx.shadowColor = "#000";
        cx.shadowBlur = 10;
        cx.fillText(gameState === "WON" ? "YOU WIN!" : "GAME OVER", size / 2, size / 2);
        cx.shadowBlur = 0;

        cx.fillStyle = "#fff";
        cx.font = "20px Arial";
        cx.fillText("Press R to Restart", size / 2, size / 2 + 40);
    }
}

function update() {
    // Lerp Player
    player.renderX = lerp(player.renderX, player.x, 0.2);
    player.renderY = lerp(player.renderY, player.y, 0.2);

    // Lerp Enemies
    enemies.forEach(e => {
        if (e.renderX === undefined) { e.renderX = e.x; e.renderY = e.y; }
        e.renderX = lerp(e.renderX, e.x, 0.1);
        e.renderY = lerp(e.renderY, e.y, 0.1);
    });

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function loop() {
    update();

    cx.fillStyle = COLORS.bg;
    cx.fillRect(0, 0, size, size);

    cx.save();
    if (shake > 0) {
        const dx = (Math.random() - 0.5) * shake;
        const dy = (Math.random() - 0.5) * shake;
        cx.translate(dx, dy);
        shake *= 0.9;
        if (shake < 0.5) shake = 0;
    }

    drawBoard(board);
    cx.restore();

    requestAnimationFrame(loop);
}

function valid(x, y) {
    return x >= 0 && y >= 0 && x < board_size && y < board_size;
}

function reveal(x, y) {
    if (!valid(x, y)) return;
    if (!board[y][x].covered) return;

    board[y][x].covered = false;

    // Visual Pulse
    const start = (size / 2) - (cell_size * (board_size / 2));
    const px = start + (x * cell_size) + cell_size / 2;
    const py = start + (y * cell_size) + cell_size / 2;
    createParticles(px, py, COLORS.cellRevealed, 5);
    SoundManager.playReveal();

    // Flood fill if empty and no adjacent bombs (hint 0)
    if (board[y][x].entity === EMPTY && board[y][x].hint === 0) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                reveal(x + dx, y + dy);
            }
        }
    }
}

function updateHints(x, y, delta) {
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const nr = y + i;
            const nc = x + j;
            if (valid(nc, nr)) {
                board[nr][nc].hint += delta;
            }
        }
    }
}

function updateEnemies() {
    enemies.forEach(e => {
        if (e.dead) return;

        let justRevealed = false;

        // 1. Reveal if adjacent to player
        if (board[e.y][e.x].covered) {
            const dx = Math.abs(player.x - e.x);
            const dy = Math.abs(player.y - e.y);

            if (dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0)) {
                board[e.y][e.x].covered = false;
                justRevealed = true;
                SoundManager.playReveal();
            }
        }

        // 2. Move active enemies
        if (board[e.y][e.x].covered || justRevealed) return;

        // Simple Greedy Chase
        let bestDist = Infinity;
        let moveX = 0;
        let moveY = 0;

        const directions = [
            { dx: 0, dy: -1 }, // Up
            { dx: 0, dy: 1 },  // Down
            { dx: -1, dy: 0 }, // Left
            { dx: 1, dy: 0 }   // Right
        ];

        for (const dir of directions) {
            const dx = dir.dx;
            const dy = dir.dy;
            const tx = e.x + dx;
            const ty = e.y + dy;

            // Avoid other enemies
            const occupied = enemies.some(other => !other.dead && other.x === tx && other.y === ty);
            if (valid(tx, ty) && !occupied) {
                const dist = Math.abs(player.x - tx) + Math.abs(player.y - ty);
                if (dist < bestDist) {
                    bestDist = dist;
                    moveX = dx;
                    moveY = dy;
                }
            }
        }

        // Apply Move
        if (moveX !== 0 || moveY !== 0) {
            const destX = e.x + moveX;
            const destY = e.y + moveY;

            if (destX === player.x && destY === player.y) {
                gameState = "LOST"; // Enemy Caught Player
                SoundManager.playDamage();
                shake = 20;
            } else {
                e.x = destX;
                e.y = destY;

                // Logic update for hints
                if (board[e.y - moveY][e.x - moveX].entity === ENEMY) {
                    board[e.y - moveY][e.x - moveX].entity = EMPTY;
                    updateHints(e.x - moveX, e.y - moveY, -1);
                }

                const destCell = board[destY][destX];
                if (destCell.entity === BOMB) {
                    e.dead = true;
                    destCell.entity = EMPTY;
                    updateHints(destX, destY, -1);
                    board[destY][destX].covered = false;

                    SoundManager.playDamage();
                    shake = 10;

                    const start = (size / 2) - (cell_size * (board_size / 2));
                    createParticles(start + (destX * cell_size), start + (destY * cell_size), COLORS.bomb, 20);
                } else if (destCell.entity === COIN) {
                    // Ignore
                } else {
                    destCell.entity = ENEMY;
                    updateHints(destX, destY, 1);
                    destCell.covered = false;
                }
            }
        }
    });

    enemies = enemies.filter(e => !e.dead);
}

function processTurn() {
    updateEnemies();
    // No more drawBoard() here, it's in the loop
}

function attack(dx, dy) {
    if (gameState !== "PLAYING") return;

    const tx = player.x + dx;
    const ty = player.y + dy;

    if (valid(tx, ty)) {
        SoundManager.playAttack();
        const start = (size / 2) - (cell_size * (board_size / 2));
        const px = start + (tx * cell_size) + cell_size / 2;
        const py = start + (ty * cell_size) + cell_size / 2;

        // Attack visual
        createParticles(px, py, "#fff", 5);

        const cell = board[ty][tx];

        if (cell.entity === ENEMY) {
            cell.entity = EMPTY;
            updateHints(tx, ty, -1);

            const idx = enemies.findIndex(e => e.x === tx && e.y === ty);
            if (idx !== -1) enemies[idx].dead = true;

            createParticles(px, py, COLORS.enemy, 15);
            SoundManager.playDamage();
            shake = 5;
        }

        processTurn();
    }
}

function movePlayer(dx, dy) {
    if (gameState !== "PLAYING") return;

    // Restart context check
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const newX = player.x + dx;
    const newY = player.y + dy;

    if (valid(newX, newY)) {
        // Collision check with Enemy
        if (board[newY][newX].entity === ENEMY) {
            gameState = "LOST";
            SoundManager.playDamage();
            shake = 20;
            return;
        }

        player.x = newX;
        player.y = newY;
        SoundManager.playMove();

        const cell = board[newY][newX];

        if (cell.entity === BOMB) {
            gameState = "LOST";
            board[newY][newX].covered = false;
            shake = 30;
            SoundManager.playDamage();
            SoundManager.playLose();
        } else {
            if (cell.entity === COIN) {
                player.coins += 1;
                cell.entity = EMPTY;
                updateHints(newX, newY, -1);
                SoundManager.playCoin();
                createParticles((size / 2) - (cell_size * (board_size / 2)) + newX * cell_size + cell_size / 2,
                    (size / 2) - (cell_size * (board_size / 2)) + newY * cell_size + cell_size / 2,
                    COLORS.coin, 10);
            }

            reveal(newX, newY);

            if (newX === board_size - 1 && newY === board_size - 1) {
                if (player.coins >= 3) {
                    gameState = "WON";
                    SoundManager.playWin();
                    createParticles(size / 2, size / 2, COLORS.coin, 50);
                }
            }
        }

        processTurn();
    }
}

function generateLevel(board, count) {
    enemies = [];
    player.coins = 0;

    let genCount = 0;
    let attempts = 0;
    const maxAttempts = 2000;

    // 1. Bombs
    while (genCount < count && attempts < maxAttempts) {
        attempts++;
        const r = Math.floor(Math.random() * board_size);
        const c = Math.floor(Math.random() * board_size);

        if (r < 3 && c < 3) continue;
        if (r > board_size - 4 && c > board_size - 4) continue;

        if (board[r][c].entity === EMPTY) {
            board[r][c].entity = BOMB;
            updateHints(c, r, 1);
            genCount += 1;
        }
    }

    // 2. Coins (3)
    let coinCount = 0;
    attempts = 0;
    while (coinCount < 3 && attempts < maxAttempts) {
        attempts++;
        const r = Math.floor(Math.random() * board_size);
        const c = Math.floor(Math.random() * board_size);

        if (r < 3 && c < 3) continue;
        if (r > board_size - 4 && c > board_size - 4) continue;

        if (board[r][c].entity === EMPTY) {
            board[r][c].entity = COIN;
            updateHints(c, r, 1);
            coinCount++;
        }
    }

    // 3. Enemies (5)
    let enemyCount = 0;
    attempts = 0;
    while (enemyCount < 5 && attempts < maxAttempts) {
        attempts++;
        const r = Math.floor(Math.random() * board_size);
        const c = Math.floor(Math.random() * board_size);

        if (r < 3 && c < 3) continue;
        if (r > board_size - 4 && c > board_size - 4) continue;

        if (board[r][c].entity === EMPTY) {
            board[r][c].entity = ENEMY;
            enemies.push({ x: c, y: r, dead: false, renderX: c, renderY: r });
            updateHints(c, r, 1);
            enemyCount++;
        }
    }

    if (attempts >= maxAttempts) {
        console.warn("Could not place all items");
    }
}

// Input Handling
document.addEventListener('keydown', (e) => {
    if (e.repeat) return; // Prevent hold-key spam

    // Restart logic
    if (gameState !== "PLAYING" && (e.key === 'r' || e.key === 'R')) {
        location.reload();
        return;
    }

    switch (e.key) {
        // Movement
        case 'w': case 'W': movePlayer(0, -1); break;
        case 's': case 'S': movePlayer(0, 1); break;
        case 'a': case 'A': movePlayer(-1, 0); break;
        case 'd': case 'D': movePlayer(1, 0); break;

        // Attack
        case 'ArrowUp': attack(0, -1); break;
        case 'ArrowDown': attack(0, 1); break;
        case 'ArrowLeft': attack(-1, 0); break;
        case 'ArrowRight': attack(1, 0); break;
    }
});

let board = makeBoard();
generateLevel(board, 15);

// Start game state
player.x = 0;
player.y = 0;
player.renderX = 0;
player.renderY = 0;
board[0][0].covered = false;

window.onload = () => {
    loop();
};

window.onresize = () => {
    location.reload();
};
