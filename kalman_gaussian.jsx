import { useState, useRef, useEffect, useCallback } from "react";

const W = 700, H = 320;
const PAD = { left: 48, right: 20, top: 28, bottom: 36 };
const X_MIN = -8, X_MAX = 18;

function gaussian(x, mu, sigma) {
  const s2 = sigma * sigma;
  return Math.exp(-0.5 * ((x - mu) ** 2) / s2) / Math.sqrt(2 * Math.PI * s2);
}

function toCanvasX(x) {
  return PAD.left + ((x - X_MIN) / (X_MAX - X_MIN)) * (W - PAD.left - PAD.right);
}
function toCanvasY(y, yMax) {
  return PAD.top + (1 - y / yMax) * (H - PAD.top - PAD.bottom);
}

const COLORS = {
  prior:    { stroke: "#38bdf8", fill: "rgba(56,189,248,0.13)" },
  meas:     { stroke: "#f97316", fill: "rgba(249,115,22,0.13)" },
  post:     { stroke: "#4ade80", fill: "rgba(74,222,128,0.22)" },
  grid:     "#1e293b",
  axis:     "#334155",
  text:     "#94a3b8",
  label:    "#e2e8f0",
  bg:       "#0a0f1e",
  panel:    "#0f172a",
  border:   "#1e293b",
  mu1:      "#38bdf8",
  mu2:      "#f97316",
  muPost:   "#4ade80",
  K:        "#facc15",
};

function buildPath(points, yMax, clip = false) {
  if (!points.length) return "";
  const pts = points.map(([x, y]) => [toCanvasX(x), toCanvasY(y, yMax)]);
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++)
    d += ` L ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)}`;
  return d;
}

function buildArea(points, yMax) {
  if (!points.length) return "";
  const pts = points.map(([x, y]) => [toCanvasX(x), toCanvasY(y, yMax)]);
  const base = toCanvasY(0, yMax);
  let d = `M ${pts[0][0].toFixed(2)} ${base}`;
  for (const [cx, cy] of pts) d += ` L ${cx.toFixed(2)} ${cy.toFixed(2)}`;
  d += ` L ${pts[pts.length - 1][0].toFixed(2)} ${base} Z`;
  return d;
}

function sample(mu, sigma, fn) {
  const pts = [];
  const steps = 400;
  for (let i = 0; i <= steps; i++) {
    const x = X_MIN + (i / steps) * (X_MAX - X_MIN);
    pts.push([x, fn(x, mu, sigma)]);
  }
  return pts;
}

function Slider({ label, value, min, max, step, onChange, color, unit = "" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{ color, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, width: 32 }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: color, cursor: "pointer" }}
      />
      <span style={{ color: COLORS.label, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, width: 42, textAlign: "right" }}>
        {value.toFixed(2)}{unit}
      </span>
    </div>
  );
}

function FormulaBox({ K, mu1, mu2, muPost, sig1, sig2, sigPost }) {
  const fmt = v => v.toFixed(3);
  return (
    <div style={{
      background: COLORS.panel, border: `1px solid ${COLORS.border}`,
      borderRadius: 10, padding: "14px 18px", fontFamily: "'JetBrains Mono', monospace",
      fontSize: 12, lineHeight: 1.9, color: COLORS.text,
    }}>
      <div style={{ color: COLORS.K, fontWeight: 700, fontSize: 13, marginBottom: 6, letterSpacing: 1 }}>
        卡爾曼增益推導
      </div>

      <div><span style={{ color: COLORS.text }}>σ₁² = </span><span style={{ color: COLORS.mu1 }}>{fmt(sig1 ** 2)}</span>
        <span style={{ color: COLORS.text }}>　σ₂² = </span><span style={{ color: COLORS.mu2 }}>{fmt(sig2 ** 2)}</span>
      </div>

      <div style={{ marginTop: 4 }}>
        <span style={{ color: COLORS.K, fontWeight: 700 }}>K = σ₁² / (σ₁² + σ₂²) = </span>
        <span style={{ color: COLORS.K, fontSize: 15, fontWeight: 700 }}>{fmt(K)}</span>
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 8, paddingTop: 8 }}>
        <div>
          <span style={{ color: COLORS.text }}>μ_post = μ₁ + </span>
          <span style={{ color: COLORS.K }}>K</span>
          <span style={{ color: COLORS.text }}> · (μ₂ − μ₁)</span>
        </div>
        <div>
          <span style={{ color: COLORS.text }}>　　　= {fmt(mu1)} + </span>
          <span style={{ color: COLORS.K }}>{fmt(K)}</span>
          <span style={{ color: COLORS.text }}> · ({fmt(mu2)} − {fmt(mu1)})</span>
        </div>
        <div>
          <span style={{ color: COLORS.text }}>　　　= </span>
          <span style={{ color: COLORS.muPost, fontWeight: 700 }}>{fmt(muPost)}</span>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 8, paddingTop: 8 }}>
        <div>
          <span style={{ color: COLORS.text }}>σ²_post = (1−</span>
          <span style={{ color: COLORS.K }}>K</span>
          <span style={{ color: COLORS.text }}>) · σ₁² = </span>
          <span style={{ color: COLORS.muPost, fontWeight: 700 }}>{fmt(sigPost ** 2)}</span>
        </div>
        <div style={{ color: COLORS.text, marginTop: 2 }}>
          σ_post = <span style={{ color: COLORS.muPost, fontWeight: 700 }}>{fmt(sigPost)}</span>
          <span style={{ color: "#64748b" }}> （不確定性縮小）</span>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 8, paddingTop: 8, color: "#64748b", fontSize: 11 }}>
        <div>• K→0：σ₂≫σ₁，完全信任預測</div>
        <div>• K→1：σ₁≫σ₂，完全信任量測</div>
        <div>• K=0.5：σ₁=σ₂，各佔一半</div>
      </div>
    </div>
  );
}

