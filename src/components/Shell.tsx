// src/components/Shell.tsx
import React from "react";
import Feed from "./feed/Feed";
import World3D from "./World3D";
import AssistantOrb from "./AssistantOrb";
import MenuOrb from "./MenuOrb";
import ChatDock from "./ChatDock";
import Sidebar from "./Sidebar";
import PortalOverlay from "./PortalOverlay";
import NeonRibbonComposer from "./NeonRibbonComposer";
import AvatarPortal from "./AvatarPortal";

export default function Shell() {
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
    </>
  );
}
