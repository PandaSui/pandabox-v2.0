import { Wordmark } from "@/components/brand/wordmark";
import { ConnectWallet } from "@/components/wallet/connect-wallet";

export default function Page() {
  return (
    <main
      id="main"
      className="container flex min-h-svh flex-col items-center justify-center gap-10 py-24"
    >
      <Wordmark className="text-ink" />
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl md:text-5xl">
          <span className="marker marker--saffron">Pandabox</span> 2.0
        </h1>
        <p className="mt-6 text-base text-ink-60">
          Design system seeded from Pandasui. Ready to build.
        </p>
      </div>
      <ConnectWallet />
    </main>
  );
}
