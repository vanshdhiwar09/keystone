import ConnectWallet from "../components/ConnectWallet";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Mobile-first base header mapping absolute fixed bounds over internal constraints */}
      <header className="flex justify-between items-center p-4 bg-white border-b sticky top-0 z-10 shadow-sm w-full">
        <h1 className="text-xl font-bold tracking-tight text-emerald-900">Keystone</h1>
        <ConnectWallet />
      </header>

      {/* Placeholder main execution tracking specific mobile bounds statically */}
      <main className="flex-1 p-6 flex flex-col items-center justify-center bg-gray-50 max-w-[375px] mx-auto w-full">
        <p className="text-gray-400 text-sm text-center">
          placeholder main content area
        </p>
      </main>

      <footer className="p-4 border-t text-center text-xs text-gray-400 bg-white shadow-[0_-1px_3px_rgba(0,0,0,0.05)] w-full">
        © 2026 Keystone Escrow Runtime
      </footer>
    </div>
  );
}
