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

  return (
    <>
      <Header />

      {activeView === "dashboard" && <DashboardView setView={setActiveView} />}
      {activeView === "blueprint" && <BlueprintView />}
      {activeView === "vault" && <VaultView />}
      {activeView === "tx" && <TerminalView />}
      {activeView === "feed" && <ActivityView />}

      <NavigationDock activeView={activeView} setActiveView={setActiveView} />
    </>
  );
}
