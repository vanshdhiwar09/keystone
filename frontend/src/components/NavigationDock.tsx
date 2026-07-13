"use client";
import { useEffect, useRef } from "react";

interface DockProps {
    activeView: string;
    setActiveView: (v: string) => void;
}

export default function NavigationDock({ activeView, setActiveView }: DockProps) {
    const dockRef = useRef<HTMLNavElement>(null);
    const indRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Dynamic physical indicator tracking matching the CSS math variables statically bridging physical states
        const updateIndicator = () => {
            if (!dockRef.current || !indRef.current) return;
            const activeBtn = dockRef.current.querySelector('.dock-item.active') as HTMLElement;
            if (activeBtn) {
                indRef.current.style.transform = `translateX(${activeBtn.offsetLeft - 6}px)`;
                indRef.current.style.width = `${activeBtn.offsetWidth}px`;
            }
        };

        requestAnimationFrame(updateIndicator);
        window.addEventListener("resize", updateIndicator);
        return () => window.removeEventListener("resize", updateIndicator);
    }, [activeView]);

    const tabs = [
        { id: "dashboard", label: "Dashboard" },
        { id: "blueprint", label: "Blueprint" },
        { id: "vault", label: "Vault" },
        { id: "tx", label: "Terminal" },
        { id: "feed", label: "Activity" }
    ];

    return (
        <div className="nav-dock-wrapper" id="nav-dock" style={{ opacity: 1, transform: "translate(-50%, 0)" }}>
            <nav className="nav-dock" ref={dockRef}>
                <div className="dock-indicator" id="dock-ind" ref={indRef}></div>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`dock-item ${activeView === tab.id ? "active" : ""}`}
                        onClick={() => setActiveView(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>
        </div>
    );
}
