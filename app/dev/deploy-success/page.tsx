"use client";

import { useState } from "react";
import { Modal } from "@pandasui/ui";
import { cn } from "@pandasui/ui/lib";
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
  // The full Move coin type users will see + copy in the success modal.
  // Format: <package>::<module>::<WITNESS>. Use a long realistic package
  // hex so the truncation logic exercises the way it does in production.
  coinType:
    "0x1951ebda0d3f7e9c4d6e2a1c5b8f0a3e7d9c4b6a2e8f1d5c7b3a9e0f2d4c6b8a::oono::OONO",
  // The shared Project<T> object ID created by `create_project`. When this
  // is set, the continue CTA flips to "Open project page" and the X tweet
  // links to /projects/[projectId] so X can fetch the OG card.
  projectId:
    "0xab12cd34ef56789012345678901234567890abcdef1234567890abcd1234efaa",
};

export default function DeploySuccessPreview() {
  const [open, setOpen] = useState(true);
  // Toggle the late-arriving project ID so you can preview both states:
  //   - off  → continue CTA reads "See it on Explore", tweet links /explore
  //   - on   → continue CTA reads "Open project page", tweet links /projects/[id]
  const [hasProjectId, setHasProjectId] = useState(true);

  return (
    <main className="min-h-screen bg-bone p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono-label text-[11px] text-ink/70">
          dev · deploy-success preview
        </h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHasProjectId((v) => !v)}
            aria-pressed={hasProjectId}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 border px-2.5 font-mono-label text-[10px] transition-colors",
              hasProjectId
                ? "border-jade bg-jade/10 text-jade"
                : "border-ink/25 text-ink/70 hover:border-ink hover:text-ink",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "block h-1 w-1 rounded-full",
                hasProjectId ? "bg-jade" : "bg-ink/30",
              )}
            />
            projectId · {hasProjectId ? "resolved" : "pending"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="border border-ink px-3 py-1.5 font-mono-label text-[10px] hover:bg-ink hover:text-bone"
          >
            reopen modal
          </button>
        </div>
      </div>

      <p className="max-w-prose font-mono text-[11px] text-ink/55">
        Renders <code>{`<DeploySuccess>`}</code> inside the real{" "}
        <code>{`<Modal>`}</code> with fixture data. The GSAP timeline runs on
        every open — close + reopen to replay. Toggle{" "}
        <code>projectId</code> to preview the modal before and after the
        background RPC fills in the new <code>Project&lt;T&gt;</code> object
        ID.
      </p>

      <div className="mt-4 max-w-prose space-y-1 font-mono text-[10px] text-ink/55">
        <div>
          <span className="text-ink/40">CA · </span>
          <span className="break-all text-ink/75">{FIXTURE.coinType}</span>
        </div>
        {hasProjectId && (
          <div>
            <span className="text-ink/40">Project · </span>
            <span className="break-all text-ink/75">{FIXTURE.projectId}</span>
          </div>
        )}
      </div>

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
          coinType={FIXTURE.coinType}
          projectId={hasProjectId ? FIXTURE.projectId : undefined}
          txDigest={FIXTURE.txDigest}
          onContinue={() => setOpen(false)}
          continueLabel={
            hasProjectId ? "Open project page" : "See it on Explore"
          }
        />
      </Modal>
    </main>
  );
}
