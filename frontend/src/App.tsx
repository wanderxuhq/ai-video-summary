import { Component } from 'solid-js';
import VideoPlayer from './components/VideoPlayer';
import Subtitles from './components/Subtitles';
import Summary, { SummaryApi } from './components/Summary';
import { changeLanguage } from './store';

const App: Component = () => {
  let summaryApi: SummaryApi | undefined;

  const handleSummaryUpdate = (content: string) => {
    summaryApi?.renderSummary(content);
  };

  return (
    <div>
      <div>
        <button onClick={() => changeLanguage('en')}>English</button>
        <button onClick={() => changeLanguage('zh')}>中文</button>
      </div>
      <div style={{ display: 'grid', 'grid-template-columns': '2fr 1fr', gap: '20px', height: 'calc(100vh - 40px)' }}>
        <div style={{ display: 'grid', 'grid-template-rows': '2fr 1fr', gap: '20px' }}>
          <VideoPlayer />
          <Subtitles onSummaryUpdate={handleSummaryUpdate} />
        </div>
        <div style={{ position: 'relative' }}>
          <Summary ref={api => summaryApi = api} />
        </div>
      </div>
    </div>
  );
};

export default App;
