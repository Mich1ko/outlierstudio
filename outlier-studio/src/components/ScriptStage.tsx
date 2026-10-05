import type { ReactNode } from 'react';
import { clock, parseScript } from '@/shared/script';

/**
 * The script as it will be spoken: one line per sentence, each with the time
 * it starts at 2.5 words per second. Renders partial text while streaming.
 */
export function ScriptStage({
  text,
  streaming = false,
  status,
  actions,
  empty,
}: {
  text: string;
  streaming?: boolean;
  status?: ReactNode;
  actions?: ReactNode;
  empty?: ReactNode;
}) {
  const script = parseScript(text);
  const lastSection = script.sections.at(-1);
  const hasLines = script.sections.some((s) => s.lines.length > 0);

  return (
    <div className="stage" aria-busy={streaming}>
      {status && (
        <div className="stage-status">
          {streaming && <span className="tally" aria-hidden="true" />}
          <span role="status">{status}</span>
        </div>
      )}
      {!hasLines && !streaming && empty}
      {script.sections.map((section, i) => (
        <section key={i} className="stage-section" data-key={section.key}>
          <h3>{section.label}</h3>
          {section.lines.map((line, j) => (
            <div key={j} className="line" data-live={streaming && section === lastSection && j === section.lines.length - 1}>
              <time>{clock(line.startSeconds)}</time>
              <p>
                <span>{line.text}</span>
              </p>
            </div>
          ))}
        </section>
      ))}
      {hasLines && !streaming && (
        <div className="stage-foot">
          <p>
            About {Math.round(script.seconds)} seconds spoken, {script.words} words. Times assume 2.5 words per second.
          </p>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
    </div>
  );
}
