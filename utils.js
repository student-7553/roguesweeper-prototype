// --- Helpers ---
function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

function fillCircle(cX, cY, r, color) {
    window.cx.beginPath();
    window.cx.arc(cX, cY, r, 0, 2 * Math.PI, false);
    window.cx.fillStyle = color;
    window.cx.fill();
    window.cx.lineWidth = 2;
    window.cx.strokeStyle = '#000000';
    window.cx.stroke();
    window.cx.lineWidth = 1;
}
