'use client'

import { useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import { motion, useSpring, useMotionValue, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { playHoverSound, playClickSound } from '@/lib/sound'

export interface ScrollSection {
  id: string
  title: ReactNode
  level?: number
}

export interface ScrollIndicatorProps {
  sections: ScrollSection[]
  activeIndex?: number
  onIndexChange?: (index: number) => void
  scrollRef?: React.RefObject<HTMLElement | null>
  className?: string
}

export function ScrollIndicator({
  sections,
  activeIndex: controlledIndex,
  onIndexChange,
  scrollRef: externalScrollRef,
  className,
}: ScrollIndicatorProps) {
  const [internalIndex, setInternalIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [trackHeight, setTrackHeight] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  const activeIndex = controlledIndex ?? internalIndex

  const progressY = useMotionValue(0)
  const smoothY = useSpring(progressY, {
    stiffness: reduceMotion ? 1000 : 300,
    damping: reduceMotion ? 100 : 30,
  })

  const filteredSections = sections.filter((s) => s.level === undefined || s.level === 2 || s.level === 3)
  const totalTicks = 60

  const updateHeight = useCallback(() => {
    if (trackRef.current) {
      setTrackHeight(trackRef.current.clientHeight)
    }
  }, [])

  useEffect(() => {
    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [updateHeight])

  // Update marker position on track
  useEffect(() => {
    if (trackHeight <= 0 || filteredSections.length === 0) return
    const targetY = (activeIndex / Math.max(filteredSections.length - 1, 1)) * trackHeight
    progressY.set(targetY)
  }, [activeIndex, trackHeight, filteredSections.length, progressY])

  // Auto-detect active section on scroll if not controlled
  useEffect(() => {
    if (controlledIndex !== undefined) return

    const container = externalScrollRef?.current || (typeof window !== 'undefined' ? window : null)
    if (!container) return

    const handleScroll = () => {
      const targetEls = filteredSections.map((_, i) => {
        const root = externalScrollRef?.current || document
        return root.querySelector(`[data-section-index="${i}"]`) as HTMLElement | null
      })

      const containerTop = externalScrollRef?.current
        ? externalScrollRef.current.getBoundingClientRect().top
        : 0

      let bestIdx = 0
      let minDistance = Infinity

      targetEls.forEach((el, i) => {
        if (!el) return
        const rect = el.getBoundingClientRect()
        const distance = Math.abs(rect.top - containerTop - 120)
        if (distance < minDistance) {
          minDistance = distance
          bestIdx = i
        }
      })

      setInternalIndex(bestIdx)
    }

    const scrollTarget = externalScrollRef?.current || window
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollTarget.removeEventListener('scroll', handleScroll)
  }, [controlledIndex, externalScrollRef, filteredSections])

  const handleClick = (index: number) => {
    playClickSound()
    if (onIndexChange) {
      onIndexChange(index)
    } else {
      setInternalIndex(index)
    }

    const container = externalScrollRef?.current
    const sectionEl = (container || document).querySelector(`[data-section-index="${index}"]`) as HTMLElement | null
    if (sectionEl) {
      if (container) {
        const top = sectionEl.offsetTop - container.offsetTop - 16
        container.scrollTo({ top, behavior: 'smooth' })
      } else {
        sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  return (
    <div className={cn('h-full select-none', className)}>
      <div
        ref={trackRef}
        className="h-full relative min-h-[180px]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="absolute inset-0">
          {/* Tick Marks along the Track */}
          {Array.from({ length: totalTicks }).map((_, i) => {
            const y = (i / (totalTicks - 1)) * trackHeight
            const isMajor = i % 5 === 0
            const isPast =
              i / (totalTicks - 1) <= activeIndex / Math.max(filteredSections.length - 1, 1)

            return (
              <div
                key={i}
                className="absolute right-0 flex items-center justify-end"
                style={{ top: `${y}px` }}
              >
                <div
                  className={cn(
                    'h-px transition-colors duration-150',
                    isMajor ? 'w-3.5' : 'w-2',
                    isPast
                      ? 'bg-slate-900 dark:bg-white'
                      : isMajor
                        ? 'bg-slate-400/60 dark:bg-slate-500/60'
                        : 'bg-slate-300/40 dark:bg-slate-700/40',
                  )}
                />
              </div>
            )
          })}

          {/* Section Markers & Interactive Labels */}
          {filteredSections.map((section, i) => {
            const y = (i / Math.max(filteredSections.length - 1, 1)) * trackHeight
            const isActive = i === activeIndex

            return (
              <div key={section.id}>
                {/* Major section tick */}
                <div
                  className={cn(
                    'absolute right-0 h-0.5 transition-colors duration-200',
                    section.level === 2 || section.level === undefined ? 'w-5' : 'w-3.5',
                    isActive ? 'bg-[#007DA5] dark:bg-[#01B6D1]' : 'bg-slate-700 dark:bg-slate-400',
                  )}
                  style={{ top: `${y}px` }}
                />

                {/* Floating section label visible on hover */}
                <div
                  className={cn(
                    'absolute flex items-center right-6',
                    reduceMotion
                      ? ''
                      : 'transition-[opacity,transform] duration-200',
                    isHovered ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-2 pointer-events-none',
                  )}
                  style={{
                    top: `${y - 10}px`,
                    transitionDelay: isHovered ? `${i * 30}ms` : '0ms',
                  }}
                >
                  <button
                    type="button"
                    onMouseEnter={() => playHoverSound()}
                    onClick={() => handleClick(i)}
                    className={cn(
                      'font-mono text-[11px] font-bold uppercase tracking-wider cursor-pointer bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 px-2 py-0.5 whitespace-nowrap rounded-md shadow-xs',
                      'transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#007DA5] dark:focus-visible:ring-[#01B6D1]',
                      isActive
                        ? 'text-[#007DA5] dark:text-[#01B6D1] border-[#007DA5] dark:border-[#01B6D1] font-black'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white',
                    )}
                  >
                    {section.title}
                  </button>
                </div>
              </div>
            )
          })}

          {/* Smooth moving active cursor */}
          <motion.div className="absolute right-0 z-20" style={{ top: smoothY }}>
            <div className="h-0.5 w-6 bg-[#007DA5] dark:bg-[#01B6D1] shadow-xs" />
            <div
              className={cn(
                'absolute top-0 right-7 -translate-y-1/2 transition-opacity duration-200',
                isHovered ? 'opacity-0' : 'opacity-100',
              )}
            >
              <span className="font-mono text-[10px] font-black bg-[#007DA5] dark:bg-[#01B6D1] text-white px-1.5 py-0.5 rounded shadow-xs tabular-nums">
                {filteredSections.length > 0
                  ? `${activeIndex + 1}/${filteredSections.length}`
                  : '0/0'}
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
