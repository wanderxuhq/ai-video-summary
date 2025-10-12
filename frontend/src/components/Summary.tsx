import { Component, Show, createSignal, createEffect } from 'solid-js';
import { marked } from 'marked';
import { t } from '../store';
import MindmapView from './MindmapView';
import MarkdownView from './MarkdownView';
import MarkdownSourceView from './MarkdownSourceView';

export interface SummaryApi {
  renderSummary: (markdown: string) => void;
}

interface SummaryProps {
  ref: (api: SummaryApi) => void;
}

const Summary: Component<SummaryProps> = (props) => {
  const [markdown, setMarkdown] = createSignal('');
  const [activeTab, setActiveTab] = createSignal('mindmap');
  const [htmlContent, setHtmlContent] = createSignal('');
  const [summaryVersion, setSummaryVersion] = createSignal(0);

  props.ref({
    renderSummary: (newMarkdown: string) => {
      setMarkdown(newMarkdown);
      setSummaryVersion(v => v + 1); // Increment version to force re-creation
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
            <MindmapView markdown={markdown()} isVisible={activeTab() === 'mindmap'} />
          </div>
          <div style={{ display: activeTab() === 'markdownView' ? 'block' : 'none' }}>
            <MarkdownView htmlContent={htmlContent()} />
          </div>
          <div style={{ display: activeTab() === 'markdownSource' ? 'block' : 'none' }}>
            <MarkdownSourceView markdown={markdown()} />
          </div>
        </Show>
      </div>
    </div>
  );
};

export default Summary;
