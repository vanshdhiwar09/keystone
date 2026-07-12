import ConnectWallet from "../components/ConnectWallet";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex justify-between items-center px-4 py-4 bg-alum border-b border-limestone sticky top-0 z-10 w-full">
        <h1 className="text-xl font-display font-bold tracking-tight text-iron">Keystone</h1>
        <ConnectWallet />
      </header>

      <main className="flex-1 p-6 flex flex-col items-center justify-center bg-steel max-w-[375px] mx-auto w-full border-x border-limestone shadow-[0_0_20px_rgba(0,0,0,0.03)]">
        <p className="text-iron/40 text-sm text-center">
          Ledger content boundary
        </p>
      </main>

      <footer className="p-4 border-t border-limestone text-center text-xs text-iron/50 bg-alum w-full">
        © 2026 Keystone Escrow
      </footer>
    </div>
  );
}
