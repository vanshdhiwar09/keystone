import { default as CreateJobFlow } from "../components/CreateJobFlow";
import ConnectWallet from "../components/ConnectWallet";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex justify-between items-center px-4 py-4 bg-alum border-b border-limestone sticky top-0 z-10 w-full relative">
        <h1 className="text-xl font-display font-bold tracking-tight text-iron">Keystone</h1>
        <ConnectWallet />
      </header>

      <main className="flex-1 flex flex-col bg-alum max-w-4xl mx-auto w-full border-x border-limestone shadow-[0_0_20px_rgba(0,0,0,0.03)] selection:bg-banknote selection:text-alum">
        <CreateJobFlow />
      </main>

      <footer className="p-4 border-t border-limestone text-center text-xs text-iron/50 bg-alum w-full">
        © 2026 Keystone Escrow
      </footer>
    </div>
  );
}
