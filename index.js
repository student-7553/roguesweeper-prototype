// --- Game ---
class Game {
    constructor() {
        this.board = null;
        this.player = new Player();
        this.enemies = [];
        this.particles = [];
        this.gameState = "PLAYING";
        this.shake = 0;
    }

    start() {
        this.player.reset();
        this.loadLevel(13);
    }

    loadLevel(boardSize) {
        this.board = new Board(boardSize);
        this.board.playerX = 0;
        this.board.playerY = 0;
        this.player.coins = 0;
        // Do not reset health here, it persists
        this.player.renderX = 0;
        this.player.renderY = 0;
        
        this.enemies = [];
        this.particles = [];
        this.gameState = "PLAYING";
        this.shake = 0;
        
        // Scale density based on board area (keep roughly same ratio as 15 bombs for 13x13)
        // 13x13 = 169 cells. 15 bombs = ~8.8%
        const area = boardSize * boardSize;
        const bombCount = Math.floor(area * 0.09); // slightly round up
        const enemyCount = Math.floor(area * 0.03); // ~3% enemies

        this._generateLevel(bombCount, enemyCount);
        this.board.getCell(0, 0).covered = false;
    }

    createParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    reveal(x, y) {
        if (!this.board.valid(x, y)) return;
        const cell = this.board.getCell(x, y);
        if (!cell.covered) return;
        if (cell.flagged) return; // Don't auto-reveal flagged cells

        cell.covered = false;
        const start = (window.size / 2) - (this.board.cellSize * (this.board.size / 2));
        const px = start + (x * this.board.cellSize) + this.board.cellSize / 2;
        const py = start + (y * this.board.cellSize) + this.board.cellSize / 2;
        this.createParticles(px, py, window.COLORS.cellRevealed, 5);
        // Reduced reveal sound volume/frequency could be good here if it's too much, but keeping as is
        window.SoundManager.playReveal();

        if (cell.entity === window.ENEMY) {
            // Find enemy and stun it
            const enemy = this.enemies.find(e => {
                if (e.getOccupiedCells) {
                    return e.getOccupiedCells().some(c => c.x === x && c.y === y);
                }
                return e.x === x && e.y === y;
            });
            if (enemy) enemy.stunned = true;
        }

        if (cell.entity === window.EMPTY && cell.hint === 0) {
            this.revealNeighbors(x, y);
        }
    }

