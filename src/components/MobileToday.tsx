import Link from "next/link";
import { ArrowRight, Calculator, Camera, TabletSmartphone, Wrench } from "lucide-react";
import { MobileBenchStatus } from "@/components/MobileBenchStatus";
import type { AppLocale } from "@/lib/i18n";

type Experiment = { id: string; title: string; runCode: string; status: string; date: Date };

export function MobileToday({ experiments, today, monthKey, locale }: {
  experiments: Experiment[]; today: Date; monthKey: string; locale: AppLocale;
}) {
  const zh = locale === "zh";
  const actions = [
    { href: "/protocol-run", label: zh ? "现场模式" : "Run mode", icon: TabletSmartphone },
    { href: "/entries/new?mode=capture", label: zh ? "快速记录" : "Quick capture", icon: Camera },
    { href: "/tools/calculator", label: zh ? "计算器" : "Calculator", icon: Calculator },
    { href: "/tools", label: zh ? "工具" : "Tools", icon: Wrench },
  ];
  const ordered = [...experiments].sort((a, b) =>
    Number(b.status === "running") - Number(a.status === "running") || a.date.getTime() - b.date.getTime());

  return <section className="bench-mobile space-y-5 lg:hidden">
    <header>
      <h1 className="page-header-title text-ink">{zh ? "今日实验台" : "Today at the bench"}</h1>
      <p className="mt-1 text-sm text-muted" data-i18n-ignore>{today.toLocaleDateString(zh ? "zh-CN" : "en-US", { month: "long", day: "numeric", weekday: "long" })}</p>
    </header>
    <nav aria-label={zh ? "实验台快捷入口" : "Bench shortcuts"} className="grid grid-cols-2 gap-3">
      {actions.map(({ href, label, icon: Icon }, index) => <Link key={href} href={href}
        className={`focus-ring flex min-h-20 items-center gap-3 rounded-[var(--ln-radius-panel)] border px-4 text-base font-semibold ${index === 0 ? "ln-key-action" : "border-hairline bg-surface text-moss hover:bg-warm"}`}>
        <Icon className="h-6 w-6 shrink-0" aria-hidden /><span>{label}</span>
      </Link>)}
    </nav>
    <section aria-labelledby="mobile-today-title">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="mobile-today-title" className="text-base font-semibold text-ink">{zh ? "今日实验" : "Today’s experiments"}</h2>
        <Link href={`/?month=${monthKey}&view=calendar`} className="focus-ring flex min-h-11 items-center px-2 text-sm text-moss">{zh ? "日历" : "Calendar"}</Link>
      </div>
      <div className="divide-y divide-hairline border-y border-hairline">
        {ordered.length ? ordered.map((experiment) => <Link key={experiment.id} href={`/experiments/${experiment.id}/run`}
          className="focus-ring flex min-h-20 items-center gap-3 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold leading-6 text-ink">{experiment.title}</span>
            <span className="mt-1 block text-sm text-muted" data-i18n-ignore>{experiment.runCode} · {experiment.date.toLocaleDateString(zh ? "zh-CN" : "en-US", { month: "numeric", day: "numeric" })}</span>
          </span>
          <span className="shrink-0 text-sm font-medium text-moss">{experiment.status === "running" ? (zh ? "继续实验" : "Continue") : (zh ? "开始实验" : "Start")}</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        </Link>) : <p className="py-5 text-sm leading-6 text-muted">{zh ? "今天没有待做或正在进行的实验。" : "No planned or running experiments for today."}</p>}
      </div>
    </section>
    <MobileBenchStatus />
  </section>;
}
