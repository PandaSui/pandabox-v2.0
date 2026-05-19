"use client";

import { useState } from "react";
import { Modal } from "@pandasui/ui";
import { DeploySuccess } from "@/components/create/deploy-success";

const FIXTURE = {
  projectName: "Panda Test",
  ticker: "OONO",
  coinSymbol: "OONO",
  // Public placeholder image; swap to a real IPFS cover if you have one.
  coverImage:
    "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=720&q=70&auto=format&fit=crop",
  tokensPerSui: "100000",
  allocationTokens: "1000000",
  endTimeMs: Date.now() + 14 * 24 * 60 * 60 * 1000,
  txDigest: "DEKgrU83vXn7BWqLpYnTQs4xN1zMHkVbCpRqYsBNXR",
};

export default function DeploySuccessPreview() {
  const [open, setOpen] = useState(true);

  return (
    <main className="min-h-screen bg-bone p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-mono-label text-[11px] text-ink/70">
          dev · deploy-success preview
        </h1>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border border-ink px-3 py-1.5 font-mono-label text-[10px] hover:bg-ink hover:text-bone"
        >
          reopen modal
        </button>
      </div>

      <p className="max-w-prose font-mono text-[11px] text-ink/55">
        Renders <code>{`<DeploySuccess>`}</code> inside the real{" "}
        <code>{`<Modal>`}</code> with fixture data. The GSAP timeline runs on
        every open — close + reopen to replay.
      </p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Transaction inspector"
      >
        <DeploySuccess
          projectName={FIXTURE.projectName}
          ticker={FIXTURE.ticker}
          coinSymbol={FIXTURE.coinSymbol}
          coverImage={FIXTURE.coverImage}
          tokensPerSui={FIXTURE.tokensPerSui}
          allocationTokens={FIXTURE.allocationTokens}
          endTimeMs={FIXTURE.endTimeMs}
          txDigest={FIXTURE.txDigest}
          onContinue={() => setOpen(false)}
          continueLabel="See it on Explore"
        />
      </Modal>
    </main>
  );
}
