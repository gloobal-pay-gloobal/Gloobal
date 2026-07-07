import React from "react";


export function GlobeHero({ size = 460 }: { size?: number }) {
  // Glint positions (satellite/connection lights scattered over the visible globe), % of container
  const glints = [
    { x: 46, y: 30, d: 0 }, { x: 62, y: 22, d: 0.4 }, { x: 71, y: 46, d: 0.9 },
    { x: 55, y: 58, d: 1.4 }, { x: 38, y: 48, d: 0.7 }, { x: 80, y: 30, d: 1.8 },
    { x: 66, y: 68, d: 2.2 }, { x: 30, y: 34, d: 1.1 },
  ];
  const arcs = [
    "M 155,140 Q 260,60 340,105",
    "M 210,190 Q 300,240 380,160",
    "M 140,220 Q 220,290 320,250",
  ];

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {/* Sphere with rotating texture */}
      <div
        className="relative w-full h-full rounded-full overflow-hidden"
        style={{
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.4), -6px -4px 30px rgba(255,255,255,0.5), inset -30px -20px 70px rgba(10,20,50,0.55), inset 16px 14px 50px rgba(255,255,255,0.25)",
        }}
      >
        <div className="absolute inset-0 flex animate-[spinearth_3s_linear_infinite]" style={{ width: "200%" }}>
          <img
            src="https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg"
            alt=""
            className="w-1/2 h-full object-cover"
            draggable={false}
          />
          <img
            src="https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg"
            alt=""
            className="w-1/2 h-full object-cover"
            draggable={false}
          />
        </div>
        {/* spherical shading for depth + soft light source top-left, like the reference photo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 30% 26%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 32%), radial-gradient(circle at 68% 78%, rgba(3,10,30,0.6) 0%, rgba(3,10,30,0) 55%)",
          }}
        />
        {/* faint blue atmosphere rim */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ boxShadow: "inset 0 0 40px 6px rgba(120,180,255,0.35)" }}
        />

        {/* connection arcs, drawn over the globe */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 460 460">
          {arcs.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="1.2"
              strokeDasharray="3 7"
              className="animate-[dashflow_2.4s_linear_infinite]"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </svg>

        {/* glinting connection lights */}
        {glints.map((g, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white animate-[twinkle_2.6s_ease-in-out_infinite]"
            style={{
              left: `${g.x}%`,
              top: `${g.y}%`,
              width: 4,
              height: 4,
              boxShadow: "0 0 6px 2px rgba(255,255,255,0.9)",
              animationDelay: `${g.d}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes spinearth { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes twinkle { 0%, 100% { opacity: 0.15; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.3); } }
        @keyframes dashflow { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }
      `}</style>
    </div>
  );
}
