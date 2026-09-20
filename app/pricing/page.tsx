import Link from "next/link";
import { Button } from "@/components/Button";
import { PlanCards } from "@/components/billing/PlanCards";
import { FREE_POSTS, PERIOD_DAYS, planCatalog } from "@/lib/plans";

export const metadata = { title: "Pricing — CertiTask" };

/** Public pricing page. Talent never pays; clients get free posts then a prepaid plan. */
export default function PricingPage() {
  const plans = planCatalog();
  return (
    <div className="flex flex-col min-h-screen">
      <section className="bg-gradient-to-b from-navy-dark to-navy text-paper py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#C9A227_1px,transparent_1px),linear-gradient(to_bottom,#C9A227_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider bg-gold/15 text-gold border border-gold/30">Pricing</span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Free for talent. <span className="text-gold">Simple for clients.</span></h1>
          <p className="text-paper/85 text-lg max-w-2xl mx-auto leading-relaxed">
            Doing the work and earning certificates never costs anything. Clients get their first {FREE_POSTS} projects free after verification, then pick a prepaid {PERIOD_DAYS}-day plan — no auto-charges, renew when you want.
          </p>
        </div>
      </section>

      <section className="py-16 bg-paper text-ink flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="bg-white border border-navy/5 rounded-2xl p-6 sm:p-8 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div><div className="text-3xl font-extrabold text-navy">$0</div><div className="text-sm font-semibold text-navy mt-1">Talent</div><div className="text-xs text-ink/70 mt-1">Apply, build, submit, earn certificates. Always free.</div></div>
              <div><div className="text-3xl font-extrabold text-navy">{FREE_POSTS} free</div><div className="text-sm font-semibold text-navy mt-1">Client trial</div><div className="text-xs text-ink/70 mt-1">Your first {FREE_POSTS} published projects are on us, once your account is verified.</div></div>
              <div><div className="text-3xl font-extrabold text-navy">{PERIOD_DAYS} days</div><div className="text-sm font-semibold text-navy mt-1">Prepaid periods</div><div className="text-xs text-ink/70 mt-1">Pay for a period, use it, renew when it ends. Live projects never go down.</div></div>
            </div>
          </div>

          <div style={{ paddingTop: 12 }}>
            <PlanCards plans={plans} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-ink/80">
            <div className="bg-white border border-navy/5 rounded-xl p-6">
              <h3 className="font-bold text-navy mb-2">How payment works</h3>
              <p>Checkout is hosted by <strong>Safepay</strong> (cards, Google Pay, and Pakistani wallets). Prices are in USD; Safepay settles the PKR equivalent on your statement. We never see or store card details.</p>
            </div>
            <div className="bg-white border border-navy/5 rounded-xl p-6">
              <h3 className="font-bold text-navy mb-2">Upgrades, renewals, refunds</h3>
              <p>Upgrade any time — a new {PERIOD_DAYS}-day period starts immediately. Renew from your Billing tab; we remind you 5 days and 1 day before a period ends. Refund requests go through support.</p>
            </div>
          </div>

          <div className="text-center space-y-4 pt-4">
            <p className="text-ink/70">Ready to post your first project?</p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Button href="/auth/signup" variant="gold">Create a client account</Button>
              <Link href="/projects" className="inline-flex items-center px-5 py-2.5 rounded-lg border border-navy/15 text-navy font-bold text-sm hover:bg-navy hover:text-paper transition-colors">Browse projects</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
