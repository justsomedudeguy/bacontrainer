import { useEffect, useRef } from 'react';

function messageTone(message) {
  if (message.channel === 'analysis') {
    return 'border-sky-200 bg-mist';
  }

  if (message.channel === 'system') {
    return 'border-slate-200 bg-slate-100';
  }

  if (message.channel === 'chat') {
    return message.role === 'assistant'
      ? 'border-emerald-200 bg-emerald-50'
      : 'border-amber-200 bg-amber-50';
  }

  return 'border-orange-200 bg-orange-50';
}

function roleLabel(message) {
  if (message.channel === 'analysis') {
    return 'Explainer';
  }

  if (message.role === 'user') {
    return 'You';
  }

  if (message.channel === 'chat') {
    return 'Research Assistant';
  }

  if (message.channel === 'system') {
    return 'System';
  }

  return 'Scenario';
}

function renderInlineText(text, keyPrefix) {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g)
    .filter(Boolean)
    .map((segment, index) => {
      if (segment.startsWith('**') && segment.endsWith('**')) {
        return (
          <strong key={`${keyPrefix}-strong-${index}`} className="font-semibold text-ink">
            {segment.slice(2, -2)}
          </strong>
        );
      }

      if (segment.startsWith('*') && segment.endsWith('*')) {
        return (
          <em key={`${keyPrefix}-em-${index}`} className="italic">
            {segment.slice(1, -1)}
          </em>
        );
      }

      return <span key={`${keyPrefix}-text-${index}`}>{segment}</span>;
    });
}

const ANALYSIS_HEADINGS = new Map(
  [
    'Bottom Line',
    'Facts',
    'Analysis',
    'Final Conclusion',
    'Authorities',
    "Officer's position",
    "User's position",
    'How the cited cases apply',
    'Legal significance',
    'Practical considerations',
    'Risks / strengths',
    'Notes'
  ].map((heading) => [heading.toLowerCase(), heading])
);

function normalizeAnalysisHeading(value) {
  return ANALYSIS_HEADINGS.get(value.trim().toLowerCase()) || '';
}

function extractAnalysisSections(content) {
  const lines = content.split('\n');
  const sections = [];
  let currentSection = null;
  let paragraphBuffer = [];
  let listBuffer = [];

  function flushParagraph() {
    if (!currentSection || paragraphBuffer.length === 0) {
      return;
    }

    currentSection.blocks.push({
      type: 'paragraph',
      content: paragraphBuffer.join(' ')
    });
    paragraphBuffer = [];
  }

  function flushList() {
    if (!currentSection || listBuffer.length === 0) {
      return;
    }

    currentSection.blocks.push({
      type: 'list',
      items: listBuffer
    });
    listBuffer = [];
  }

  function startSection(heading) {
    flushParagraph();
    flushList();

    if (currentSection) {
      sections.push(currentSection);
    }

    currentSection = {
      heading,
      blocks: []
    };
  }

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    const headingMatch = trimmedLine.match(/^#{1,2}\s*(.+?)\s*:?\s*$/);
    const heading = headingMatch ? normalizeAnalysisHeading(headingMatch[1]) : '';

    if (heading) {
      startSection(heading);
      return;
    }

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      return;
    }

    const subheadingMatch =
      trimmedLine.match(/^#{3,6}\s*(.+?)\s*:?\s*$/) ||
      trimmedLine.match(/^(Authorities checked|Retrieved authorities):\s*$/i);

    if (subheadingMatch) {
      flushParagraph();
      flushList();

      if (!currentSection) {
        startSection('Notes');
      }

      currentSection.blocks.push({
        type: 'subheading',
        content: subheadingMatch[1]
      });
      return;
    }

    if (/^[-*]\s+/.test(trimmedLine)) {
      flushParagraph();

      if (!currentSection) {
        startSection('Notes');
      }

      listBuffer.push(trimmedLine.replace(/^[-*]\s+/, ''));
      return;
    }

    flushList();

    if (!currentSection) {
      startSection('Notes');
    }

    paragraphBuffer.push(trimmedLine);
  });

  flushParagraph();
  flushList();

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

function renderMarkedSnippet(text, keyPrefix) {
  if (!text) {
    return null;
  }

  const preservedMarks = text
    .replace(/<mark>/gi, '[[mark]]')
    .replace(/<\/mark>/gi, '[[/mark]]')
    .replace(/<[^>]+>/g, '');

  return preservedMarks
    .split(/(\[\[mark\]\].*?\[\[\/mark\]\])/g)
    .filter(Boolean)
    .map((segment, index) => {
      const isMarked =
        segment.startsWith('[[mark]]') && segment.endsWith('[[/mark]]');
      const content = isMarked
        ? segment.slice('[[mark]]'.length, -'[[/mark]]'.length)
        : segment;

      if (isMarked) {
        return (
          <mark key={`${keyPrefix}-mark-${index}`} className="rounded bg-amber-200/75 px-1 text-ink">
            {content}
          </mark>
        );
      }

      return <span key={`${keyPrefix}-text-${index}`}>{content}</span>;
    });
}

