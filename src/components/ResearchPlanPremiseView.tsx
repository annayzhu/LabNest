const premiseFields = [
  ["Objective", "objective"],
  ["Hypothesis", "hypothesis"],
  ["Rationale", "rationale"],
] as const;

export function ResearchPlanPremiseView({
  objective,
  hypothesis,
  rationale,
}: {
  objective?: string | null;
  hypothesis?: string | null;
  rationale?: string | null;
}) {
  const values = { objective, hypothesis, rationale };

  return (
    <section className="document-section research-plan-premise">
      <header className="mb-5">
        <h2 className="document-section-title font-serif font-medium text-ink">Scientific premise</h2>
      </header>
      <div className="space-y-5">
        {premiseFields.map(([label, key]) => (
          <div key={key}>
            <h3 className="document-premise-label">{label}</h3>
            <p className={`document-copy mt-1 whitespace-pre-wrap ${values[key]?.trim() ? "text-graphite" : "italic text-muted"}`}>
              {values[key]?.trim() || "Not recorded."}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
