import { Component, Show, onCleanup, createSignal, createEffect } from 'solid-js';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { marked } from 'marked';
import { t } from '../store';

export interface SummaryApi {
  renderSummary: (markdown: string) => void;
  fit: () => void;
}

interface SummaryProps {
  ref: (api: SummaryApi) => void;
}

const Summary: Component<SummaryProps> = (props) => {
  let svgRef: SVGSVGElement | undefined;
  let markmap: Markmap | undefined;
  const [markdown, setMarkdown] = createSignal('');
  const [activeTab, setActiveTab] = createSignal('mindmap');
  const [htmlContent, setHtmlContent] = createSignal('');

  // Expose the render function via ref
  props.ref({
    renderSummary: (newMarkdown: string) => {
      setMarkdown(newMarkdown);
    },
    fit: () => {
      markmap?.fit();
    },
  });

  createEffect(() => {
    const currentMarkdown = markdown();
    if (currentMarkdown) {
      setHtmlContent(marked(currentMarkdown) as string);
    } else {
      setHtmlContent('');
    }
  });

  createEffect((prevMarkdown) => {
    const currentMarkdown = markdown();

    // Only run logic if markdown content has actually changed
    if (prevMarkdown === currentMarkdown) {
      return prevMarkdown;
    }

    // Create instance if it doesn't exist
    if (svgRef && !markmap) {
      // autoFit should be false to prevent re-fitting on tab switch.
      // Fitting is controlled manually by the parent component.
      markmap = Markmap.create(svgRef, { autoFit: false });
    }

    // Update data when markdown changes
    if (markmap && currentMarkdown) {
      const transformer = new Transformer();
      const { root } = transformer.transform(currentMarkdown);
      markmap.setData(root);
    } else if (markmap) {
      markmap.setData(); // Clear the markmap if markdown is empty
    }

    return currentMarkdown;
  }, '');

  onCleanup(() => {
    markmap?.destroy();
  });

  const tabStyle = (tabName: string) => ({
    padding: '8px 12px',
    cursor: 'pointer',
    'border-bottom': activeTab() === tabName ? '2px solid blue' : '2px solid transparent',
    'margin-bottom': '-1px',
  });

  return (
    <div style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', display: 'flex', 'flex-direction': 'column' }}>
      <h3>{t('summary.title')}</h3>
      <div style={{ display: 'flex', 'border-bottom': '1px solid #ccc' }}>
        <button style={tabStyle('mindmap')} onClick={() => setActiveTab('mindmap')}>{t('summary.tabs.mindmap')}</button>
        <button style={tabStyle('markdownView')} onClick={() => setActiveTab('markdownView')}>{t('summary.tabs.markdownView')}</button>
        <button style={tabStyle('markdownSource')} onClick={() => setActiveTab('markdownSource')}>{t('summary.tabs.markdownSource')}</button>
      </div>
      <div style={{ 'flex-grow': 1, overflow: 'auto', padding: '10px', position: 'relative' }}>
        <Show
          when={markdown()}
          fallback={<p>{t('summary.fallback')}</p>}
        >
          <div style={{ display: activeTab() === 'mindmap' ? 'block' : 'none', width: '100%', height: '100%' }}>
            <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{ display: activeTab() === 'markdownView' ? 'block' : 'none' }} innerHTML={htmlContent()} />
          <pre style={{ display: activeTab() === 'markdownSource' ? 'block' : 'none', 'white-space': 'pre-wrap', 'word-wrap': 'break-word' }}>
            {markdown()}
          </pre>
        </Show>
      </div>
    </div>
  );
};

export default Summary;
