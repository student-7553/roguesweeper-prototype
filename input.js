// Input Handling — uses window.game (Game instance from index.js)
document.addEventListener('keydown', (e) => {
    if (e.repeat) return;

    const game = window.game;
    if (game.gameState !== "PLAYING" && (e.key === 'r' || e.key === 'R')) {
        location.reload();
        return;
    }

    switch (e.key) {
        case 'w': case 'W': game.movePlayer(0, -1); break;
        case 's': case 'S': game.movePlayer(0, 1); break;
        case 'a': case 'A': game.movePlayer(-1, 0); break;
        case 'd': case 'D': game.movePlayer(1, 0); break;
        case 'ArrowUp': game.attack(0, -1); break;
        case 'ArrowDown': game.attack(0, 1); break;
        case 'ArrowLeft': game.attack(-1, 0); break;
        case 'ArrowRight': game.attack(1, 0); break;
    }
});
