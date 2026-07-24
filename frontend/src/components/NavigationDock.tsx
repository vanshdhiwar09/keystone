"use client";

interface DockProps {
    activeView: string;
    setActiveView: (v: string) => void;
}

export default function NavigationDock({ activeView, setActiveView }: DockProps) {
    const tabs = [
        {
            id: "dashboard",
            label: "Dashboard",
            icon: (
                <svg className="dock-icon" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
            )
        },
        {
            id: "blueprint",
            label: "Blueprint",
            icon: (
                <svg className="dock-icon" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
            )
        },
        {
            id: "create",
            label: "Create",
            icon: (
                <svg className="dock-icon" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            )
        },
        {
            id: "tx",
            label: "Terminal",
            icon: (
                <svg className="dock-icon" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                    <polyline points="4 17 10 11 4 5"></polyline>
                    <line x1="12" y1="19" x2="20" y2="19"></line>
                </svg>
            )
        },
        {
            id: "feed",
            label: "Pulse",
            icon: (
                <svg className="dock-icon" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
            )
        },
        {
            id: "disputes",
            label: "Disputes",
            icon: (
                <svg className="dock-icon" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            )
        },
    ];

    return (
        <nav className="floating-dock">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    className={`dock-btn${activeView === tab.id ? " active" : ""}`}
                    onClick={() => setActiveView(tab.id)}
                >
                    {tab.icon}
                    <span className="dock-label">{tab.label}</span>
                </button>
            ))}
        </nav>
    );
}
