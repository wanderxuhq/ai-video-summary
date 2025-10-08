import { Component, Show, createSignal, createEffect, onCleanup, on } from 'solid-js';
import { videoUrl, cues, Cue, t } from '../store'; // 1. 导入独立的 signals
// @ts-ignore
import { WebVTT } from 'vtt.js';

interface VideoPlayerProps {
  // src: string; // 2. 不再从 props 接收
  // subtitleSrc: string; // 2. 不再从 props 接收
}


const VideoPlayer: Component<VideoPlayerProps> = () => { // 3. 移除 props
  let videoRef!: HTMLVideoElement;
  let subtitleContainerRef!: HTMLDivElement;
  let progressBarRef!: HTMLDivElement;
  let thumbVideoRef!: HTMLVideoElement; // Hidden video for thumbnails
  let canvasRef!: HTMLCanvasElement;   // Canvas for drawing thumbnails

  const [isPlaying, setIsPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [thumbnail, setThumbnail] = createSignal({
    visible: false,
    x: 0,
    y: 0,
    time: '00:00'
  });

  // Subtitle State
  const [showSubtitles, setShowSubtitles] = createSignal(true);
  // cues signal is now directly imported from the store
  const [activeCue, setActiveCue] = createSignal<Cue | null>(null);
  const [subtitlePosition, setSubtitlePosition] = createSignal<{x: number, y: number} | null>(null);
  const [isDragging, setIsDragging] = createSignal(false);
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });


  const progress = () => (duration() > 0 ? (currentTime() / duration()) * 100 : 0);
  const formattedCurrentTime = () => formatTime(currentTime());
  const formattedDuration = () => formatTime(duration());

  function formatTime(timeInSeconds: number) {
    if (isNaN(timeInSeconds) || timeInSeconds === Infinity) {
      return '00:00';
    }
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  const handleTimeUpdate = () => {
    const time = videoRef.currentTime;
    setCurrentTime(time);
    const currentCue = cues().find(cue => time >= cue.startTime && time <= cue.endTime);
    setActiveCue(currentCue || null);
  };
  const handleDurationChange = () => setDuration(videoRef.duration);
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  const handleProgressClick = (e: MouseEvent) => {
    if (isNaN(duration())) return;
    const rect = progressBarRef.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    videoRef.currentTime = duration() * percentage;
  };

  const togglePlay = () => {
    videoRef.paused ? videoRef.play() : videoRef.pause();
  };

  // --- Thumbnail Logic ---
  const handleProgressMouseMove = (e: MouseEvent) => {
    if (isNaN(duration()) || duration() === 0) return;
    const rect = progressBarRef.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = duration() * percentage;

    setThumbnail({
      visible: true,
      x: e.clientX,
      y: rect.top - 120, // Position above progress bar
      time: formatTime(time)
    });

    thumbVideoRef.currentTime = time;
  };

  const handleProgressMouseLeave = () => {
    setThumbnail(p => ({ ...p, visible: false }));
  };

  const handleThumbSeeked = () => {
    const ctx = canvasRef.getContext('2d');
    if (ctx) {
      ctx.drawImage(thumbVideoRef, 0, 0, canvasRef.width, canvasRef.height);
    }
  };

  // 只在 videoUrl 变化时才执行加载操作
  createEffect(on(videoUrl, (src) => {
    if (src && videoRef) {
      videoRef.load();
      thumbVideoRef.src = src; // Also load src for the thumbnail video
      // Reset subtitle state, cues will be updated from the store
      setActiveCue(null);
      setSubtitlePosition(null); // Reset position on new video
    }
  }));

  // --- Subtitle Drag Logic ---
  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    
    // If this is the first drag, capture the current position
    let currentPos = subtitlePosition();
    if (!currentPos && subtitleContainerRef) {
        const rect = subtitleContainerRef.getBoundingClientRect();
        const parentRect = subtitleContainerRef.parentElement!.getBoundingClientRect();
        currentPos = {
            x: rect.left - parentRect.left,
            y: rect.top - parentRect.top,
        };
        setSubtitlePosition(currentPos);
    }
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - (currentPos?.x ?? 0),
      y: e.clientY - (currentPos?.y ?? 0),
    });

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging()) return;
    setSubtitlePosition({
      x: e.clientX - dragStart().x,
      y: e.clientY - dragStart().y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  onCleanup(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
  });

  const parseHashTime = (hash: string): number | null => {
    if (!hash.startsWith('#')) return null;
    const timeStr = hash.substring(1);
    const parts = timeStr.split(':').map(Number);
    if (parts.some(isNaN)) return null;
  
    let seconds = 0;
    if (parts.length === 3) { // HH:MM:SS
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) { // MM:SS
      seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 1) { // SS
      seconds = parts[0];
    } else {
      return null;
    }
    return seconds;
  };

  createEffect(() => {
    const handleHashChange = () => {
      if (!videoRef) return;
      const hash = window.location.hash;
      const timeInSeconds = parseHashTime(hash);
      
      const seek = () => {
        if (timeInSeconds !== null && !isNaN(videoRef.duration)) {
          videoRef.currentTime = timeInSeconds;
        }
      };

      if (videoRef.readyState >= 1) { // HAVE_METADATA
        seek();
      } else {
        videoRef.addEventListener('loadedmetadata', seek, { once: true });
      }
    };

    handleHashChange(); // Initial check
    window.addEventListener('hashchange', handleHashChange);

    onCleanup(() => {
      window.removeEventListener('hashchange', handleHashChange);
      // The seek listener is {once: true}, so it cleans itself up.
    });
  });


  return (
    <div style={{ position: 'relative' }}>
      <h2>{t('videoPlayer.title')}</h2>
      <Show when={videoUrl()} fallback={<p>{t('videoPlayer.noVideo')}</p>}>
        <div style={{ position: 'relative' }}>
          <video
            ref={videoRef}
            src={videoUrl()}
            width="100%"
            onClick={togglePlay}
            on:timeupdate={handleTimeUpdate}
            on:durationchange={handleDurationChange}
            on:loadedmetadata={handleDurationChange}
            on:play={handlePlay}
            on:pause={handlePause}
          />
          <Show when={showSubtitles() && activeCue()}>
            <div
              ref={subtitleContainerRef}
              onMouseDown={handleMouseDown}
              style={subtitlePosition() ? 
                { // Style for when dragging or after dragging
                  position: 'absolute',
                  left: `${subtitlePosition()!.x}px`,
                  top: `${subtitlePosition()!.y}px`,
                  'background-color': 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  padding: '10px',
                  'border-radius': '5px',
                  cursor: 'move',
                  'user-select': 'none',
                  'text-align': 'center',
                  'white-space': 'nowrap',
                } : 
                { // Initial style for centering
                  position: 'absolute',
                  left: '50%',
                  bottom: '20px',
                  transform: 'translateX(-50%)',
                  'background-color': 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  padding: '10px',
                  'border-radius': '5px',
                  cursor: 'move',
                  'user-select': 'none',
                  'text-align': 'center',
                  'white-space': 'nowrap',
                }
              }
              innerHTML={activeCue()!.text}
            />
          </Show>
        </div>
        <video ref={thumbVideoRef} on:seeked={handleThumbSeeked} style={{ display: 'none' }} muted />
        
        <div
          ref={progressBarRef}
          onClick={handleProgressClick}
          on:mousemove={handleProgressMouseMove}
          on:mouseleave={handleProgressMouseLeave}
          style={{
            width: '100%',
            height: '10px',
            'background-color': '#555',
            cursor: 'pointer',
            position: 'relative',
            'margin-top': '10px',
          }}
        >
          <div style={{ width: `${progress()}%`, height: '100%', 'background-color': '#2196F3', 'pointer-events': 'none' }} />
        </div>
        
        <div>
          <button onClick={togglePlay}>{isPlaying() ? t('videoPlayer.pause') : t('videoPlayer.play')}</button>
          <Show when={cues().length > 0}>
            <button onClick={() => setShowSubtitles(!showSubtitles())}>
              {showSubtitles() ? t('videoPlayer.hideSubtitles') : t('videoPlayer.showSubtitles')}
            </button>
          </Show>
          <span>{formattedCurrentTime()} / {formattedDuration()}</span>
        </div>

        <Show when={thumbnail().visible}>
          <div style={{
              position: 'fixed',
              top: `${thumbnail().y}px`,
              left: `${thumbnail().x}px`,
              transform: 'translateX(-50%)',
              'pointer-events': 'none',
              'background-color': 'black',
              color: 'white',
              padding: '5px',
              'border-radius': '3px'
          }}>
              <canvas ref={canvasRef} width="160" height="90" style={{ border: '1px solid #ccc' }} />
              <div style={{"text-align": "center"}}>{thumbnail().time}</div>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default VideoPlayer;
