import { Component, createSignal, onCleanup, createEffect } from 'solid-js';
import { io, Socket } from 'socket.io-client';
import { setVideoUrl, setCues, Cue, t } from '../store';
// @ts-ignore
import { WebVTT } from 'vtt.js';

interface SubtitlesProps {
  // onFileSelect: (videoUrl: string, subtitleUrl: string) => void; // 2. 移除 prop
  onSummaryUpdate: (content: string) => void;
}

interface Segment {
  start: string;
  end: string;
  text: string;
}

// VTT 格式化工具函数
const formatSegmentsToVTT = (segments: Segment[]): string => {
  let vtt = 'WEBVTT\n\n';
  vtt += segments
    .map(seg => `${seg.start} --> ${seg.end}\n${seg.text}`)
    .join('\n\n');
  return vtt;
};

// VTT 解析函数
const parseVTT = (vttText: string): Promise<Cue[]> => {
  return new Promise((resolve) => {
    const parser = new WebVTT.Parser(window, WebVTT.StringDecoder());
    const cues: Cue[] = [];
    parser.oncue = (cue: any) => {
      cues.push(cue);
    };
    parser.onflush = () => {
      resolve(cues);
    };
    parser.parse(vttText);
    parser.flush();
  });
};

const Subtitles: Component<SubtitlesProps> = (props) => {
  const [segments, setSegments] = createSignal<Segment[]>([]);
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [message, setMessage] = createSignal('');
  let socket: Socket | null = null;
  let debounceTimer: number = 0; // 1. 初始化 debounceTimer

  // 当字幕片段数组更新时，解析 cues 并更新全局 store
  createEffect(() => {
    const currentSegments = segments();
    
    clearTimeout(debounceTimer);

    debounceTimer = window.setTimeout(async () => {
      if (currentSegments.length > 0) {
        const vttContent = formatSegmentsToVTT(currentSegments);
        const parsedCues = await parseVTT(vttContent);
        setCues(parsedCues);
      } else {
        setCues([]);
      }
    }, 300); // 300ms 延迟
  });

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      socket = null;
      console.log('Disconnected from WebSocket server');
    }
  };

  const connectAndListen = (fileToUpload?: File) => {
    disconnectSocket(); // 确保旧连接已断开
    socket = io('http://127.0.0.1:5000');

    socket.on('connect', () => {
      console.log('Connected to WebSocket server.');
      
      // 只有在需要上传文件时（即字幕不存在的情况下）才执行上传
      if (fileToUpload) {
        const formData = new FormData();
        formData.append('file', fileToUpload);

        setMessage(t('subtitles.messages.uploading'));
        fetch('http://127.0.0.1:5000/upload', {
          method: 'POST',
          body: formData,
        })
        .then(response => response.json())
        .then(uploadData => {
          if (uploadData.message) {
            setMessage(uploadData.message); // Assuming server sends back a translated message key or plain text
          } else {
            setMessage(t('subtitles.messages.uploadFailed', { error: uploadData.error || t('subtitles.messages.unknownError') }));
            disconnectSocket();
          }
        })
        .catch(uploadError => {
          setMessage(t('subtitles.messages.uploadError', { error: uploadError }));
          disconnectSocket();
        });
      }
    });

    socket.on('new_subtitle_chunk', (data: any) => {
      // 使用原始文件名进行精确匹配
      if (data.original_filename !== selectedFile()?.name) return;

      const newSegments: Segment[] = data.segments;

      setSegments(prevSegments => {
        // 使用 Map 来合并和去重，新的片段会覆盖基于开始时间的旧片段
        const segmentMap = new Map<string, Segment>();

        // 1. 先添加旧的片段
        for (const seg of prevSegments) {
          segmentMap.set(seg.start, seg);
        }

        // 2. 再添加新的片段，实现覆盖
        for (const seg of newSegments) {
          segmentMap.set(seg.start, seg);
        }

        // 3. 从 Map 中提取所有片段并排序
        const combinedSegments = Array.from(segmentMap.values());
        combinedSegments.sort((a, b) => a.start.localeCompare(b.start));
        
        return combinedSegments;
      });
    });

    socket.on('transcription_complete', async (data: any) => {
      // 使用原始文件名进行精确匹配
      if (data.original_filename !== selectedFile()?.name) return;

      // 触发最后一次字幕更新，确保是最终版本
      // createEffect 会处理 segments() 的变化，所以这里不需要手动调用 props.onFileSelect
      clearTimeout(debounceTimer); // 立即执行最后一次更新，确保最终字幕被渲染


      setMessage(t('subtitles.messages.subtitlesLoadedRequestingSummary'));
      disconnectSocket(); // 任务完成，断开连接

      // 自动请求摘要
      try {
        const summaryResponse = await fetch('http://127.0.0.1:5000/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: selectedFile()?.name }),
        });
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          props.onSummaryUpdate(summaryData.summary);
          setMessage(t('subtitles.messages.subtitlesAndSummaryLoaded'));
        } else {
          const errorData = await summaryResponse.json();
          setMessage(t('subtitles.messages.summaryFailed', { error: errorData.error || t('subtitles.messages.unknownError') }));
          props.onSummaryUpdate('');
        }
      } catch (summaryError) {
        setMessage(t('subtitles.messages.summaryError', { error: summaryError }));
        props.onSummaryUpdate('');
      }
    });

    socket.on('transcription_error', (data: any) => {
      // 使用原始文件名进行精确匹配
      if (data.original_filename !== selectedFile()?.name) return;
      setMessage(t('subtitles.messages.processingError', { message: data.message }));
      disconnectSocket();
    });
  };

  onCleanup(disconnectSocket);

  const handleFileChange = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (!target.files || !target.files[0]) return;

    // --- 1. 彻底重置所有状态 ---
    setVideoUrl('');
    setCues([]);
    disconnectSocket();
    setSegments([]); // 重置为控数组
    props.onSummaryUpdate('');
    setSelectedFile(null); // 清除旧文件引用

    const file = target.files[0];
    
    // --- 2. 设置新文件状态 ---
    setSelectedFile(file);
    // 5. 通过 store 加载新视频
    setVideoUrl(URL.createObjectURL(file));

    // --- 3. Pre-upload 检查 ---
    try {
      setMessage(t('subtitles.messages.checkingSubtitles'));
      const preUploadResponse = await fetch('http://127.0.0.1:5000/pre-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name }),
      });

      if (preUploadResponse.status === 200) {
        const data = await preUploadResponse.json();
        setMessage(t('subtitles.messages.subtitlesLoadedRequestingSummary'));
        
        const vttContent = data.subtitles;
        const parsedCues = await parseVTT(vttContent);
        setCues(parsedCues);

        // 从解析出的 cues 重新生成 segments，以确保数据一致性
        const regeneratedSegments = parsedCues.map(cue => {
          const formatTime = (time: number) => {
            const hours = Math.floor(time / 3600).toString().padStart(2, '0');
            const minutes = Math.floor((time % 3600) / 60).toString().padStart(2, '0');
            const seconds = Math.floor(time % 60).toString().padStart(2, '0');
            const milliseconds = Math.round((time - Math.floor(time)) * 1000).toString().padStart(3, '0');
            return `${hours}:${minutes}:${seconds}.${milliseconds}`;
          };
          return {
            start: formatTime(cue.startTime),
            end: formatTime(cue.endTime),
            text: cue.text,
          };
        });
        setSegments(regeneratedSegments);

        // 自动请求摘要
        try {
          const summaryResponse = await fetch('http://127.0.0.1:5000/summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name }),
          });
          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            props.onSummaryUpdate(summaryData.summary);
            setMessage(t('subtitles.messages.subtitlesAndSummaryLoaded'));
          } else {
            const errorData = await summaryResponse.json();
            setMessage(t('subtitles.messages.summaryFailed', { error: errorData.error || t('subtitles.messages.unknownError') }));
          }
        } catch (summaryError) {
          setMessage(t('subtitles.messages.summaryError', { error: summaryError }));
        }
        return; // 任务完成，停止执行
      }
      
      if (preUploadResponse.status === 204) {
        // --- 2. 如果字幕不存在，则连接 socket 并触发上传 ---
        setMessage(t('subtitles.messages.noSubtitlesFound'));
        connectAndListen(file); // 传入文件，在连接成功后上传
      } else {
        const errorData = await preUploadResponse.json();
        setMessage(t('subtitles.messages.checkFailed', { error: errorData.error || t('subtitles.messages.unknownError') }));
      }

    } catch (error) {
      setMessage(t('subtitles.messages.requestError', { error: error }));
      disconnectSocket();
    }
  };

  // handleUpload 函数现在不再需要，因为逻辑已合并到 handleFileChange 中
  // const handleUpload = async () => { ... };

  return (
    <div>
      <h3>{t('subtitles.title')}</h3>
      {/* <textarea
        value={formatSegmentsToVTT(segments())}
        onInput={(e) => {
          // 如果需要支持手动编辑，这里需要一个反向解析器
          // 为简单起见，暂时禁用或简化
        }}
        rows="10"
        style={{ width: '100%' }}
        readOnly // 推荐设为只读，因为整合逻辑在后台处理
      /> */}
      <div>
        <label for="video-upload">{t('subtitles.uploadLabel')}</label>
        <input type="file" id="video-upload" name="video-upload" onChange={handleFileChange} />
        {/* 移除了上传按钮 */}
        {message() && <p>{message()}</p>}
      </div>
    </div>
  );
};

export default Subtitles;