    revealNeighbors(x, y) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                this.reveal(x + dx, y + dy);
            }
        }
    }

    // Check neighbors of a modified cell (x, y) to see if any ALREADY REVEALED cells
    // have become 0-hint and should trigger a cascade.
    checkCascade(x, y) {
         for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (this.board.valid(nx, ny)) {
                    const neighbor = this.board.getCell(nx, ny);
                    // If neighbor is revealed, empty, and now has 0 hint...
                    if (!neighbor.covered && neighbor.entity === window.EMPTY && neighbor.hint === 0) {
                        // ...it should try to reveal ITS neighbors
                        this.revealNeighbors(nx, ny);
                    }
                }
            }
        }
    }

    toggleFlag(screenX, screenY) {
        if (this.gameState !== "PLAYING") return;
        
        const start = (window.size / 2) - (this.board.cellSize * (this.board.size / 2));
        const gridX = Math.floor((screenX - start) / this.board.cellSize);
        const gridY = Math.floor((screenY - start) / this.board.cellSize);

        if (this.board.valid(gridX, gridY)) {
            const cell = this.board.getCell(gridX, gridY);
            if (cell.covered) {
                cell.flagged = !cell.flagged;
                // Optional: play small click sound?
            }
        }
    }

    _updateEnemies() {
        this.enemies.forEach(e => {
            const result = e.update(this.board, this.board.playerX, this.board.playerY, this.enemies);
            if (!result) return;

            if (result.hitPlayer) {
                this.player.health -= 1;
                this.shake = Math.max(this.shake, result.shake);
                window.SoundManager.playDamage();

                if (this.player.health <= 0) {
                    this.gameState = "LOST";
                    window.SoundManager.playLose();
                }
            }
            if (result.shake > 0) {
                this.shake = Math.max(this.shake, result.shake);
            }
            if (result.particles) { 
                result.particles.forEach(p => {
                    this.createParticles(p.x, p.y, p.color, p.count);
                });
            }
        });
        this.enemies = this.enemies.filter(e => !e.dead);
    }

    _processTurn() {
        this._updateEnemies();
    }

    attack(dx, dy) {
        if (this.gameState !== "PLAYING") return;
        const tx = this.board.playerX + dx;
        const ty = this.board.playerY + dy;
        if (!this.board.valid(tx, ty)) return;

        window.SoundManager.playAttack();
        const start = (window.size / 2) - (this.board.cellSize * (this.board.size / 2));
        const px = start + (tx * this.board.cellSize) + this.board.cellSize / 2;
        const py = start + (ty * this.board.cellSize) + this.board.cellSize / 2;
        this.createParticles(px, py, "#fff", 5);

        const cell = this.board.getCell(tx, ty);
        if (cell.entity === window.ENEMY) {
            // Find which enemy occupies this cell
            const idx = this.enemies.findIndex(e => {
                // If enemy has getOccupiedCells method (it should), check it
                if (typeof e.getOccupiedCells === 'function') {
                    return e.getOccupiedCells().some(c => c.x === tx && c.y === ty);
                }
                return e.x === tx && e.y === ty;
            });

            if (idx !== -1) {
                const enemy = this.enemies[idx];
                const died = enemy.takeDamage(1);
                
                if (died) {
                    // Clear all occupied cells
                    const occupied = enemy.getOccupiedCells();
                    occupied.forEach(c => {
                        const cCell = this.board.getCell(c.x, c.y);
                        cCell.entity = window.EMPTY;
                        this.board.updateHints(c.x, c.y, -1);
                    });
                    
                    // Particles at center
                    const start = (window.size / 2) - (this.board.cellSize * (this.board.size / 2));
                    const px = start + (enemy.x * this.board.cellSize) + (enemy.width * this.board.cellSize / 2);
                    const py = start + (enemy.y * this.board.cellSize) + (enemy.height * this.board.cellSize / 2);

                    this.createParticles(px, py, enemy.color, 25);
                    window.SoundManager.playDamage();
                    this.shake = 5;
                    this.checkCascade(tx, ty);
                } else {
                    // Hit but alive
                    this.createParticles(px, py, "#fff", 5);
                    this.shake = 2;
                }
            }
        }
        this._processTurn();
    }

    movePlayer(dx, dy) {
        if (this.gameState !== "PLAYING") return;
        if (window.audioCtx.state === 'suspended') window.audioCtx.resume();

        const newX = this.board.playerX + dx;
        const newY = this.board.playerY + dy;
        if (!this.board.valid(newX, newY)) return;

        // Block movement if flagged
        if (this.board.getCell(newX, newY).flagged) return;

        if (this.board.getCell(newX, newY).entity === window.ENEMY) {
            this.attack(dx, dy);
            return;
        }

        this.board.playerX = newX;
        this.board.playerY = newY;
        window.SoundManager.playMove();

        const cell = this.board.getCell(newX, newY);
        if (cell.entity === window.BOMB) {
            this.player.health -= 1;
            cell.covered = false;
            this.shake = 30;
            window.SoundManager.playDamage();
            if (this.player.health <= 0) {
                this.gameState = "LOST";
                window.SoundManager.playLose();
            }
        } else {
            if (cell.entity === window.COIN) {
                this.player.coins += 1;
                cell.entity = window.EMPTY;
                this.board.updateHints(newX, newY, -1);
                window.SoundManager.playCoin();
                const start = (window.size / 2) - (this.board.cellSize * (this.board.size / 2));
                this.createParticles(start + newX * this.board.cellSize + this.board.cellSize / 2,
                    start + newY * this.board.cellSize + this.board.cellSize / 2, window.COLORS.coin, 10);
                this.checkCascade(newX, newY);
            }
            this.reveal(newX, newY);
            if (newX === this.board.size - 1 && newY === this.board.size - 1 && this.player.coins >= 3) {
                // NEXT LEVEL
                window.SoundManager.playWin();
                this.createParticles(window.size / 2, window.size / 2, window.COLORS.coin, 50);
                // Small delay or instant? Instant feels smoother for a roguelike
                this.loadLevel(this.board.size + 3);
                return; // skip turn processing for the new level spawn frame
            }
        }
        this._processTurn();
    }

    _generateLevel(bombCount, enemyCount) {
        // Player coins are already 0 from loadLevel
        
        let genCount = 0;
        let attempts = 0;
        const maxAttempts = 5000;

        while (genCount < bombCount && attempts < maxAttempts) {
            attempts++;
            const r = Math.floor(Math.random() * this.board.size);
            const c = Math.floor(Math.random() * this.board.size);
            if (r < 3 && c < 3) continue;
            if (r > this.board.size - 4 && c > this.board.size - 4) continue;
            const cell = this.board.getCell(c, r);
            if (cell.entity === window.EMPTY) {
                cell.entity = window.BOMB;
                this.board.updateHints(c, r, 1);
                genCount++;
            }
        }

        let coinCount = 0;
        attempts = 0;
        // Always 3 coins for now
        while (coinCount < 3 && attempts < maxAttempts) {
            attempts++;
            const r = Math.floor(Math.random() * this.board.size);
            const c = Math.floor(Math.random() * this.board.size);
            if (r < 3 && c < 3) continue;
            if (r > this.board.size - 4 && c > this.board.size - 4) continue;
            const cell = this.board.getCell(c, r);
            if (cell.entity === window.EMPTY) {
                cell.entity = window.COIN;
                this.board.updateHints(c, r, 1);
                coinCount++;
            }
        }

        let curEnemyCount = 0;
        attempts = 0;
        while (curEnemyCount < enemyCount && attempts < maxAttempts) {
            attempts++;
            const r = Math.floor(Math.random() * this.board.size);
            const c = Math.floor(Math.random() * this.board.size);
            
            // Try Ogre Spawn (5% chance, only if space permits)
            if (Math.random() < 0.1 && this.board.size >= 13) {
               // Check 2x2 space
               if (r < this.board.size - 1 && c < this.board.size - 1) {
                   const cell1 = this.board.getCell(c, r);
                   const cell2 = this.board.getCell(c+1, r);
                   const cell3 = this.board.getCell(c, r+1);
                   const cell4 = this.board.getCell(c+1, r+1);
                   
                   if (cell1.entity === window.EMPTY && cell2.entity === window.EMPTY &&
                       cell3.entity === window.EMPTY && cell4.entity === window.EMPTY &&
                       !(r < 3 && c < 3)) { // not near player start
                       
                       const ogre = new EnemyOgre(c, r);
                       this.enemies.push(ogre);
                       // Update all cells
                       cell1.entity = window.ENEMY;
                       cell2.entity = window.ENEMY;
                       cell3.entity = window.ENEMY;
                       cell4.entity = window.ENEMY;
                       this.board.updateHints(c, r, 1);
                       this.board.updateHints(c+1, r, 1);
                       this.board.updateHints(c, r+1, 1);
                       this.board.updateHints(c+1, r+1, 1);
                       
                       curEnemyCount++; // Counts as 1 enemy? Or multiple? Let's say 1 spawn.
                       continue;
                   }
               }
            }

            if (r < 3 && c < 3) continue;
            if (r > this.board.size - 4 && c > this.board.size - 4) continue;
            const cell = this.board.getCell(c, r);
            if (cell.entity === window.EMPTY) {
                cell.entity = window.ENEMY;
                // Randomly spawn Brute (30%) or Basic (70%)
                if (Math.random() > 0.7) {
                    this.enemies.push(new EnemyBrute(c, r));
                } else {
                    this.enemies.push(new EnemyBasic(c, r));
                }
                this.board.updateHints(c, r, 1);
                curEnemyCount++;
            }
        }
    }

    _update() {
        this.player.renderX = lerp(this.player.renderX, this.board.playerX, 0.2);
        this.player.renderY = lerp(this.player.renderY, this.board.playerY, 0.2);
        this.enemies.forEach(e => {
            if (e.renderX === undefined) { e.renderX = e.x; e.renderY = e.y; }
            e.renderX = lerp(e.renderX, e.x, 0.1);
            e.renderY = lerp(e.renderY, e.y, 0.1);
        });
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }
    }

    _draw() {
        window.cx.fillStyle = window.COLORS.bg;
        window.cx.fillRect(0, 0, window.size, window.size);
        window.cx.save();
        if (this.shake > 0) {
            window.cx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
            this.shake *= 0.9;
            if (this.shake < 0.5) this.shake = 0;
        }
        
        // Draw Board
        this.board.draw(window.cx, this.gameState);
        
        const start = (window.size / 2) - (this.board.cellSize * (this.board.size / 2));

        // Draw Enemies
        this.enemies.forEach(e => e.draw(window.cx, this.board.cellSize, start, this.board));

        // Draw Player
        this.player.draw(this.board.cellSize, start, this.board.playerX, this.board.playerY, this.gameState);

        this.particles.forEach(p => p.draw(window.cx));
        
        window.cx.restore();

        // Draw UI
        window.cx.fillStyle = window.COLORS.coin;
        window.cx.font = "bold 24px Arial";
        window.cx.textAlign = "left";
        window.cx.textBaseline = "top";
        window.cx.fillText(`Coins: ${this.player.coins}/3`, 20, 20);
        window.cx.fillStyle = window.COLORS.bomb;
        window.cx.fillText(`Health: ${this.player.health}/3`, 20, 48);

        if (this.gameState !== "PLAYING") {
            window.cx.fillStyle = "rgba(0, 0, 0, 0.7)";
            window.cx.fillRect(0, window.size / 2 - 60, window.size, 120);
            window.cx.fillStyle = this.gameState === "WON" ? window.COLORS.coin : window.COLORS.bomb;
            window.cx.font = "bold 48px Arial";
            window.cx.textAlign = "center";
            window.cx.textBaseline = "middle";
            window.cx.shadowColor = "#000";
            window.cx.shadowBlur = 10;
            window.cx.fillText(this.gameState === "WON" ? "YOU WIN!" : "GAME OVER", window.size / 2, window.size / 2);
            window.cx.shadowBlur = 0;
            window.cx.fillStyle = "#fff";
            window.cx.font = "20px Arial";
            window.cx.fillText("Press R to Restart", window.size / 2, window.size / 2 + 40);
        }
    }

    loop() {
        this._update();
        this._draw();
        requestAnimationFrame(() => this.loop());
    }
}

// --- Bootstrap ---
window.game = new Game();
window.game.start();

window.onload = () => {
    window.game.loop();
};

window.onresize = () => {
    location.reload();
};
