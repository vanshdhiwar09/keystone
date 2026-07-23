"use client";

interface DockProps {
    activeView: string;
    setActiveView: (v: string) => void;
}

export default function NavigationDock({ activeView, setActiveView }: DockProps) {
    const tabs = [
        { id: "dashboard", label: "Dashboard" },
        { id: "blueprint", label: "Blueprint" },
        { id: "create", label: "Create" },
        { id: "tx", label: "Terminal" },
        { id: "feed", label: "Pulse" },
        { id: "disputes", label: "Disputes" },
    ];

    return (
        <nav className="floating-dock">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    className={`dock-btn${activeView === tab.id ? " active" : ""}`}
                    onClick={() => setActiveView(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </nav>
    );
}
