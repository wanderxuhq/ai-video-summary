import { createSignal } from 'solid-js';

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
