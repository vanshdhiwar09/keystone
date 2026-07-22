"use client";

import { useState } from "react";
import Header from "../components/Header";
import NavigationDock from "../components/NavigationDock";

import DashboardView from "../components/views/DashboardView";
import BlueprintView from "../components/views/BlueprintView";
import VaultView from "../components/views/VaultView";
import TerminalView from "../components/views/TerminalView";
import ActivityView from "../components/views/ActivityView";

export default function Home() {
  const [activeView, setActiveView] = useState("dashboard");

  // Parse job ID from "blueprint:42" style navigation from DashboardView
  const isBlueprintView = activeView === "blueprint" || activeView.startsWith("blueprint:");
  const blueprintJobId = activeView.startsWith("blueprint:")
    ? parseInt(activeView.split(":")[1], 10)
    : undefined;

  // Normalised view name for NavigationDock (strip the :id suffix)
  const dockView = activeView.includes(":") ? activeView.split(":")[0] : activeView;

  return (
    <>
      <Header />

      {activeView === "dashboard" && <DashboardView setView={setActiveView} />}
      {isBlueprintView && <BlueprintView setView={setActiveView} initialJobId={blueprintJobId} />}
      {(activeView === "vault" || activeView === "create") && <VaultView setView={setActiveView} />}
      {activeView === "tx" && <TerminalView />}
      {activeView === "feed" && <ActivityView />}

      <NavigationDock activeView={dockView} setActiveView={setActiveView} />
    </>
  );
}
