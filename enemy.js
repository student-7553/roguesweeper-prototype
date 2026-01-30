class EnemyBasic {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 1;
        this.height = 1;
        this.dead = false;
        this.renderX = x;
        this.renderY = y;
        this.health = 1;
        this.color = window.COLORS.enemy;
        this.stunned = false;
    }

    getOccupiedCells(baseX = this.x, baseY = this.y) {
        const cells = [];
        for (let dy = 0; dy < this.height; dy++) {
            for (let dx = 0; dx < this.width; dx++) {
                cells.push({ x: baseX + dx, y: baseY + dy });
            }
        }
        return cells;
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.dead = true;
            return true; // Died
        }
        return false; // Survived
    }

    checkStun() {
        if (this.stunned) {
            this.stunned = false;
            return true;
        }
        return false;
    }

    update(board, playerX, playerY, allEnemies) {
        if (this.dead) return null;

        const result = { hitPlayer: false, particles: [], shake: 0 };
        
        // Reveal Logic
        this._checkReveal(board, result);
        
        // Stun Check (after reveal logic, so reveal happens, but before movement)
        if (this.checkStun()) return result;

        // Check if revealed
        const occupied = this.getOccupiedCells();
        const isRevealed = occupied.some(c => !board.getCell(c.x, c.y).covered);
        
        if (!isRevealed) return result;

        // Movement Logic
        let bestDist = Infinity;
        let bestMove = null;
        
        const directions = [
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
        ];
        
        for (const dir of directions) {
            const tx = this.x + dir.dx;
            const ty = this.y + dir.dy;
            
            if (this._canMoveTo(tx, ty, board, allEnemies, playerX, playerY)) {
                const dist = Math.abs(playerX - tx) + Math.abs(playerY - ty);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestMove = dir;
                }
            }
        }

        if (bestMove) {
            const destX = this.x + bestMove.dx;
            const destY = this.y + bestMove.dy;

            const newOccupied = this.getOccupiedCells(destX, destY);
            if (newOccupied.some(c => c.x === playerX && c.y === playerY)) {
                result.hitPlayer = true;
                result.shake = 20;
                window.SoundManager.playDamage();
            } else {
                this._move(destX, destY, board, result);
            }
        }
        return result;
    }

    _checkReveal(board, result) {
        const occupied = this.getOccupiedCells();
        occupied.forEach(c => {
            if (board.getCell(c.x, c.y).covered) {
                 const dx = Math.abs(board.playerX - c.x);
                 const dy = Math.abs(board.playerY - c.y);
                 if (dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0)) {
                     board.getCell(c.x, c.y).covered = false;
                     this.stunned = true; // Stun when self-revealed
                     window.SoundManager.playReveal();
                 }
            }
        });
    }

    _canMoveTo(tx, ty, board, allEnemies, playerX, playerY) {
        const newCells = this.getOccupiedCells(tx, ty);
        
        for (const c of newCells) {
            if (!board.valid(c.x, c.y)) return false;
             if (board.getCell(c.x, c.y).flagged) return false;
        }

        for (const other of allEnemies) {
            if (other === this || other.dead) continue;
            const otherCells = other.getOccupiedCells();
            for (const c1 of newCells) {
                for (const c2 of otherCells) {
                    if (c1.x === c2.x && c1.y === c2.y) return false;
                }
            }
        }
        return true; 
    }

    _move(destX, destY, board, result) {
        const oldCells = this.getOccupiedCells();
        this.x = destX;
        this.y = destY;
        const newCells = this.getOccupiedCells();

        oldCells.forEach(oldC => {
            if (!newCells.some(newC => newC.x === oldC.x && newC.y === oldC.y)) {
                const cell = board.getCell(oldC.x, oldC.y);
                if (cell.entity === window.ENEMY) {
                    cell.entity = window.EMPTY;
                    board.updateHints(oldC.x, oldC.y, -1);
                }
            }
        });
        
        newCells.forEach(newC => {
            const cell = board.getCell(newC.x, newC.y);
             if (cell.entity === window.BOMB) {
                this.takeDamage(10);
                cell.entity = window.EMPTY;
                board.updateHints(newC.x, newC.y, -1);
                cell.covered = false;
                window.SoundManager.playDamage();
                result.shake = 10;
                
                const start = (window.size / 2) - (board.cellSize * (board.size / 2));
                const px = start + (newC.x * board.cellSize);
                const py = start + (newC.y * board.cellSize); 
                result.particles.push({x: px, y: py, color: window.COLORS.bomb, count: 20});
             } else if (cell.entity !== window.COIN && cell.entity !== window.ENEMY) {
                 cell.entity = window.ENEMY;
                 board.updateHints(newC.x, newC.y, 1);
                 cell.covered = false;
             }
        });
    }

    draw(ctx, cellSize, start, board) {
        if (this.dead) return;
        if (board.getCell(this.x, this.y).covered) return;

        if (this.renderX === undefined) { this.renderX = this.x; this.renderY = this.y; }
        
        const px = start + (this.renderX * cellSize);
        const py = start + (this.renderY * cellSize);
        
        fillCircle(px + cellSize / 2, py + cellSize / 2, (cellSize / 2) - 4, this.color);
        window.cx.fillStyle = "#000";
        window.cx.fillRect(px + cellSize / 2 - 6, py + cellSize / 2 - 4, 4, 4);
        window.cx.fillRect(px + cellSize / 2 + 2, py + cellSize / 2 - 4, 4, 4);
    }
}

class EnemyBrute extends EnemyBasic {
    constructor(x, y) {
        super(x, y);
        this.health = 3;
        this.color = window.COLORS.enemyBrute;
        this.moveTimer = 0;
    }

    update(board, playerX, playerY, allEnemies) {
        if (this.checkStun()) return { hitPlayer: false, particles: [], shake: 0 };

        this.moveTimer++;
        if (this.moveTimer % 2 !== 0) {
            const result = { hitPlayer: false, particles: [], shake: 0 };
            this._checkReveal(board, result);
            return result;
        }
        return super.update(board, playerX, playerY, allEnemies);
    }
}

class EnemyOgre extends EnemyBasic {
    constructor(x, y) {
        super(x, y);
        this.width = 2;
        this.height = 2;
        this.health = 20;
        this.color = window.COLORS.enemyOgre;
        this.moveTimer = 0;
    }

    update(board, playerX, playerY, allEnemies) {
        if (this.checkStun()) return { hitPlayer: false, particles: [], shake: 0 };

        this.moveTimer++;
        if (this.moveTimer % 5 !== 0) {
            const result = { hitPlayer: false, particles: [], shake: 0 };
            this._checkReveal(board, result);
            return result;
        }
        return super.update(board, playerX, playerY, allEnemies);
    }

    draw(ctx, cellSize, start, board) {
        if (this.dead) return;
        
        const cell = board.getCell(this.x, this.y);
        if (cell.covered) return;
        
        if (this.renderX === undefined) { this.renderX = this.x; this.renderY = this.y; }

        const px = start + (this.renderX * cellSize);
        const py = start + (this.renderY * cellSize);
        
        const totalW = this.width * cellSize;
        const totalH = this.height * cellSize;
        
        const centerX = px + totalW / 2;
        const centerY = py + totalH / 2;
        const radius = (Math.min(totalW, totalH) / 2) - 4;

        fillCircle(centerX, centerY, radius, this.color);
        
        window.cx.fillStyle = "#000";
        window.cx.fillRect(centerX - 10, centerY - 10, 8, 8);
        window.cx.fillRect(centerX + 2, centerY - 10, 8, 8);
    }
}
