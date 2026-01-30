class Board {
    constructor(boardSize) {
        this.size = boardSize;
        this.cellSize = window.size / (4 + boardSize + 4);
        this.cells = this._makeCells();
        this.playerX = 0;
        this.playerY = 0;
    }

    _makeCells() {
        const grid = [];
        for (let i = 0; i < this.size; i++) {
            const row = [];
            for (let j = 0; j < this.size; j++) {
                row.push({ entity: window.EMPTY, covered: true, hint: 0, flagged: false });
            }
            grid.push(row);
        }
        return grid;
    }

    valid(x, y) {
        return x >= 0 && y >= 0 && x < this.size && y < this.size;
    }

    getCell(x, y) {
        return this.cells[y][x];
    }

    updateHints(x, y, delta) {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const nr = y + i;
                const nc = x + j;
                if (this.valid(nc, nr)) {
                    this.cells[nr][nc].hint += delta;
                }
            }
        }
    }

    draw(ctx, gameState) {
        const start = (window.size / 2) - (this.cellSize * (this.size / 2));

        // Draw Grid
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                const x = start + (j * this.cellSize);
                const y = start + (i * this.cellSize);
                const cell = this.cells[i][j];

                window.cx.fillStyle = window.COLORS.grid;
                window.cx.fillRect(x, y, this.cellSize, this.cellSize);
                window.cx.strokeStyle = "#000";
                window.cx.lineWidth = 2;
                window.cx.strokeRect(x, y, this.cellSize, this.cellSize);

                if (!cell.covered || gameState !== "PLAYING") {
                    window.cx.fillStyle = window.COLORS.cellEmpty;
                    window.cx.fillRect(x, y, this.cellSize, this.cellSize);
                    window.cx.strokeRect(x, y, this.cellSize, this.cellSize);

                    const centerX = x + this.cellSize / 2;
                    const centerY = y + this.cellSize / 2;

                    if (cell.entity === window.BOMB) {
                        fillCircle(centerX, centerY, (this.cellSize / 2) - 4, window.COLORS.bomb);
                        window.cx.fillStyle = "rgba(255, 255, 255, 0.3)";
                        window.cx.beginPath();
                        window.cx.arc(centerX - 5, centerY - 5, 4, 0, Math.PI * 2);
                        window.cx.fill();
                    } else if (cell.entity === window.COIN) {
                        fillCircle(centerX, centerY, (this.cellSize / 2) - 6, window.COLORS.coin);
                        window.cx.fillStyle = "rgba(255, 255, 255, 0.5)";
                        window.cx.beginPath();
                        window.cx.arc(centerX - 4, centerY - 4, 3, 0, Math.PI * 2);
                        window.cx.fill();
                    } else if (cell.entity === window.ENEMY) {
                        // placeholder, enemy drawn separately by Game
                    } else if (cell.hint > 0) {
                        window.cx.fillStyle = window.COLORS.text;
                        window.cx.font = `bold ${this.cellSize * 0.6}px monospace`;
                        window.cx.textAlign = "center";
                        window.cx.textBaseline = "middle";
                        window.cx.fillText(cell.hint.toString(), centerX, centerY - 5);

                        let hasCoin = false;
                        let hasEnemy = false;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dx === 0 && dy === 0) continue;
                                const ny = i + dy;
                                const nx = j + dx;
                                if (this.valid(nx, ny)) {
                                    if (this.cells[ny][nx].entity === window.COIN) hasCoin = true;
                                    if (this.cells[ny][nx].entity === window.ENEMY) hasEnemy = true;
                                }
                            }
                        }
                        const dotY = y + this.cellSize - 8;
                        if (hasCoin && hasEnemy) {
                            fillCircle(centerX - 5, dotY, 3, window.COLORS.coin);
                            fillCircle(centerX + 5, dotY, 3, window.COLORS.enemy);
                        } else if (hasCoin) {
                            fillCircle(centerX, dotY, 3, window.COLORS.coin);
                        } else if (hasEnemy) {
                            fillCircle(centerX, dotY, 3, window.COLORS.enemy);
                        }
                    }
                }

                if (cell.covered && gameState === "PLAYING") {
                    window.cx.fillStyle = window.COLORS.cellCovered;
                    window.cx.fillRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
                    window.cx.fillStyle = "rgba(255,255,255,0.1)";
                    window.cx.fillRect(x + 2, y + 2, this.cellSize - 4, (this.cellSize - 4) / 2);
                    
                    if (cell.flagged) {
                        const centerX = x + this.cellSize / 2;
                        const centerY = y + this.cellSize / 2;
                        
                        window.cx.fillStyle = window.COLORS.flag;
                        window.cx.beginPath();
                        // Draw a simple flag triangle
                        window.cx.moveTo(centerX - 5, centerY - 8);
                        window.cx.lineTo(centerX + 8, centerY - 2);
                        window.cx.lineTo(centerX - 5, centerY + 4);
                        window.cx.closePath();
                        window.cx.fill();
                        
                        // Pole
                        window.cx.strokeStyle = "#fff";
                        window.cx.lineWidth = 2;
                        window.cx.beginPath();
                        window.cx.moveTo(centerX - 5, centerY - 8);
                        window.cx.lineTo(centerX - 5, centerY + 8);
                        window.cx.stroke();
                    }
                }
            }
        }
    }
}
