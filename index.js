const screen = document.getElementById("screen");

const size = Math.min(window.innerHeight, window.innerWidth);
screen.width = size;
screen.height = size;

const cx = screen.getContext("2d");

// Entities
const EMPTY = "empty";
const BOMB = "bomb";
const COIN = "coin";

const board_size = 13;
const cell_size = size / (4 + board_size + 4);

let player = { x: 0, y: 0, coins: 0 };
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
                } else if (cell.hint > 0) {
                    let hasCoinNeighbor = false;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const ny = i + dy;
                            const nx = j + dx;
                            if (valid(nx, ny) && board[ny][nx].entity === COIN) {
                                hasCoinNeighbor = true;
                                break;
                            }
                        }
                        if (hasCoinNeighbor) break;
                    }

                    cx.fillStyle = hasCoinNeighbor ? "#FFD700" : "#000000";
                    cx.font = `bold ${cell_size * 0.6}px monospace`;
                    cx.textAlign = "center";
                    cx.textBaseline = "middle";
                    cx.fillText(
                        cell.hint.toString(),
                        x + cell_size / 2,
                        y + cell_size / 2
                    );
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

function movePlayer(dx, dy) {
    if (gameState !== "PLAYING") return;

    const newX = player.x + dx;
    const newY = player.y + dy;

    if (valid(newX, newY)) {
        player.x = newX;
        player.y = newY;

        const cell = board[newY][newX];

        // Check for bomb
        if (cell.entity === BOMB) {
            gameState = "LOST";
            board[newY][newX].covered = false; // Reveal the bomb stepped on
        } else {
            // Coin Collection
            if (cell.entity === COIN) {
                player.coins += 1;
                cell.entity = EMPTY; // Remove coin

                // Update hints (decrement neighbors since "bomb" (coin) is removed)
                for (let i = -1; i <= 1; i++) {
                    for (let j = -1; j <= 1; j++) {
                        const nr = newY + i;
                        const nc = newX + j;
                        if (valid(nc, nr)) {
                            board[nr][nc].hint -= 1;
                        }
                    }
                }
            }

            reveal(newX, newY);

            // Check for Win (Bottom Right + 3 Coins)
            if (newX === board_size - 1 && newY === board_size - 1) {
                if (player.coins >= 3) {
                    gameState = "WON";
                } else {
                    console.log("Need more coins!");
                    // Optional: Visual feedback "Need 3 coins!"
                }
            }
        }

        clearScreen();
        drawBoard(board);
    }
}

function generateLevel(board, count) {
    let genCount = 0;

    // Safety break to prevent infinite loops if board is too full
    let attempts = 0;
    const maxAttempts = 1000;

    // Place Bombs
    while (genCount < count && attempts < maxAttempts) {
        attempts++;
        const r = Math.floor(Math.random() * board_size);
        const c = Math.floor(Math.random() * board_size);

        // Skip borders
        if (r === 0 || c === 0 || r === board_size - 1 || c === board_size - 1) continue;
        // Player spawn area safety
        if (r < 3 && c < 3) continue;
        // Exit Door area safety
        if (r > board_size - 3 && c > board_size - 3) continue;

        if (board[r][c].entity === EMPTY) {
            board[r][c].entity = BOMB;

            // Update hints
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    const nr = r + i;
                    const nc = c + j;
                    if (valid(nc, nr)) {
                        board[nr][nc].hint += 1;
                    }
                }
            }
            genCount += 1;
        }
    }

    // Place Coins (3)
    let coinCount = 0;
    attempts = 0;
    while (coinCount < 3 && attempts < maxAttempts) {
        attempts++;
        const r = Math.floor(Math.random() * board_size);
        const c = Math.floor(Math.random() * board_size);

        // Avoid spawn and exit just in case, though logically capable of having coins
        if (r < 2 && c < 2) continue;
        if (r > board_size - 2 && c > board_size - 2) continue;

        if (board[r][c].entity === EMPTY) {
            board[r][c].entity = COIN;

            // Update hints (Coins act as Bombs for hints now)
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    const nr = r + i;
                    const nc = c + j;
                    if (valid(nc, nr)) {
                        board[nr][nc].hint += 1;
                    }
                }
            }

            coinCount++;
        }
    }

    if (attempts >= maxAttempts) {
        console.warn("Could not place all items");
    }
}

// Input Handling
document.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
        case 'w': movePlayer(0, -1); break;
        case 's': movePlayer(0, 1); break;
        case 'a': movePlayer(-1, 0); break;
        case 'd': movePlayer(1, 0); break;
    }
});

let board = makeBoard();
generateLevel(board, 10); // Increased bomb count slightly for 13x13

// Start game state
player.x = 0;
player.y = 0;
player.coins = 0;
board[0][0].covered = false; // Reveal start only (no flood fill)

window.onload = () => {
    clearScreen();
    drawBoard(board);
};
window.onresize = () => {
    // Basic handle resize reload/redraw logic could go here
    // For now simple reload
    // location.reload(); 
};