function renderAnalysisContent(content) {
  const sections = extractAnalysisSections(content);

  if (sections.length === 0) {
    return <p className="mt-3 whitespace-pre-line leading-7 text-ink">{content}</p>;
  }

  return (
    <div className="mt-3 space-y-4">
      {sections.map((section, sectionIndex) => (
        <section
          key={`${section.heading}-${sectionIndex}`}
          className={`rounded-2xl px-4 py-3 ${
            section.heading.toLowerCase() === 'how the cited cases apply'
              ? 'border border-sky-200 bg-sky-50/80'
              : 'bg-white/65'
          }`}
        >
          <h3
            className={`font-semibold uppercase text-sky-900 ${
              section.heading.toLowerCase() === 'how the cited cases apply'
                ? 'text-sm tracking-[0.18em]'
                : 'text-xs tracking-[0.22em]'
            }`}
          >
            {section.heading}
          </h3>
          <div className="mt-3 space-y-3 text-sm leading-7 text-ink">
            {section.blocks.map((block, blockIndex) => {
              if (block.type === 'subheading') {
                return (
                  <h4
                    key={`${section.heading}-subheading-${blockIndex}`}
                    className="pt-1 font-semibold text-sky-950"
                  >
                    {renderInlineText(
                      block.content,
                      `${section.heading}-subheading-${blockIndex}`
                    )}
                  </h4>
                );
              }

              if (block.type === 'list') {
                return (
                  <ul
                    key={`${section.heading}-list-${blockIndex}`}
                    className="list-disc space-y-2 pl-5"
                  >
                    {block.items.map((bullet, bulletIndex) => (
                      <li key={`${section.heading}-bullet-${blockIndex}-${bulletIndex}`}>
                        {renderInlineText(
                          bullet,
                          `${section.heading}-bullet-${blockIndex}-${bulletIndex}`
                        )}
                      </li>
                    ))}
                  </ul>
                );
              }

              return (
                <p key={`${section.heading}-paragraph-${blockIndex}`}>
                  {renderInlineText(
                    block.content,
                    `${section.heading}-paragraph-${blockIndex}`
                  )}
                </p>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function retrievalLabel(status) {
  if (status === 'grounded') {
    return 'Grounded in CourtListener';
  }

  if (status === 'no-results') {
    return 'No CourtListener results found';
  }

  if (status === 'rate-limited') {
    return 'CourtListener rate limited';
  }

  if (status === 'unauthorized') {
    return 'CourtListener authorization failed';
  }

  if (status === 'unavailable') {
    return 'CourtListener unavailable';
  }

  return 'Research metadata';
}

function verifiedSourceSummary(count) {
  if (count === 1) {
    return 'Verified 1 CourtListener source for this response.';
  }

  return `Verified ${count} CourtListener sources for this response.`;
}

function renderSourceCards(message) {
  const sources = Array.isArray(message.meta?.sources) ? message.meta.sources : [];
  const retrieval = message.meta?.retrieval;

  if (!retrieval && sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      {retrieval ? (
        <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-ink/80">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
            {retrievalLabel(retrieval.status)}
          </p>
          {sources.length > 0 ? <p className="mt-2">{verifiedSourceSummary(sources.length)}</p> : null}
          {retrieval.query ? (
            <p className="mt-2">
              Research focus: <span className="font-medium text-ink">{retrieval.query}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {sources.length > 0 ? (
        <div className="space-y-3">
          {sources.map((source) => (
            <article
              key={source.id}
              className="rounded-2xl border border-black/10 bg-white/70 px-4 py-4 text-sm text-ink/80"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-ink/55">
                    Source type {source.type}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-ink">{source.title}</h3>
                </div>
                <a
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-parchment"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.type === 'o' ? 'Read Full Case' : 'Open Source'}
                </a>
              </div>

              <div className="mt-3 space-y-2">
                {source.court || source.date || source.docketNumber ? (
                  <p>
                    {[source.court, source.date, source.docketNumber]
                      .filter(Boolean)
                      .join(' | ')}
                  </p>
                ) : null}
                {source.citations?.length ? (
                  <p>Citations: {source.citations.join('; ')}</p>
                ) : null}
                {source.snippet ? (
                  <p className="leading-7">
                    {renderMarkedSnippet(source.snippet, `${source.id}-snippet`)}
                  </p>
                ) : null}
                {source.downloadUrl ? (
                  <a
                    className="inline-block text-sm font-medium text-ember underline-offset-4 hover:underline"
                    href={source.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open download
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function renderMessageContent(message) {
  if (message.channel === 'analysis') {
    return (
      <>
        {renderAnalysisContent(message.content)}
        {renderSourceCards(message)}
      </>
    );
  }

  return (
    <>
      <p className="mt-3 whitespace-pre-line leading-7 text-ink">{message.content}</p>
      {message.channel === 'chat' && message.role === 'assistant'
        ? renderSourceCards(message)
        : null}
    </>
  );
}

export function TranscriptPanel({
  transcript,
  headingEyebrow = 'Transcript',
  title = 'Loading...',
  description = '',
  emptyState = 'The transcript will appear here after the session is initialized.'
}) {
  const bodyRef = useRef(null);

  useEffect(() => {
    const node = bodyRef.current;

    if (!node) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [transcript]);

  return (
    <section className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-[32px] border border-black/10 bg-white/80 shadow-card backdrop-blur">
      <div className="border-b border-black/10 px-6 py-5">
        <p className="text-xs uppercase tracking-[0.24em] text-brass">{headingEyebrow}</p>
        <h1 className="mt-2 font-display text-3xl text-ink">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/70">{description}</p>
      </div>

      <div ref={bodyRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {transcript.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/15 bg-parchment/60 p-6 text-sm text-ink/70">
            {emptyState}
          </div>
        ) : (
          transcript.map((message) => (
            <article
              key={message.id}
              className={`rounded-3xl border px-5 py-4 text-sm shadow-sm ${messageTone(message)}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.22em] text-ink/60">
                  {roleLabel(message)}
                </p>
                <p className="text-xs uppercase tracking-[0.18em] text-ink/50">
                  {message.channel}
                </p>
              </div>
              {renderMessageContent(message)}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
