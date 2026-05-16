import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/blocks";
import { Container } from "@/components/primitives/container";
import { MonoLabel } from "@/components/primitives/mono-label";
import { Diecut } from "@/components/primitives/diecut";
import { Address } from "@/components/identity/address";
import { RelativeTime } from "@/components/identity/relative-time";
import { SuiAmount } from "@/components/identity/sui-amount";
import { TokenAmount } from "@/components/identity/token-amount";
import { AdminCapCard } from "@/components/project/admin-cap-card";
import { ProjectHero } from "@/components/project/project-hero";
import { ProjectTabs, type ProjectTab } from "@/components/project/project-tabs";
import {
  CycleStepper,
  ReconfigurationBanner,
} from "@/components/cycles";
import { ActivityTable, HoldersTable } from "@/components/data";
import { PayPanel } from "@/components/pay";
import {
  getActivity,
  getCycles,
  getHolders,
  getProject,
} from "@/lib/indexer";
import {
  toCycleDTO,
  toHolderDTO,
  toPaymentDTO,
} from "@/lib/api/project-dto";
import type { ProjectDTO } from "@/lib/api/project-dto";

const ACTIVITY_PAGE = 25;

type Props = {
  params: Promise<{ projectId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) return { title: "Project not found" };
  return {
    title: `${project.name} — ${project.ticker}`,
    description: project.tagline,
  };
}

export default async function ProjectPage({ params }: Props) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const [cycles, holders, activity] = await Promise.all([
    getCycles(project.id),
    getHolders(project.id),
    getActivity(project.id, { limit: ACTIVITY_PAGE }),
  ]);

  const projectDto: ProjectDTO = {
    id: project.id,
    packageId: project.packageId,
    name: project.name,
    ticker: project.ticker,
    tagline: project.tagline,
    description: project.description,
    category: project.category,
    accent: project.accent,
    coverImage: project.coverImage,
    creator: project.creator,
    adminCapId: project.adminCapId,
    status: project.status,
    deployedAt: project.deployedAt,
    raisedMist: project.raisedMist.toString(),
    supporters: project.supporters,
    cycleNumber: project.cycleNumber,
    cycleStart: project.cycleStart,
    cycleEnd: project.cycleEnd,
    params: {
      weight: project.params.weight.toString(),
      reservedRate: project.params.reservedRate,
      cashOutTax: project.params.cashOutTax,
      issuanceReduction: project.params.issuanceReduction,
      payoutLimitMist: project.params.payoutLimitMist.toString(),
      ballotDelayHours: project.params.ballotDelayHours,
    },
    tiers: project.tiers.map((t) => ({
      ...t,
      priceMist: t.priceMist.toString(),
    })),
    queuedReconfiguration: project.queuedReconfiguration
      ? {
          takesEffectAt: project.queuedReconfiguration.takesEffectAt,
          summary: project.queuedReconfiguration.summary,
          params: {},
        }
      : null,
    socials: project.socials,
  };
  const cycleDtos = cycles.map(toCycleDTO);
  const holderDtos = holders.map(toHolderDTO);
  const activityDto = {
    items: activity.items.map(toPaymentDTO),
    nextCursor: activity.nextCursor,
  };

  const tabs: ProjectTab[] = [
    {
      id: "about",
      label: "About",
      content: <AboutTab project={projectDto} />,
    },
    {
      id: "cycles",
      label: "Cycles",
      badge: String(cycleDtos.length),
      content: (
        <CycleStepper cycles={cycleDtos} ticker={projectDto.ticker} />
      ),
    },
    {
      id: "tiers",
      label: "Tiers",
      badge: projectDto.tiers.length ? String(projectDto.tiers.length) : undefined,
      content: <TiersTab project={projectDto} />,
    },
    {
      id: "activity",
      label: "Activity",
      content: (
        <ActivityTable
          projectId={projectDto.id}
          initial={activityDto}
          pageSize={ACTIVITY_PAGE}
        />
      ),
    },
  ];

  return (
    <>
      <Nav showPulse />
      <main id="main">
        {projectDto.queuedReconfiguration && (
          <ReconfigurationBanner
            takesEffectAt={projectDto.queuedReconfiguration.takesEffectAt}
            summary={projectDto.queuedReconfiguration.summary}
          />
        )}

        <ProjectHero project={projectDto} />

        <section>
          <Container className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[3fr_6fr_3.5fr]">
            <LeftRail project={projectDto} />
            <div className="min-w-0">
              <ProjectTabs tabs={tabs} />
            </div>
            <PayPanel project={projectDto} />
          </Container>
        </section>

        <section className="border-t border-ink/15">
          <Container className="py-12">
            <MonoLabel>Holders</MonoLabel>
            <p className="mt-1 text-xs text-ink/55">
              Top {Math.min(25, holderDtos.length)} of{" "}
              {holderDtos.length.toLocaleString()} token holders.
            </p>
            <div className="mt-4">
              <HoldersTable
                holders={holderDtos}
                ticker={projectDto.ticker}
                topN={25}
              />
            </div>
          </Container>
        </section>

        <Footer />
      </main>
    </>
  );
}

