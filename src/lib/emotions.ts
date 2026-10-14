export type EmotionId = 'ambition' | 'curiosity' | 'craft' | 'grit' | 'roots' | 'wonder'

export type Emotion = {
  id: EmotionId
  label: string
  colour: string
  means: string
  /** chime frequency in Hz, used by the sound layer */
  note: number
}

export const EMOTIONS: Emotion[] = [
  { id: 'ambition', label: 'Ambition', colour: '#ffb43a', means: 'wins, launches, milestones', note: 523.25 },
  { id: 'curiosity', label: 'Curiosity', colour: '#8f5bff', means: 'ideas, experiments, rabbit holes', note: 659.25 },
  { id: 'craft', label: 'Craft', colour: '#38e6ff', means: 'things built and shipped', note: 783.99 },
  { id: 'grit', label: 'Grit', colour: '#ff4526', means: 'hard work, endurance, pressure', note: 392.0 },
  { id: 'roots', label: 'Roots', colour: '#e0784a', means: 'family, home, Delhi', note: 440.0 },
  { id: 'wonder', label: 'Wonder', colour: '#f1ebff', means: 'travel, people, big dreams', note: 880.0 },
]

export const EMOTION_INDEX: Record<EmotionId, number> = Object.fromEntries(
  EMOTIONS.map((e, i) => [e.id, i]),
) as Record<EmotionId, number>

export const emotionColour = (id: EmotionId) => EMOTIONS[EMOTION_INDEX[id]].colour
