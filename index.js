const screen = document.getElementById("screen");

const size = Math.min(window.innerHeight, window.innerWidth);
screen.width = size;
screen.height = size;

const cx = screen.getContext("2d");

// Entities
const EMPTY = "empty";
const BOMB = "bomb";
const COIN = "coin";
const ENEMY = "enemy";

const board_size = 13;
const cell_size = size / (4 + board_size + 4);

let player = { x: 0, y: 0, coins: 0 };
let enemies = [];
let gameState = "PLAYING"; // PLAYING, WON, LOST

function fillCircle(cX, cY, r, color) {
    cx.beginPath();
    cx.arc(cX, cY, r, 0, 2 * Math.PI, false);
    cx.fillStyle = color;
    cx.fill();
    cx.stroke();
}

function clearScreen() {
    cx.fillStyle = "#181818";
    cx.fillRect(0, 0, size, size);
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
    cx.fillStyle = "#FFD700";
    cx.font = "20px Arial";
    cx.textAlign = "left";
    cx.textBaseline = "top";
    cx.fillText(`Coins: ${player.coins}/3`, 10, 10);

    for (let i = 0; i < board_size; i++) {
        for (let j = 0; j < board_size; j++) {
            const x = start + (j * cell_size);
            const y = start + (i * cell_size);

            cx.fillStyle = "#a0a0a0";
            cx.fillRect(x, y, cell_size, cell_size);

            cx.fillStyle = "#0a0a0a";
            cx.strokeRect(x, y, cell_size, cell_size);

            const cell = board[i][j];

            // Draw content if revealed or game over
            if (!cell.covered || gameState !== "PLAYING") {
                if (cell.entity === BOMB) {
                    fillCircle(
                        x + cell_size / 2,
                        y + cell_size / 2,
                        (cell_size / 2) - 4,
                        "#000000",
                    );
                } else if (cell.entity === COIN) {
                    fillCircle(
                        x + cell_size / 2,
                        y + cell_size / 2,
                        (cell_size / 2) - 6,
                        "#FFD700",
                    );
                } else if (cell.entity === ENEMY) {
                    fillCircle(
                        x + cell_size / 2,
                        y + cell_size / 2,
                        (cell_size / 2) - 4,
                        "#4CAF50",
                    );
                } else if (cell.hint > 0) {
                    // Hint Number
                    cx.fillStyle = "#000000";
                    cx.font = `bold ${cell_size * 0.5}px monospace`;
                    cx.textAlign = "center";
                    cx.textBaseline = "middle";
                    cx.fillText(
                        cell.hint.toString(),
                        x + cell_size / 2,
                        y + cell_size / 2 - 5
                    );

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

                    // Draw dots
                    const dotY = y + cell_size - 8;
                    if (hasCoin && hasEnemy) {
                        fillCircle(x + cell_size / 2 - 5, dotY, 3, "#FFD700");
                        fillCircle(x + cell_size / 2 + 5, dotY, 3, "#4CAF50");
                    } else if (hasCoin) {
                        fillCircle(x + cell_size / 2, dotY, 3, "#FFD700");
                    } else if (hasEnemy) {
                        fillCircle(x + cell_size / 2, dotY, 3, "#4CAF50");
                    }
                }
            }

            // Draw cover
            if (cell.covered && gameState === "PLAYING") {
                cx.fillStyle = "#3a2525ff";
                cx.fillRect(
                    x + 2,
                    y + 2,
                    cell_size - 4,
                    cell_size - 4,
                );
            }
        }
    }

    // Draw Player
    if (gameState !== "LOST") {
        const px = start + (player.x * cell_size);
        const py = start + (player.y * cell_size);
        fillCircle(
            px + cell_size / 2,
            py + cell_size / 2,
            (cell_size / 2) - 4,
            "#3d5296ff",
        );
    } else {
        // Draw dead player marker? For now just hidden/replaced by bomb or message
    }

    // Game Over / Win UI
    if (gameState !== "PLAYING") {
        cx.fillStyle = gameState === "WON" ? "#4CAF50" : "#F44336";
        cx.font = "bold 48px Arial";
        cx.textAlign = "center";
        cx.textBaseline = "middle";
        cx.fillText(gameState === "WON" ? "YOU WIN!" : "GAME OVER", size / 2, size / 2);
    }
}

function valid(x, y) {
    return x >= 0 && y >= 0 && x < board_size && y < board_size;
}

