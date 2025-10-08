import { createSignal } from 'solid-js';
import i18n from './i18n';
import { TFunction } from 'i18next';

// 定义 Cue 结构
export interface Cue {
  startTime: number;
  endTime: number;
  text: string;
}

// 1. 为视频 URL 创建独立的 signal
const [videoUrl, setVideoUrl] = createSignal<string>('');

// 2. 为字幕 cues 创建独立的 signal
const [cues, setCues] = createSignal<Cue[]>([]);

// 3. 导出所有独立的 signals 和 setters
export { videoUrl, setVideoUrl, cues, setCues };

// 4. i18n state management
const [tSignal, setT] = createSignal<TFunction>(i18n.t);

i18n.on('languageChanged', (lng) => {
  setT(() => i18n.getFixedT(lng));
});

export const changeLanguage = (lng: string) => {
  i18n.changeLanguage(lng);
};

// Create a reactive t function
export const t = (key: string, options?: any): string => tSignal()(key, options) as string;
