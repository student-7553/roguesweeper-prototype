class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.dead = false;
        this.renderX = x;
        this.renderY = y;
    }

    // Returns result object with side effects
    update(board, playerX, playerY, allEnemies) {
        if (this.dead) return null;

        const result = { hitPlayer: false, particles: [], shake: 0 };
        let justRevealed = false;

        // Reveal Logic if near player
        if (board.getCell(this.x, this.y).covered) {
             const dx = Math.abs(playerX - this.x);
             const dy = Math.abs(playerY - this.y);
             if (dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0)) {
                 board.getCell(this.x, this.y).covered = false;
                 justRevealed = true;
                 window.SoundManager.playReveal();
             }
        }
        // If still covered, do nothing
        if (board.getCell(this.x, this.y).covered || justRevealed) return result;

        // Movement Logic
        let bestDist = Infinity;
        let moveX = 0;
        let moveY = 0;
        const directions = [
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
        ];

        for (const dir of directions) {
            const tx = this.x + dir.dx;
            const ty = this.y + dir.dy;
            // Check if occupied by other enemy
            const occupied = allEnemies.some(other => !other.dead && other.x === tx && other.y === ty);
            
            if (board.valid(tx, ty) && !occupied) {
                const dist = Math.abs(playerX - tx) + Math.abs(playerY - ty);
                if (dist < bestDist) {
                    bestDist = dist;
                    moveX = dir.dx;
                    moveY = dir.dy;
                }
            }
        }

        if (moveX !== 0 || moveY !== 0) {
            const destX = this.x + moveX;
            const destY = this.y + moveY;

            if (destX === playerX && destY === playerY) {
                result.hitPlayer = true;
                result.shake = 20;
                window.SoundManager.playDamage();
            } else {
                const oldX = this.x;
                const oldY = this.y;
                this.x = destX;
                this.y = destY;

                // Update Grid: clear previous cell
                const prevCell = board.getCell(oldX, oldY);
                if (prevCell.entity === window.ENEMY) {
                    prevCell.entity = window.EMPTY;
                    board.updateHints(oldX, oldY, -1);
                }

                // Handle destination
                const destCell = board.getCell(destX, destY);
                if (destCell.entity === window.BOMB) {
                    this.dead = true;
                    destCell.entity = window.EMPTY;
                    board.updateHints(destX, destY, -1);
                    destCell.covered = false;
                    window.SoundManager.playDamage();
                    result.shake = 10;
                    
                    const start = (window.size / 2) - (board.cellSize * (board.size / 2));
                    const px = start + (destX * board.cellSize);
                    const py = start + (destY * board.cellSize); 
                    result.particles.push({x: px, y: py, color: window.COLORS.bomb, count: 20});
                    
                } else if (destCell.entity !== window.COIN) {
                    // Update grid to show enemy if it's not a coin
                    destCell.entity = window.ENEMY;
                    board.updateHints(destX, destY, 1);
                    destCell.covered = false;
                }
            }
        }
        return result;
    }

    draw(ctx, cellSize, start, board) {
        if (this.dead) return;
        // Don't draw if the cell is covered
        if (board.getCell(this.x, this.y).covered) return;

        if (this.renderX === undefined) { this.renderX = this.x; this.renderY = this.y; }
        
        // Lerp happens in Game loop usually, but here we just render
        const px = start + (this.renderX * cellSize);
        const py = start + (this.renderY * cellSize);
        
        fillCircle(px + cellSize / 2, py + cellSize / 2, (cellSize / 2) - 4, window.COLORS.enemy);
        window.cx.fillStyle = "#000";
        window.cx.fillRect(px + cellSize / 2 - 6, py + cellSize / 2 - 4, 4, 4);
        window.cx.fillRect(px + cellSize / 2 + 2, py + cellSize / 2 - 4, 4, 4);
    }
}
