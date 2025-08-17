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
          box-shadow:0 0 10px rgba(10,132,255,.6),0 0 30px rgba(10,132,255,.4);
          position:relative;overflow:hidden;
          animation:menuPulse 3s ease-in-out infinite;
        }
        .menu-orb .orb-core::before,
        .menu-orb .orb-core::after{
          content:"";position:absolute;inset:-40%;border-radius:50%;
          background:conic-gradient(from 0deg, rgba(10,132,255,.8), rgba(10,132,255,0) 60%);
          animation:spin 6s linear infinite;
          filter:blur(20px);mix-blend-mode:screen;pointer-events:none;
        }
        .menu-orb .orb-core::after{
          animation-direction:reverse;
          background:repeating-conic-gradient(from 0deg, rgba(10,132,255,.8) 0deg 15deg, transparent 15deg 30deg);
          opacity:.6;
        }
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes menuPulse{
          0%,100%{box-shadow:0 0 10px rgba(10,132,255,.6),0 0 30px rgba(10,132,255,.4);}
          50%{box-shadow:0 0 20px rgba(10,132,255,1),0 0 45px rgba(10,132,255,.8);}
        }
      `}</style>
    </>
  );
}
