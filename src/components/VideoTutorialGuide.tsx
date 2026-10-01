import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  CheckCircle, 
  Clock, 
  Users, 
  HeartHandshake 
} from 'lucide-react';
import { loadVideoData, DEFAULT_VIDEOS, VideoType } from '../utils/videoStorage';

interface VideoTutorialGuideProps {
  allowUpload?: boolean;
  type?: VideoType;
}

export const VideoTutorialGuide: React.FC<VideoTutorialGuideProps> = ({ 
  allowUpload = false,
  type = 'friends'
}) => {
  const videoType: VideoType = type === 'family' ? 'family' : 'friends';
  const isFriends = videoType === 'friends';
  const defaultSrc = DEFAULT_VIDEOS[videoType].src;
  const defaultName = DEFAULT_VIDEOS[videoType].name;

  const [videoSrc, setVideoSrc] = useState<string>(defaultSrc);
  const [videoTitle, setVideoTitle] = useState<string>(defaultName);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Load video from persistent storage (IndexedDB -> Custom URL -> Default static /video_*.mp4)
  const refreshVideo = useCallback(async () => {
    try {
      const data = await loadVideoData(videoType);
      setVideoSrc(data.src);
      setVideoTitle(data.name);
    } catch (err) {
      console.warn('Failed to load persistent video, using default', err);
      setVideoSrc(defaultSrc);
      setVideoTitle(defaultName);
    }
  }, [videoType, defaultSrc, defaultName]);

  useEffect(() => {
    refreshVideo();

    // Listen for admin updates across components
    const handleVideoUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: VideoType; src: string }>;
      if (!customEvent.detail || customEvent.detail.type === videoType) {
        refreshVideo();
      }
    };

    window.addEventListener('unigrant_video_updated', handleVideoUpdated);
    return () => {
      window.removeEventListener('unigrant_video_updated', handleVideoUpdated);
    };
  }, [videoType, refreshVideo]);

  // Sync state with video element events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (video.duration && !isNaN(video.duration)) {
        setDuration(video.duration);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoSrc]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      videoRef.current.requestFullscreen().catch(() => {});
    }
  };

  const handleSeek = (percent: number) => {
    if (!videoRef.current || !duration) return;
    const newTime = (percent / 100) * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleVideoError = () => {
    // If the active URL failed (e.g. invalid blob), fallback to static /public video
    if (videoSrc !== defaultSrc) {
      console.warn(`Video load failed for ${videoSrc}, falling back to ${defaultSrc}`);
      setVideoSrc(defaultSrc);
      setVideoTitle(defaultName);
    }
  };

  const friendsChapters = [
    { title: '1. Friends dasturi & 10% chegirma', timePercent: 0, label: '00:00' },
    { title: '2. JSHSHR 14 raqamini kiritish', timePercent: 25, label: '00:21' },
    { title: '3. Do‘st ma’lumotlari & Diplom yuklash', timePercent: 50, label: '00:42' },
    { title: '4. Arizani tasdiqqa yuborish', timePercent: 75, label: '01:03' },
  ];

  const familyChapters = [
    { title: '1. Family (Oila a’zolari) dasturi shartlari', timePercent: 0, label: '00:00' },
    { title: '2. 1- va 2-oila a’zosi JSHSHR ma’lumotlari', timePercent: 25, label: '00:29' },
    { title: '3. Qarindoshlik hujjati (Tug‘ilganlik / Nikoh)', timePercent: 50, label: '00:57' },
    { title: '4. Har ikkala talaba uchun 10% chegirma', timePercent: 75, label: '01:25' },
  ];

  const chapters = isFriends ? friendsChapters : familyChapters;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div id={`video-tutorial-guide-${type}`} className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-5 text-white shadow-xl border border-slate-700/60 mb-8">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              {isFriends ? (
                <Users className="w-4 h-4 text-blue-400" />
              ) : (
                <HeartHandshake className="w-4 h-4 text-emerald-400" />
              )}
              {isFriends 
                ? 'Friends (Do‘stlar) dasturi bo‘yicha rasmiy video qo‘llanma' 
                : 'Family (Oila a’zolari) dasturi bo‘yicha rasmiy video qo‘llanma'}
            </h2>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Fayl: {videoTitle} • {isFriends ? 'Friends 10% chegirma' : 'Family 10% chegirma'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30 font-mono">
            {formatTime(currentTime)} / {formatTime(duration || (isFriends ? 85 : 110))}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Real Video Player Box */}
        <div className="lg:col-span-8 flex flex-col">
          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800 shadow-2xl flex items-center justify-center group">
            {/* Native Video Element */}
            <video
              ref={videoRef}
              src={videoSrc}
              playsInline
              preload="metadata"
              onClick={togglePlay}
              onError={handleVideoError}
              className="w-full h-full object-contain cursor-pointer"
            >
              <source src={videoSrc} type="video/mp4" />
              Brauzeringiz video formatini qo‘llab-quvvatlamaydi.
            </video>

            {/* Play button overlay when paused */}
            {!isPlaying && (
              <div 
                onClick={togglePlay}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 hover:bg-black/30 transition cursor-pointer backdrop-blur-[1px]"
              >
                <div className={`w-16 h-16 rounded-2xl ${isFriends ? 'bg-blue-600/90 hover:bg-blue-600' : 'bg-emerald-600/90 hover:bg-emerald-600'} text-white flex items-center justify-center shadow-2xl transform hover:scale-105 transition`}>
                  <Play className="w-8 h-8 ml-1 fill-white" />
                </div>
                <p className="text-xs text-white/90 font-medium mt-3 bg-black/60 px-3 py-1 rounded-full">
                  {isFriends ? 'Friends video qo‘llanmasini ko‘rish' : 'Family video qo‘llanmasini ko‘rish'}
                </p>
              </div>
            )}

            {/* Player Controls Bar */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 flex flex-col gap-1.5 opacity-90 group-hover:opacity-100 transition">
              {/* Scrubber progress bar */}
              <div 
                className="w-full h-2 bg-white/20 hover:h-2.5 rounded-full overflow-hidden cursor-pointer transition-all"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const pct = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
                  handleSeek(pct);
                }}
              >
                <div 
                  className={`h-full ${isFriends ? 'bg-blue-500' : 'bg-emerald-500'} rounded-full transition-all duration-100`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Bottom buttons */}
              <div className="flex items-center justify-between text-xs text-slate-200 pt-1">
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={togglePlay}
                    className="hover:text-blue-400 transition cursor-pointer p-1"
                    title={isPlaying ? "To'xtatish" : "O'ynatish"}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>
                  <button 
                    type="button"
                    onClick={toggleMute}
                    className="hover:text-blue-400 transition cursor-pointer p-1"
                    title={isMuted ? "Ovozni yoqish" : "Ovozni o'chirish"}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <span className="text-[11px] font-mono text-slate-300">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.playbackRate = videoRef.current.playbackRate === 1 ? 1.5 : (videoRef.current.playbackRate === 1.5 ? 2 : 1);
                      }
                    }}
                    className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded font-mono cursor-pointer transition"
                    title="Tezlikni o‘zgartirish"
                  >
                    {videoRef.current?.playbackRate || 1}x
                  </button>
                  <button 
                    type="button"
                    onClick={toggleFullscreen}
                    className="hover:text-blue-400 transition cursor-pointer p-1"
                    title="To'liq ekranga olish"
                  >
                    <Maximize className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chapters & Essential rules right next to video */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Qo‘llanma bo‘limlari
            </h4>
            <div className="space-y-1.5">
              {chapters.map((chap, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    handleSeek(chap.timePercent);
                    if (videoRef.current && videoRef.current.paused) {
                      videoRef.current.play().catch(() => {});
                    }
                  }}
                  className="w-full text-left p-2.5 rounded-lg text-xs transition border flex items-center justify-between bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <span className="truncate">{chap.title}</span>
                  <span className={`text-[10px] ${isFriends ? 'text-blue-400' : 'text-emerald-400'} shrink-0 font-mono ml-2`}>{chap.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Key requirement badges */}
          <div className="bg-slate-800/70 rounded-xl p-3 border border-slate-700/60">
            <div className={`text-xs font-semibold ${isFriends ? 'text-blue-400' : 'text-emerald-400'} flex items-center gap-1.5 mb-2`}>
              <CheckCircle className="w-4 h-4 shrink-0" />
              {isFriends ? 'Friends talablari' : 'Family talablari'}
            </div>
            <ul className="text-[11px] text-slate-300 space-y-1 leading-relaxed">
              {isFriends ? (
                <>
                  <li>• JSHSHR pasport yoki ID kartadagi 14 ta raqamdan iborat bo‘lishi shart.</li>
                  <li>• Do‘stingizning shahodatnomasi yoki diplomi to‘liq va muhrli ko‘rinishi lozim.</li>
                  <li>• Har ikki talabaga 10% chegirmali shartnoma taqdim etiladi.</li>
                </>
              ) : (
                <>
                  <li>• Talabalar aka-uka, opa-singil yoki er-xotin bo‘lishlari lozim.</li>
                  <li>• Qarindoshlikni tasdiqlovchi hujjat (metrika yoki nikoh guvohnomasi) yuklanadi.</li>
                  <li>• Oila a’zolarining har ikkisiga 10% chegirma tasdiqlanadi.</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
