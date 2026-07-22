"use client";

interface DockProps {
    activeView: string;
    setActiveView: (v: string) => void;
}

export default function NavigationDock({ activeView, setActiveView }: DockProps) {
    const tabs = [
        { id: "dashboard", label: "Dashboard" },
        { id: "blueprint", label: "Explorer" },
        { id: "create", label: "New Contract" },
        { id: "tx", label: "Terminal" },
        { id: "feed", label: "Activity" },
    ];

    return (
        <div className="floating-dock">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    className={`dock-btn${activeView === tab.id ? " active" : ""}`}
                    onClick={() => setActiveView(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
