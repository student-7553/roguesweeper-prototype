class Player {
    constructor() {
        this.coins = 0;
        this.health = 3;
        this.renderX = 0;
        this.renderY = 0;
    }
    reset() {
        this.coins = 0;
        this.health = 3;
        this.renderX = 0;
        this.renderY = 0;
    }
    
    draw(cellSize, start, playerGridX, playerGridY, gameState) {
        if (gameState === "LOST") return;

        // processing renderX/Y happens in update loop, here we just draw
        // If renderX/Y are not set (initial spawn), fallback to grid position
        const rx = (this.renderX !== undefined ? this.renderX : playerGridX);
        const ry = (this.renderY !== undefined ? this.renderY : playerGridY);
        
        const px = start + (rx * cellSize);
        const py = start + (ry * cellSize);

        fillCircle(px + cellSize / 2, py + cellSize / 2, (cellSize / 2) - 4, window.COLORS.player);
        window.cx.fillStyle = "#fff";
        window.cx.fillRect(px + cellSize / 2 - 5, py + cellSize / 2 - 3, 3, 3);
        window.cx.fillRect(px + cellSize / 2 + 2, py + cellSize / 2 - 3, 3, 3);
    }
}