function LeftRail({ project }: { project: ProjectDTO }) {
  return (
    <div className="space-y-6">
      <AdminCapCard capId={project.adminCapId} holder={project.creator} />

      <div className="space-y-1">
        <MonoLabel>Contract</MonoLabel>
        <Address value={project.packageId} link />
      </div>

      <div className="space-y-1">
        <MonoLabel>Deployed</MonoLabel>
        <RelativeTime value={project.deployedAt} />
      </div>

      <div className="space-y-1">
        <MonoLabel>Category</MonoLabel>
        <Diecut className="inline-flex bg-ink/8 px-2 py-0.5">
          <span className="font-mono-label text-[10px]">
            {project.category}
          </span>
        </Diecut>
      </div>

      {(project.socials.twitter ||
        project.socials.website ||
        project.socials.discord) && (
        <div className="space-y-1">
          <MonoLabel>Links</MonoLabel>
          <ul className="space-y-1 text-xs">
            {project.socials.website && (
              <li>
                <a
                  href={`https://${project.socials.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink/70 hover:text-ink"
                >
                  {project.socials.website}
                </a>
              </li>
            )}
            {project.socials.twitter && (
              <li>
                <a
                  href={`https://x.com/${project.socials.twitter}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink/70 hover:text-ink"
                >
                  @{project.socials.twitter}
                </a>
              </li>
            )}
            {project.socials.discord && (
              <li>
                <a
                  href={project.socials.discord}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink/70 hover:text-ink"
                >
                  Discord
                </a>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function AboutTab({ project }: { project: ProjectDTO }) {
  return (
    <div className="prose-pandabox max-w-prose space-y-4 text-sm leading-relaxed text-ink/80">
      <p>{project.description}</p>
      <hr className="border-ink/15" />
      <p className="text-xs text-ink/55">
        Backers receive {project.params.weight} {project.ticker} per SUI
        contributed in this cycle, with{" "}
        {project.params.reservedRate}% reserved for the team and a{" "}
        {project.params.cashOutTax}% cash-out tax on surplus. Reconfigurations
        queue for {project.params.ballotDelayHours} hours before taking effect.
      </p>
    </div>
  );
}

function TiersTab({ project }: { project: ProjectDTO }) {
  if (project.tiers.length === 0) {
    return (
      <p className="text-sm text-ink/55">This project has no NFT tiers.</p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {project.tiers.map((t) => (
        <div
          key={t.id}
          className="diecut border border-ink/15 bg-bone/40 p-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-base">{t.name}</h4>
            <SuiAmount mist={BigInt(t.priceMist)} maxFractionDigits={2} />
          </div>
          <p className="mt-2 text-xs text-ink/65">{t.perks}</p>
          <div className="mt-3 font-mono text-[10px] text-ink/45">
            {t.maxSupply > 0
              ? `${t.minted}/${t.maxSupply} minted`
              : `${t.minted} minted · unlimited supply`}
          </div>
          <div className="mt-2 font-mono text-[10px] text-ink/45">
            ≈{" "}
            <TokenAmount
              raw={
                (BigInt(t.priceMist) * BigInt(project.params.weight)) /
                1_000_000_000n
              }
              decimals={9}
              ticker={project.ticker}
              compact
            />{" "}
            included
          </div>
        </div>
      ))}
    </div>
  );
}
