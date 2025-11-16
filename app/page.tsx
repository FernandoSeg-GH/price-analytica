import TickerDashboard from "../components/TickerDashboard";

export default function Home() {
  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 font-sans dark:bg-black p-6">
      <main className="w-full max-w-4xl">
        {/* @ts-ignore Server component */}
        <TickerDashboard />
      </main>
    </div>
  );
}
