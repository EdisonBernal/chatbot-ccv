'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AudioPlayerProps {
  src: string
  isStaff?: boolean
  onPlayed?: () => void
}

export function AudioPlayer({ src, isStaff = false, onPlayed }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const playedRef = useRef(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [waveformBars] = useState(() =>
    Array.from({ length: 28 }, () => Math.random() * 0.7 + 0.3)
  )

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }

    const handleDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play().catch(() => {})
      setIsPlaying(true)
      if (!playedRef.current && onPlayed) {
        playedRef.current = true
        onPlayed()
      }
    }
  }, [isPlaying, onPlayed])

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = x / rect.width
    audio.currentTime = pct * duration
    setCurrentTime(pct * duration)
  }

  const formatTime = (t: number) => {
    if (!t || !isFinite(t)) return '0:00'
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? currentTime / duration : 0

  return (
    <div className="flex items-center gap-2 min-w-50 max-w-70">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors',
          isStaff
            ? 'bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground'
            : 'bg-foreground/10 hover:bg-foreground/20 text-foreground'
        )}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="flex items-end gap-0.5 h-6 cursor-pointer"
          onClick={handleBarClick}
        >
          {waveformBars.map((h, i) => {
            const barProgress = i / waveformBars.length
            const isActive = barProgress <= progress
            return (
              <div
                key={i}
                className={cn(
                  'w-0.75 rounded-full transition-colors',
                  isActive
                    ? isStaff ? 'bg-primary-foreground' : 'bg-green-600'
                    : isStaff ? 'bg-primary-foreground/30' : 'bg-foreground/20'
                )}
                style={{ height: `${h * 100}%` }}
              />
            )
          })}
        </div>
        <span className={cn(
          'text-[10px] leading-none',
          isStaff ? 'text-primary-foreground/70' : 'text-muted-foreground'
        )}>
          {isPlaying || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}
        </span>
      </div>
    </div>
  )
}