export default function App() {
  const [mu1, setMu1] = useState(2.0);
  const [sig1, setSig1] = useState(2.0);
  const [mu2, setMu2] = useState(7.0);
  const [sig2, setSig2] = useState(1.2);
  const [hovered, setHovered] = useState(null);

  const K = (sig1 ** 2) / (sig1 ** 2 + sig2 ** 2);
  const muPost = mu1 + K * (mu2 - mu1);
  const sigPost = Math.sqrt((1 - K) * sig1 ** 2);

  // Build curve points
  const pts1 = sample(mu1, sig1, gaussian);
  const pts2 = sample(mu2, sig2, gaussian);
  const ptsRaw = pts1.map(([x, y], i) => [x, y * pts2[i][1]]);
  const rawMax = Math.max(...ptsRaw.map(([, y]) => y));
  const postScale = gaussian(muPost, muPost, sigPost); // peak of posterior
  const scaleFactor = rawMax > 0 ? postScale / rawMax : 1;
  const ptsProd = ptsRaw.map(([x, y]) => [x, y * scaleFactor]);

  const yMax = Math.max(
    ...pts1.map(([, y]) => y),
    ...pts2.map(([, y]) => y),
    ...ptsProd.map(([, y]) => y),
  ) * 1.18;

  // Grid lines
  const gridXs = [-6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14, 16];
  const gridYCount = 4;

  // Vertical marker at mu positions
  const muLine = (mu, color) => {
    const cx = toCanvasX(mu);
    const cy0 = toCanvasY(0, yMax);
    return <line key={mu} x1={cx} y1={PAD.top} x2={cx} y2={cy0} stroke={color} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />;
  };

  return (
    <div style={{
      background: COLORS.bg, minHeight: "100vh", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", fontFamily: "'JetBrains Mono', monospace",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Noto+Sans+TC:wght@400;700&display=swap');
        input[type=range] { height: 4px; border-radius: 2px; }
        * { box-sizing: border-box; }
      `}</style>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ color: COLORS.K, fontWeight: 700, fontSize: 18, letterSpacing: 2, marginBottom: 4 }}>
          兩高斯乘積 → 卡爾曼增益 K
        </div>
        <div style={{ color: "#475569", fontSize: 12 }}>
          p₁(x) · p₂(x) &nbsp;∝&nbsp; N(μ_post, σ²_post) &nbsp;|&nbsp; 拖動滑桿觀察 K 的變化
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", gap: 20, width: "100%", maxWidth: 1080, alignItems: "flex-start" }}>

        {/* Left: chart + legend */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* SVG Chart */}
          <div style={{
            background: COLORS.panel, borderRadius: 12,
            border: `1px solid ${COLORS.border}`,
            overflow: "hidden", boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
          }}>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
              <defs>
                <clipPath id="plot-clip">
                  <rect x={PAD.left} y={PAD.top} width={W - PAD.left - PAD.right} height={H - PAD.top - PAD.bottom} />
                </clipPath>
              </defs>

              {/* Grid */}
              {gridXs.map(gx => (
                <line key={gx} x1={toCanvasX(gx)} y1={PAD.top}
                  x2={toCanvasX(gx)} y2={H - PAD.bottom}
                  stroke={COLORS.grid} strokeWidth={1} />
              ))}
              {Array.from({ length: gridYCount + 1 }, (_, i) => {
                const cy = PAD.top + (i / gridYCount) * (H - PAD.top - PAD.bottom);
                return <line key={i} x1={PAD.left} y1={cy} x2={W - PAD.right} y2={cy}
                  stroke={COLORS.grid} strokeWidth={1} />;
              })}

              {/* Axes */}
              <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom}
                stroke={COLORS.axis} strokeWidth={1.5} />
              <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom}
                stroke={COLORS.axis} strokeWidth={1.5} />

              {/* X-axis labels */}
              {gridXs.filter(x => x >= X_MIN && x <= X_MAX).map(gx => (
                <text key={gx} x={toCanvasX(gx)} y={H - PAD.bottom + 14}
                  textAnchor="middle" fontSize={9} fill={COLORS.text}>{gx}</text>
              ))}

              <g clipPath="url(#plot-clip)">
                {/* Filled areas */}
                <path d={buildArea(pts1, yMax)} fill={COLORS.prior.fill} />
                <path d={buildArea(pts2, yMax)} fill={COLORS.meas.fill} />
                <path d={buildArea(ptsProd, yMax)} fill={COLORS.post.fill} />

                {/* Curve lines */}
                <path d={buildPath(pts1, yMax)} fill="none"
                  stroke={COLORS.prior.stroke} strokeWidth={2.2} opacity={hovered && hovered !== "prior" ? 0.3 : 1} />
                <path d={buildPath(pts2, yMax)} fill="none"
                  stroke={COLORS.meas.stroke} strokeWidth={2.2} opacity={hovered && hovered !== "meas" ? 0.3 : 1} />
                <path d={buildPath(ptsProd, yMax)} fill="none"
                  stroke={COLORS.post.stroke} strokeWidth={2.8} strokeDasharray="none"
                  opacity={hovered && hovered !== "post" ? 0.3 : 1} />

                {/* Mu vertical lines */}
                {muLine(mu1, COLORS.mu1)}
                {muLine(mu2, COLORS.mu2)}
                {muLine(muPost, COLORS.muPost)}

                {/* Mu labels */}
                {[
                  [mu1, COLORS.mu1, "μ₁"],
                  [mu2, COLORS.mu2, "μ₂"],
                  [muPost, COLORS.muPost, "μ_post"],
                ].map(([mu, color, lab]) => {
                  const cx = toCanvasX(mu);
                  const isPost = lab === "μ_post";
                  return (
                    <g key={lab}>
                      <circle cx={cx} cy={toCanvasY(0, yMax)} r={4} fill={color} />
                      <text x={cx} y={PAD.top + (isPost ? 18 : 10)} textAnchor="middle"
                        fontSize={isPost ? 11 : 10} fill={color} fontWeight={isPost ? 700 : 400}>
                        {lab}
                      </text>
                    </g>
                  );
                })}

                {/* K annotation arrow between mu1 and muPost */}
                {(() => {
                  const cx1 = toCanvasX(mu1), cx2 = toCanvasX(muPost);
                  const cy = toCanvasY(yMax * 0.06, yMax);
                  const mid = (cx1 + cx2) / 2;
                  return (
                    <g>
                      <line x1={cx1} y1={cy} x2={cx2} y2={cy} stroke={COLORS.K} strokeWidth={1.5}
                        markerEnd="url(#arrow-k)" opacity={0.85} />
                      <text x={mid} y={cy - 6} textAnchor="middle" fontSize={10} fill={COLORS.K} fontWeight={700}>
                        K·(μ₂−μ₁)
                      </text>
                    </g>
                  );
                })()}
              </g>

              {/* Arrow marker */}
              <defs>
                <marker id="arrow-k" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill={COLORS.K} />
                </marker>
              </defs>

              {/* Chart title */}
              <text x={W / 2} y={14} textAnchor="middle" fontSize={10} fill="#475569">
                p(x)
              </text>
            </svg>
          </div>

          {/* Legend */}
          <div style={{
            display: "flex", gap: 20, justifyContent: "center",
            marginTop: 12, flexWrap: "wrap",
          }}>
            {[
              [COLORS.prior.stroke, "p₁(x) 先驗（預測）", "prior"],
              [COLORS.meas.stroke, "p₂(x) 似然（量測）", "meas"],
              [COLORS.post.stroke, "p₁·p₂（後驗，已正規化）", "post"],
            ].map(([color, label, key]) => (
              <div key={key}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", opacity: hovered && hovered !== key ? 0.4 : 1, transition: "opacity 0.2s" }}>
                <div style={{ width: 28, height: 3, background: color, borderRadius: 2 }} />
                <span style={{ color: COLORS.text, fontSize: 12 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Sliders */}
          <div style={{
            background: COLORS.panel, border: `1px solid ${COLORS.border}`,
            borderRadius: 10, padding: "14px 18px", marginTop: 16,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
              <div>
                <div style={{ color: COLORS.mu1, fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>先驗 p₁（藍色）</div>
                <Slider label="μ₁" value={mu1} min={-5} max={12} step={0.1} onChange={setMu1} color={COLORS.mu1} />
                <Slider label="σ₁" value={sig1} min={0.3} max={4} step={0.05} onChange={setSig1} color={COLORS.mu1} />
              </div>
              <div>
                <div style={{ color: COLORS.mu2, fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>似然 p₂（橙色）</div>
                <Slider label="μ₂" value={mu2} min={-5} max={12} step={0.1} onChange={setMu2} color={COLORS.mu2} />
                <Slider label="σ₂" value={sig2} min={0.3} max={4} step={0.05} onChange={setSig2} color={COLORS.mu2} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: formula box */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <FormulaBox K={K} mu1={mu1} mu2={mu2} muPost={muPost}
            sig1={sig1} sig2={sig2} sigPost={sigPost} />

          {/* K gauge */}
          <div style={{
            background: COLORS.panel, border: `1px solid ${COLORS.border}`,
            borderRadius: 10, padding: "14px 18px", marginTop: 14,
          }}>
            <div style={{ color: COLORS.K, fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: 1 }}>
              K = {K.toFixed(3)}
            </div>
            {/* Bar */}
            <div style={{ background: "#1e293b", borderRadius: 6, height: 14, position: "relative", overflow: "hidden" }}>
              <div style={{
                width: `${K * 100}%`, height: "100%",
                background: `linear-gradient(90deg, #38bdf8, #facc15 ${K * 100}%)`,
                borderRadius: 6, transition: "width 0.15s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, color: "#475569", fontSize: 10 }}>
              <span>0　信任預測</span>
              <span>信任量測　1</span>
            </div>

            {/* Interpretation */}
            <div style={{ marginTop: 12, color: "#64748b", fontSize: 11, lineHeight: 1.8 }}>
              {K < 0.2 && <div style={{ color: COLORS.mu1 }}>→ 模型精確，幾乎忽略量測</div>}
              {K >= 0.2 && K <= 0.4 && <div style={{ color: "#93c5fd" }}>→ 偏信任預測</div>}
              {K > 0.4 && K < 0.6 && <div style={{ color: COLORS.K }}>→ 先驗與量測各半</div>}
              {K >= 0.6 && K <= 0.8 && <div style={{ color: "#fdba74" }}>→ 偏信任量測</div>}
              {K > 0.8 && <div style={{ color: COLORS.mu2 }}>→ 感測器精確，幾乎忽略預測</div>}
              <div style={{ marginTop: 4 }}>
                σ_post = <span style={{ color: COLORS.muPost }}>{sigPost.toFixed(3)}</span>
                　縮小了 <span style={{ color: COLORS.muPost }}>{((1 - sigPost / sig1) * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Precision view */}
          <div style={{
            background: COLORS.panel, border: `1px solid ${COLORS.border}`,
            borderRadius: 10, padding: "14px 18px", marginTop: 14,
            fontSize: 11, color: COLORS.text, lineHeight: 1.9,
          }}>
            <div style={{ color: "#94a3b8", fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>精度（Precision）加法</div>
            <div><span style={{ color: COLORS.mu1 }}>λ₁</span> = 1/σ₁² = <span style={{ color: COLORS.mu1 }}>{(1 / sig1 ** 2).toFixed(3)}</span></div>
            <div><span style={{ color: COLORS.mu2 }}>λ₂</span> = 1/σ₂² = <span style={{ color: COLORS.mu2 }}>{(1 / sig2 ** 2).toFixed(3)}</span></div>
            <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 6, paddingTop: 6 }}>
              <span style={{ color: COLORS.muPost }}>λ_post</span> = λ₁ + λ₂ = <span style={{ color: COLORS.muPost }}>{(1 / sigPost ** 2).toFixed(3)}</span>
            </div>
            <div style={{ color: "#475569", marginTop: 4, fontSize: 10 }}>
              ※ 融合後精度 = 兩精度之和（類電阻並聯）
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
