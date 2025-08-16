import React from "react";
import bus from "../lib/bus";

export default function MenuOrb() {
  function toggleSidebar() {
    bus.emit("sidebar:toggle");
  }

  return (
    <>
      <div
        className="menu-orb"
        role="button"
        tabIndex={0}
        aria-label="Toggle sidebar"
        onClick={toggleSidebar}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSidebar();
          }
        }}
      >
        <div className="orb-core" />
      </div>
      <style>{`
        .menu-orb{
          position:fixed;left:16px;top:16px;z-index:60;
          width:64px;height:64px;cursor:pointer;
        }
        .menu-orb .orb-core{
          width:100%;height:100%;border-radius:50%;
          border:1px solid var(--stroke-2);
          background:
            radial-gradient(60% 60% at 40% 35%, rgba(255,255,255,.9), rgba(255,255,255,.2) 65%, transparent 70%),
            radial-gradient(80% 80% at 70% 70%, rgba(10,132,255,.8), rgba(10,132,255,.2) 70%, transparent 72%),
            radial-gradient(120% 120% at 50% 50%, rgba(10,132,255,.2), transparent 60%);
          box-shadow:0 0 0 1px rgba(255,255,255,.06) inset, 0 8px 40px color-mix(in srgb, var(--blue) 35%, transparent);
        }
      `}</style>
    </>
  );
}
