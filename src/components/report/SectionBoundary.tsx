import { Component, type ReactNode } from "react";

import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = { heading: string; children: ReactNode };
type State = { error: Error | null };

/** Isolates one report section: a render throw here shows an editorial
 *  fallback in-place instead of taking down the whole report. */
export class SectionBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    reportLovableError(error, {
      source: "report_section_boundary",
      section: this.props.heading,
      componentStack: info.componentStack,
    });
    // eslint-disable-next-line no-console
    console.error(`[Veritas] section "${this.props.heading}" failed to render:`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="border border-ink/15 bg-accent-soft/40 px-6 py-8">
          <div className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
            Section unavailable
          </div>
          <p className="mt-3 max-w-[52ch] font-serif text-[17px] leading-[1.45] text-ink italic">
            This section could not be rendered from the data provided. The rest of the report is unaffected.
          </p>
          <div className="mt-3 text-[12px] text-ink-muted tabular">
            {this.state.error.message.slice(0, 200)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
