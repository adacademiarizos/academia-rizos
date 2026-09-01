"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const totalSeconds = Math.floor(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

interface VideoPlayerProps {
  src: string;
  poster?: string;
  onEnded?: () => void;
}

export function VideoPlayer({ src, poster, onEnded }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRateMenu, setShowRateMenu] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      void container.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  }, []);

  const seekBy = useCallback((deltaSeconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + deltaSeconds), video.duration || 0);
  }, []);

  const adjustVolume = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.min(1, Math.max(0, video.volume + delta));
    video.volume = next;
    video.muted = false;
    setVolume(next);
    setMuted(false);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => {
      setDuration(video.duration || 0);
      setIsLoading(false);
    };
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onVolumeChange = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("progress", onProgress);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
    };
  }, [src]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          seekBy(5);
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(-5);
          break;
        case "ArrowUp":
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          adjustVolume(-0.1);
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          toggleFullscreen();
          break;
        default:
          break;
      }
    },
    [togglePlay, seekBy, adjustVolume, toggleMute, toggleFullscreen]
  );

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const value = Number(e.target.value);
    video.currentTime = value;
    setCurrentTime(value);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const value = Number(e.target.value);
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  };

  const setRate = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowRateMenu(false);
  };

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    setControlsVisible(true);
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlaying) setControlsVisible(false);
    }, 2500);
  }, [isPlaying]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={scheduleHideControls}
      onMouseLeave={() => isPlaying && setControlsVisible(false)}
      className="relative w-full h-full bg-black outline-none select-none group"
    >
      <video
        key={src}
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full"
        style={{ background: "#000" }}
        onClick={togglePlay}
        onEnded={onEnded}
        onContextMenu={(e) => e.preventDefault()}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        playsInline
      >
        <p className="text-zinc-300">Tu navegador no soporta reproducción de video</p>
      </video>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-10 w-10 rounded-full border-2 border-ap-copper/30 border-t-ap-copper animate-spin" />
        </div>
      )}

      {!isPlaying && !isLoading && (
        <button
          onClick={togglePlay}
          aria-label="Reproducir"
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex items-center justify-center w-16 h-16 rounded-full bg-ap-copper/90 text-ap-ink text-2xl shadow-xl hover:bg-ap-copper transition">
            ▶
          </span>
        </button>
      )}

      {/* Controls bar */}
      <div
        className={`absolute inset-x-0 bottom-0 px-3 pb-2 pt-8 bg-gradient-to-t from-black/85 to-transparent transition-opacity duration-200 ${
          controlsVisible || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Seek bar */}
        <div className="relative h-1.5 w-full rounded-full bg-white/20 mb-2 group/seek">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/30"
            style={{ width: `${bufferedPercent}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-ap-copper"
            style={{ width: `${progressPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeekChange}
            aria-label="Progreso del video"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-ap-copper opacity-0 group-hover/seek:opacity-100 transition"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center gap-3 text-ap-ivory">
          <button onClick={togglePlay} aria-label={isPlaying ? "Pausar" : "Reproducir"} className="hover:text-ap-copper transition">
            {isPlaying ? "❚❚" : "▶"}
          </button>

          <div className="flex items-center gap-1.5 group/volume">
            <button onClick={toggleMute} aria-label={muted ? "Activar sonido" : "Silenciar"} className="hover:text-ap-copper transition">
              {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              aria-label="Volumen"
              className="w-0 group-hover/volume:w-16 focus:w-16 transition-all accent-ap-copper h-1"
            />
          </div>

          <span className="text-xs tabular-nums text-zinc-300 whitespace-nowrap">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          <div className="relative">
            <button
              onClick={() => setShowRateMenu((v) => !v)}
              aria-label="Velocidad de reproducción"
              className="text-xs font-medium px-2 py-1 rounded hover:bg-white/10 transition"
            >
              {playbackRate}x
            </button>
            {showRateMenu && (
              <div className="absolute bottom-full right-0 mb-2 rounded-lg bg-ap-ink border border-zinc-700 shadow-xl overflow-hidden">
                {PLAYBACK_RATES.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => setRate(rate)}
                    className={`block w-full text-left px-4 py-1.5 text-xs whitespace-nowrap hover:bg-white/10 transition ${
                      rate === playbackRate ? "text-ap-copper font-semibold" : "text-zinc-300"
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={toggleFullscreen} aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"} className="hover:text-ap-copper transition">
            {isFullscreen ? "⤢" : "⛶"}
          </button>
        </div>
      </div>
    </div>
  );
}