function reveal(x, y) {
    if (!valid(x, y)) return;
    if (!board[y][x].covered) return;

    board[y][x].covered = false;

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
                // Player is neighbor
                board[e.y][e.x].covered = false; // "Break open tile"
                justRevealed = true;
            }
        }

        // 2. Move active enemies
        // If it was covered (and maybe just revealed), it cannot move this turn.
        // It treats the "Break open" as its action.
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

            // Avoid other enemies (basic)
            const occupied = enemies.some(other => !other.dead && other.x === tx && other.y === ty);
            if (valid(tx, ty) && !occupied) {
                // Check dist
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

            // Check Player Collision
            if (destX === player.x && destY === player.y) {
                gameState = "LOST"; // Enemy Caught Player
                console.log("Caught by enemy!");
            } else {
                // Update position
                e.x = destX;
                e.y = destY;

                // Move entity on board logic

                // Old pos
                if (board[e.y - moveY][e.x - moveX].entity === ENEMY) {
                    board[e.y - moveY][e.x - moveX].entity = EMPTY;
                    updateHints(e.x - moveX, e.y - moveY, -1); // Remove danger from old spot
                }

                // New pos
                const destCell = board[destY][destX];
                if (destCell.entity === BOMB) {
                    // KABOOM
                    e.dead = true;
                    destCell.entity = EMPTY; // Bomb used
                    updateHints(destX, destY, -1); // Bomb gone

                    board[destY][destX].covered = false; // Boom reveal
                } else if (destCell.entity === COIN) {
                    // Ignore coins
                } else {
                    // Set new tile to ENEMY
                    destCell.entity = ENEMY;
                    updateHints(destX, destY, 1); // Add danger to new spot
                    destCell.covered = false; // Enemies stay revealed
                }
            }
        }
    });

    // Cleanup dead enemies
    enemies = enemies.filter(e => !e.dead);
}

function processTurn() {
    // 1. Player check
    // (Already handled in movePlayer/attack)

    // 2. Enemy Turn
    updateEnemies();

    // 3. Render
    clearScreen();
    drawBoard(board);
}

function attack(dx, dy) {
    if (gameState !== "PLAYING") return;

    const tx = player.x + dx;
    const ty = player.y + dy;

    if (valid(tx, ty)) {
        const cell = board[ty][tx];
        // Check for enemy
        // We can check board entity OR enemies list.
        // Board entity is easiest.
        if (cell.entity === ENEMY) {
            // Kill
            cell.entity = EMPTY;
            updateHints(tx, ty, -1); // Enemy danger removed

            // Remove from list
            const idx = enemies.findIndex(e => e.x === tx && e.y === ty);
            if (idx !== -1) enemies[idx].dead = true; // Mark dead

            console.log("Enemy Killed!");
        } else {
            console.log("Attacked empty air");
        }

        // Attack counts as turn
        processTurn();
    }
}

function movePlayer(dx, dy) {
    if (gameState !== "PLAYING") return;

    const newX = player.x + dx;
    const newY = player.y + dy;

    if (valid(newX, newY)) {
        // Collision check with Enemy (Player walking into enemy)
        if (board[newY][newX].entity === ENEMY) {
            gameState = "LOST"; // Walked into enemy
            drawBoard(board);
            return;
        }

        player.x = newX;
        player.y = newY;

        const cell = board[newY][newX];

        // Check for bomb
        if (cell.entity === BOMB) {
            gameState = "LOST";
            board[newY][newX].covered = false;
        } else {
            // Coin Collection
            if (cell.entity === COIN) {
                player.coins += 1;
                cell.entity = EMPTY;
                updateHints(newX, newY, -1);
            }

            reveal(newX, newY);

            if (newX === board_size - 1 && newY === board_size - 1) {
                if (player.coins >= 3) {
                    gameState = "WON";
                }
            }
        }

        // Move is a turn
        processTurn();
    }
}

function generateLevel(board, count) {
    enemies = []; // Reset enemies
    player.coins = 0;

    let genCount = 0;
    let attempts = 0;
    const maxAttempts = 2000;

    // 1. Bombs (No edge restriction)
    while (genCount < count && attempts < maxAttempts) {
        attempts++;
        const r = Math.floor(Math.random() * board_size);
        const c = Math.floor(Math.random() * board_size);

        // Safety Clean Spawn & Exit for playability
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

        if (r < 3 && c < 3) continue; // Give player more breathing room from enemies
        if (r > board_size - 4 && c > board_size - 4) continue;

        if (board[r][c].entity === EMPTY) {
            board[r][c].entity = ENEMY;
            enemies.push({ x: c, y: r, dead: false });
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
generateLevel(board, 15); // Adjust difficulty

// Start game state
player.x = 0;
player.y = 0;
board[0][0].covered = false;

window.onload = () => {
    clearScreen();
    drawBoard(board);
};
window.onresize = () => {
    // Basic handle resize reload/redraw logic could go here
    // For now simple reload
    // location.reload(); 
};
