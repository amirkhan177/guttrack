"use client"

import { useState, useEffect, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const FLARE_LEVELS = ['None', 'Low', 'Moderate', 'High', 'Critical'] as const
type FlareLevel = typeof FLARE_LEVELS[number]

const FLARE_COLORS: Record<FlareLevel, string> = {
  None: '#7EB8A4',
  Low: '#7EB8A4',
  Moderate: '#FF8C42',
  High: '#FF6B6B',
  Critical: '#8B0000',
}

const FEELING_OPTIONS = [
  { emoji: '😊', label: 'Great', value: 'great' },
  { emoji: '🙂', label: 'Good', value: 'good' },
  { emoji: '😐', label: 'Okay', value: 'okay' },
  { emoji: '😣', label: 'Bad', value: 'bad' },
  { emoji: '🤢', label: 'Awful', value: 'awful' },
]

const SYMPTOM_OPTIONS = [
  { label: 'Burning', emoji: '🔥', value: 'burning' },
  { label: 'Pain', emoji: '⚡', value: 'pain' },
  { label: 'Sore Left', emoji: '◀', value: 'sore_left' },
  { label: 'Sore Right', emoji: '▶', value: 'sore_right' },
  { label: 'Front', emoji: '↑', value: 'front' },
  { label: 'Back', emoji: '↓', value: 'back' },
]

const monoFont = '"SF Mono", "Fira Mono", "Consolas", monospace'
const serifFont = 'Georgia, serif'

export default function FeedbackModal({ isOpen, onClose }: Props) {
  const [feelingScore, setFeelingScore] = useState('')
  const [activeSymptoms, setActiveSymptoms] = useState<string[]>([])
  const [flareLevel, setFlareLevel] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [accuracyScore, setAccuracyScore] = useState<number | null>(null)

  const [todayStr, setTodayStr] = useState('')
  const [prediction, setPrediction] = useState<Record<string, unknown> | null>(null)

  const touchStartY = useRef<number | null>(null)

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Load data on open
  useEffect(() => {
    if (!isOpen) return

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' })
    const yesterdayDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Denver' }))
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterday = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'America/Denver' })

    setTodayStr(today)

    const supabase = createSupabaseBrowserClient()

    Promise.all([
      supabase
        .from('daily_insights')
        .select('*')
        .eq('date', yesterday)
        .eq('window_type', 'daily')
        .maybeSingle(),
      supabase
        .from('daily_feedback')
        .select('*')
        .eq('date', today)
        .maybeSingle(),
    ]).then(([insightRes, feedbackRes]) => {
      if (insightRes.data?.prediction) {
        setPrediction(insightRes.data.prediction as Record<string, unknown>)
      } else {
        setPrediction(null)
      }

      if (feedbackRes.data) {
        const fb = feedbackRes.data as {
          feeling_score?: string | null
          actual_flare_level?: string | null
          actual_symptoms?: string[] | null
          notes?: string | null
        }
        if (fb.feeling_score) setFeelingScore(fb.feeling_score)
        if (fb.actual_flare_level) setFlareLevel(fb.actual_flare_level)
        if (fb.actual_symptoms) setActiveSymptoms(fb.actual_symptoms)
        if (fb.notes) setNotes(fb.notes)
      }
    })
  }, [isOpen])

  // Auto-dismiss after submit
  useEffect(() => {
    if (!submitted) return
    const timer = setTimeout(() => {
      onClose()
      // Reset form
      setFeelingScore('')
      setActiveSymptoms([])
      setFlareLevel('')
      setNotes('')
      setSubmitted(false)
      setAccuracyScore(null)
      setPrediction(null)
    }, 3000)
    return () => clearTimeout(timer)
  }, [submitted, onClose])

  if (!isOpen) return null

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    if (deltaY > 80) {
      onClose()
    }
    touchStartY.current = null
  }

  const toggleSymptom = (value: string) => {
    setActiveSymptoms(prev =>
      prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
    )
  }

  const handleSubmit = async () => {
    if (!feelingScore || !flareLevel) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: todayStr,
          feeling_score: feelingScore,
          actual_flare_level: flareLevel,
          actual_symptoms: activeSymptoms,
          notes,
        }),
      })
      const data = await res.json() as { accuracy_score?: number; message?: string }
      setAccuracyScore(data.accuracy_score ?? null)
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  const formattedToday = todayStr
    ? new Date(todayStr + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : ''

  const predFlareLevel = prediction
    ? ((prediction.flare_risk_level ?? prediction.level ?? '') as string)
    : ''
  const predWatchFor = prediction
    ? ((prediction.watch_for ?? []) as string[])
    : []

  const accuracyColor =
    accuracyScore === null
      ? '#7EB8A4'
      : accuracyScore >= 70
      ? '#7EB8A4'
      : accuracyScore >= 40
      ? '#FF8C42'
      : '#FF6B6B'

  const canSubmit = feelingScore !== '' && flareLevel !== ''

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .slide-up {
          animation: slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
        }}
      />

      {/* Sheet */}
      <div
        className="slide-up"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '90vh',
          background: '#15151f',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          zIndex: 1001,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Handle bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 12,
            paddingBottom: 8,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: '#333',
            }}
          />
        </div>

        {/* Scrollable content */}
        <div style={{ padding: '8px 20px 40px', flexGrow: 1 }}>
          {submitted ? (
            /* ─── Post-submit accuracy screen ─── */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 320,
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 56,
                  fontFamily: serifFont,
                  color: accuracyColor,
                  lineHeight: 1,
                  fontWeight: 700,
                }}
              >
                {accuracyScore !== null ? Math.round(accuracyScore) : '—'}
              </div>
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: 11,
                  color: '#888',
                  letterSpacing: '0.1em',
                  marginTop: 4,
                }}
              >
                % ACCURATE
              </div>
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: 12,
                  color: '#aaa',
                  textAlign: 'center',
                  marginTop: 8,
                }}
              >
                YOUR PREDICTION WAS{' '}
                {accuracyScore !== null ? Math.round(accuracyScore) : '—'}% ACCURATE
              </div>
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: 10,
                  color: '#7EB8A4',
                  letterSpacing: '0.08em',
                  textAlign: 'center',
                  marginTop: 16,
                }}
              >
                FEEDBACK SAVED · THIS IMPROVES FUTURE PREDICTIONS
              </div>
            </div>
          ) : (
            /* ─── Main form ─── */
            <>
              {/* Header */}
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 10,
                    color: '#7EB8A4',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  HOW DID TODAY GO
                </div>
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 12,
                    color: '#666',
                  }}
                >
                  {formattedToday}
                </div>
              </div>

              {/* Yesterday prediction preview */}
              <div
                style={{
                  background: '#0A0A0F',
                  borderRadius: 12,
                  padding: '12px 14px',
                  marginBottom: 24,
                  border: '1px solid #1e1e2e',
                }}
              >
                {prediction ? (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      <span
                        style={{
                          fontFamily: monoFont,
                          fontSize: 9,
                          color: '#555',
                          letterSpacing: '0.1em',
                          marginRight: 8,
                        }}
                      >
                        PREDICTED:
                      </span>
                      <span
                        style={{
                          fontFamily: monoFont,
                          fontSize: 11,
                          color:
                            FLARE_COLORS[predFlareLevel as FlareLevel] ??
                            '#888',
                          fontWeight: 600,
                        }}
                      >
                        {predFlareLevel || '—'}
                      </span>
                    </div>
                    {predWatchFor.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                        <span
                          style={{
                            fontFamily: monoFont,
                            fontSize: 9,
                            color: '#555',
                            letterSpacing: '0.1em',
                            marginRight: 4,
                          }}
                        >
                          PREDICTED SYMPTOMS:
                        </span>
                        {predWatchFor.map((item, i) => (
                          <span
                            key={i}
                            style={{
                              fontFamily: monoFont,
                              fontSize: 9,
                              color: '#888',
                              background: '#15151f',
                              border: '1px solid #1e1e2e',
                              borderRadius: 6,
                              padding: '2px 7px',
                            }}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        fontFamily: monoFont,
                        fontSize: 10,
                        color: '#FFD93D',
                        letterSpacing: '0.1em',
                        marginBottom: 4,
                      }}
                    >
                      BUILDING YOUR BASELINE
                    </div>
                    <div
                      style={{
                        fontFamily: monoFont,
                        fontSize: 11,
                        color: '#555',
                      }}
                    >
                      Keep logging meals to improve predictions
                    </div>
                  </>
                )}
              </div>

              {/* SECTION 1 — HOW DID YOU FEEL TODAY */}
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 9,
                    color: '#555',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  HOW DID YOU FEEL TODAY
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  {FEELING_OPTIONS.map(opt => {
                    const selected = feelingScore === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setFeelingScore(opt.value)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '10px 4px',
                          borderRadius: 12,
                          border: selected
                            ? '2px solid #7EB8A4'
                            : '2px solid #1e1e2e',
                          background: selected
                            ? 'rgba(126,184,164,0.1)'
                            : '#15151f',
                          cursor: 'pointer',
                          gap: 6,
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                      >
                        <span style={{ fontSize: 28, lineHeight: 1 }}>{opt.emoji}</span>
                        <span
                          style={{
                            fontFamily: monoFont,
                            fontSize: 9,
                            color: selected ? '#7EB8A4' : '#555',
                            letterSpacing: '0.05em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {opt.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* SECTION 2 — SYMPTOMS EXPERIENCED */}
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 9,
                    color: '#555',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  ANY SYMPTOMS TODAY
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                  }}
                >
                  {SYMPTOM_OPTIONS.map(sym => {
                    const active = activeSymptoms.includes(sym.value)
                    return (
                      <button
                        key={sym.value}
                        onClick={() => toggleSymptom(sym.value)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          padding: '9px 6px',
                          borderRadius: 10,
                          border: active
                            ? '1px solid #FF8C42'
                            : '1px solid #1e1e2e',
                          background: active
                            ? 'rgba(255,140,66,0.15)'
                            : '#15151f',
                          cursor: 'pointer',
                          fontFamily: monoFont,
                          fontSize: 11,
                          color: active ? '#FF8C42' : '#666',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ fontSize: 13 }}>{sym.emoji}</span>
                        {sym.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* SECTION 3 — ACTUAL FLARE LEVEL */}
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 9,
                    color: '#555',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  ACTUAL FLARE LEVEL
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {FLARE_LEVELS.map(level => {
                    const selected = flareLevel === level
                    const color = FLARE_COLORS[level]
                    return (
                      <button
                        key={level}
                        onClick={() => setFlareLevel(level)}
                        style={{
                          flex: 1,
                          padding: '9px 2px',
                          borderRadius: 10,
                          border: selected
                            ? `1px solid ${color}`
                            : '1px solid #1e1e2e',
                          background: selected
                            ? `${color}22`
                            : '#15151f',
                          cursor: 'pointer',
                          fontFamily: monoFont,
                          fontSize: 10,
                          color: selected ? color : '#555',
                          textAlign: 'center',
                          transition: 'all 0.15s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {level}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* SECTION 4 — NOTES */}
              <div style={{ marginBottom: 28 }}>
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 9,
                    color: '#555',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  ANYTHING ELSE
                </div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Something you noticed today..."
                  rows={3}
                  style={{
                    width: '100%',
                    background: '#0A0A0F',
                    border: '1px solid #1e1e2e',
                    borderRadius: 12,
                    padding: '12px 14px',
                    color: '#e8e8f0',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    resize: 'none',
                    height: 80,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* SUBMIT BUTTON */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                style={{
                  width: '100%',
                  height: 52,
                  borderRadius: 14,
                  border: canSubmit ? '1px solid #7EB8A4' : '1px solid #333',
                  background: 'transparent',
                  color: canSubmit ? '#7EB8A4' : '#555',
                  fontFamily: monoFont,
                  fontSize: 13,
                  letterSpacing: '0.12em',
                  cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
                  opacity: canSubmit ? 1 : 0.4,
                  transition: 'all 0.15s',
                }}
              >
                {submitting ? 'SUBMITTING...' : 'SUBMIT FEEDBACK'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
