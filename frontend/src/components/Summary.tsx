import { Component, Show, onCleanup, createSignal, createEffect } from 'solid-js';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';

export interface SummaryApi {
  renderSummary: (markdown: string) => void;
}

interface SummaryProps {
  ref: (api: SummaryApi) => void;
}

const Summary: Component<SummaryProps> = (props) => {
  let svgRef: SVGSVGElement | undefined;
  let markmap: Markmap | undefined;
  const [markdown, setMarkdown] = createSignal('');

  // Expose the render function via ref
  props.ref({
    renderSummary: (newMarkdown: string) => {
      setMarkdown(newMarkdown);
    },
  });

  createEffect(() => {
    const currentMarkdown = markdown();
    // This effect runs after the DOM has been updated.
    // If markdown is not empty, the <Show> component will have rendered the svg,
    // so svgRef will be available.

    // Always clean up the previous instance
    markmap?.destroy();
    if (svgRef) {
      svgRef.innerHTML = '';
    }

    if (svgRef && currentMarkdown) {
      const transformer = new Transformer();
      const { root } = transformer.transform(currentMarkdown);

      if (root.content || root.children?.length) {
        markmap = Markmap.create(svgRef, { autoFit: true }, root);
      }
    }
  });

  onCleanup(() => {
    markmap?.destroy();
  });

  return (
    <div style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', display: 'flex', 'flex-direction': 'column' }}>
      <h3>Video Summary</h3>
      <Show
        when={markdown()}
        fallback={<p>Summary content will go here once a video is processed.</p>}
      >
        <svg ref={svgRef} style={{ width: '100%', 'flex-grow': 1 }} />
      </Show>
    </div>
  );
};

export default Summary;
