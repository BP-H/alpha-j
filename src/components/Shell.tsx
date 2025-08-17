// src/components/Shell.tsx
import React, { useEffect, useState } from "react";
import Feed from "./feed/Feed";
import World3D from "./World3D";
import AssistantOrb from "./AssistantOrb";
import MenuOrb from "./MenuOrb";
import ChatDock from "./ChatDock";
import Sidebar from "./Sidebar";
import PortalOverlay from "./PortalOverlay";
import NeonRibbonComposer from "./NeonRibbonComposer";
import AvatarPortal from "./AvatarPortal";
import Toast from "./Toast";
import bus from "../lib/bus";

export default function Shell() {
  const [toast, setToast] = useState("");

  useEffect(() => {
    const off = bus.on("toast", (msg: string) => {
      setToast(msg);
      window.setTimeout(() => setToast(""), 1500);
    });
    return off;
  }, []);

  return (
    <>
      {/* 3D world behind everything */}
      <div className="world-layer" aria-hidden>
        <World3D />
      </div>
      <MenuOrb />
      <Sidebar />
      <PortalOverlay />

      <main>
        <NeonRibbonComposer />
        <Feed />
      </main>

      <ChatDock />
      <AssistantOrb />
      <AvatarPortal />
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </>
  );
}
