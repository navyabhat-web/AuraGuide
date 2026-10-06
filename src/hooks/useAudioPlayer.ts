import { useState, useRef, useEffect } from 'react';

export const useAudioPlayer = (onEndedCallback?: () => void) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const callbackRef = useRef(onEndedCallback);
  useEffect(() => {
    callbackRef.current = onEndedCallback;
  }, [onEndedCallback]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
          }).catch(error => {
            console.error("Playback prevented:", error);
            setIsPlaying(false);
          });
        } else {
          setIsPlaying(true);
        }
      }
    }
  };

  const playAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause(); // Pause any current audio
      audioRef.current.src = url;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
        }).catch(error => {
          console.error("Playback prevented:", error);
          setIsPlaying(false);
        });
      } else {
        setIsPlaying(true);
      }
    }
  };

  const setMediaSession = (title: string) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: 'GeoNarrate AI',
        album: 'Audio Tour',
        artwork: [
          { src: '/favicon.ico', sizes: '96x96', type: 'image/x-icon' },
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        if (audioRef.current) audioRef.current.play();
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (audioRef.current) audioRef.current.pause();
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
      });
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const updateProgress = () => {
        setProgress((audio.currentTime / audio.duration) * 100);
      };
      const onEnded = () => {
        setIsPlaying(false);
        if (callbackRef.current) callbackRef.current();
      };

      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('ended', onEnded);
      return () => {
        audio.removeEventListener('timeupdate', updateProgress);
        audio.removeEventListener('ended', onEnded);
      };
    }
  }, []);

  return { audioRef, isPlaying, progress, togglePlay, playAudio, setMediaSession };
};
