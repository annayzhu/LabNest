export type DocumentPageHeaderFact = {
  label: string;
  value?: string | null;
  mono?: boolean;
};

export function DocumentPageHeader({
  documentType,
  identifier,
  title,
  titlePlaceholder = "Untitled document",
  subtitle,
  facts = [],
}: {
  documentType?: string;
  identifier?: string | null;
  title?: string | null;
  titlePlaceholder?: string;
  subtitle?: string | null;
  facts?: DocumentPageHeaderFact[];
}) {
  const visibleFacts = facts.filter((fact) => fact.value?.trim());
  const kicker = [documentType, identifier].filter(Boolean).join(" · ");

  return (
    <header className="document-page-header">
      {kicker ? <p className="document-page-kicker">{kicker}</p> : null}
      <h1 className={`document-page-title font-serif font-bold leading-tight ${title?.trim() ? "text-ink" : "text-muted"}`}>
        {title?.trim() || titlePlaceholder}
      </h1>
      {subtitle?.trim() ? <p className="document-page-subtitle">{subtitle}</p> : null}
      {visibleFacts.length ? (
        <dl className="document-page-facts">
          {visibleFacts.map((fact) => (
            <div key={`${fact.label}-${fact.value}`} className="min-w-0">
              <dt>{fact.label}</dt>
              <dd className={fact.mono ? "font-mono" : undefined}>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}
