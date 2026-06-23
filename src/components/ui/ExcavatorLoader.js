import { useEffect, useRef } from 'react';

const COLOR = '#9E7A42';
const D = Math.PI / 180;
const BP = { x: 210, y: 182 };
const BL = 142, SL = 116;
const CY = 3800;

function ss(t) { return t * t * (3 - 2 * t); }
function lp(a, b, f) { return a + (b - a) * f; }
function ka(p, ks) {
    for (let i = 0; i < ks.length - 1; i++) {
        if (p >= ks[i][0] && p <= ks[i + 1][0])
            return lp(ks[i][1], ks[i + 1][1], ss((p - ks[i][0]) / (ks[i + 1][0] - ks[i][0])));
    }
    return ks[ks.length - 1][1];
}

function getAngles(p) {
    return {
        b: ka(p, [[0, -70 * D], [.36, -34 * D], [.64, -32 * D], [.84, -67 * D], [1, -70 * D]]),
        s: ka(p, [[0, 30 * D], [.36, 84 * D], [.64, 58 * D], [.84, 34 * D], [1, 30 * D]]),
        k: ka(p, [[0, 24 * D], [.33, 30 * D], [.62, 175 * D], [.84, 170 * D], [1, 24 * D]]),
    };
}

function drawFrame(ctx, p) {
    const C = COLOR;
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
    const ln = (x1, y1, x2, y2, w) => { ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    const ci = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };

    const { b, s, k } = getAngles(p);
    const bt = { x: BP.x + BL * Math.cos(b), y: BP.y + BL * Math.sin(b) };
    const st = { x: bt.x + SL * Math.cos(s), y: bt.y + SL * Math.sin(s) };

    ctx.clearRect(0, 0, 500, 295);
    ctx.strokeStyle = C;
    ctx.fillStyle = C;

    // corpo
    rr(14, 240, 198, 26, 13);
    rr(28, 232, 172, 16, 4);
    rr(22, 163, 202, 73, 6);
    rr(15, 175, 14, 55, 4);
    rr(108, 98, 110, 70, [10, 10, 4, 4]);
    ci(BP.x, BP.y, 9);

    // cilindros
    const cb = { x: BP.x, y: BP.y + 26 };
    const ct = { x: BP.x + 0.44 * BL * Math.cos(b), y: BP.y + 0.44 * BL * Math.sin(b) };
    const sa = { x: BP.x + 0.77 * BL * Math.cos(b), y: BP.y + 0.77 * BL * Math.sin(b) };
    const sb = { x: bt.x + 0.35 * SL * Math.cos(s), y: bt.y + 0.35 * SL * Math.sin(s) };
    ln(cb.x, cb.y, ct.x, ct.y, 6); ci(cb.x, cb.y, 4); ci(ct.x, ct.y, 4);
    ln(sa.x, sa.y, sb.x, sb.y, 5); ci(sa.x, sa.y, 3); ci(sb.x, sb.y, 3);

    // boom + stick
    ln(BP.x, BP.y, bt.x, bt.y, 20); ci(bt.x, bt.y, 11);
    ln(bt.x, bt.y, st.x, st.y, 14); ci(st.x, st.y, 8);

    // concha
    ctx.save();
    ctx.translate(st.x, st.y);
    ctx.rotate(k);
    ctx.fillStyle = C;
    ctx.beginPath();
    ctx.moveTo(-6, -12);
    ctx.lineTo(58, -12);
    ctx.quadraticCurveTo(76, 4, 74, 38);
    ctx.quadraticCurveTo(52, 70, -6, 50);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

const SIZE_MAP = { sm: 100, md: 160, lg: 220 };

export default function ExcavatorLoader({ size = 'md', text = 'Carregando...' }) {
    const canvasRef = useRef(null);
    const animRef = useRef(null);

    useEffect(() => {
        const cv = canvasRef.current;
        if (!cv) return;
        const ctx = cv.getContext('2d');
        let prev = null, el = 0;

        function frame(ts) {
            if (!prev) prev = ts;
            el = (el + (ts - prev)) % CY;
            prev = ts;
            drawFrame(ctx, el / CY);
            animRef.current = requestAnimationFrame(frame);
        }

        animRef.current = requestAnimationFrame(frame);
        return () => cancelAnimationFrame(animRef.current);
    }, []);

    const cssW = SIZE_MAP[size] ?? SIZE_MAP.md;
    const cssH = Math.round(cssW * 295 / 500);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <canvas
                ref={canvasRef}
                width={500}
                height={295}
                style={{ width: cssW, height: cssH, display: 'block' }}
            />
            {text && (
                <span style={{ fontSize: 12, color: '#9a8a78', fontWeight: 500, letterSpacing: '0.04em' }}>
                    {text}
                </span>
            )}
        </div>
    );
}
