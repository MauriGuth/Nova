/**
 * Utilidad de voz para anuncios de comandas.
 * - Desbloqueo en móvil: el navegador solo permite hablar tras un gesto del usuario (ej. tocar "Voz ON").
 * - Frases cortas y velocidad baja para que se entienda en TV y parlantes pequeños.
 */

const RATE = 0.72
const PAUSE_BETWEEN_CHUNKS_MS = 700
const UNLOCK_PHRASE = "Listo."

function getSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null
  return window.speechSynthesis
}

function getSpanishVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices()
  return (
    voices.find((v) => v.lang.startsWith("es") && v.name.includes("Google")) ??
    voices.find((v) => v.lang.startsWith("es-AR")) ??
    voices.find((v) => v.lang.startsWith("es")) ??
    null
  )
}

/**
 * Llama desde un gesto del usuario (ej. clic en "Voz ON") para desbloquear la voz en móvil.
 * Habla una frase mínima para que el navegador permita hablar después.
 */
export function unlockAudio(): void {
  const synth = getSynth()
  if (!synth) return
  synth.cancel()
  const utt = new SpeechSynthesisUtterance(UNLOCK_PHRASE)
  utt.lang = "es-AR"
  utt.rate = 0.9
  utt.volume = 0.1
  const voice = getSpanishVoice(synth)
  if (voice) utt.voice = voice
  synth.speak(utt)
}

/**
 * Parte el texto en frases cortas para que se entienda mejor (TV/parlantes).
 * Devuelve array de strings para decir uno tras otro con pausa.
 */
function chunkText(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const bySentence = trimmed.split(/(?<=[.])\s+/).filter(Boolean)
  const result: string[] = []
  for (const part of bySentence) {
    if (part.length <= 60) {
      result.push(part)
    } else {
      const byComma = part.split(/(?<=[,])\s+/)
      for (let i = 0; i < byComma.length && result.length < 4; i++) {
        result.push(byComma[i].trim())
      }
    }
  }
  if (result.length === 0) result.push(trimmed)
  return result.slice(0, 4)
}

/**
 * Dice un anuncio en frases cortas, velocidad baja, y llama onDone al terminar.
 * Usar después de haber llamado unlockAudio() al menos una vez (desde un clic).
 */
export function speakAnnouncement(
  text: string,
  onDone: () => void
): void {
  const synth = getSynth()
  if (!synth) {
    onDone()
    return
  }
  synth.cancel()
  const chunks = chunkText(text)
  if (chunks.length === 0) {
    onDone()
    return
  }
  let index = 0
  function speakNext() {
    if (index >= chunks.length) {
      onDone()
      return
    }
    const utt = new SpeechSynthesisUtterance(chunks[index])
    utt.lang = "es-AR"
    utt.rate = RATE
    utt.volume = 1
    const voice = getSpanishVoice(synth)
    if (voice) utt.voice = voice
    utt.onend = () => {
      index++
      if (index < chunks.length) {
        setTimeout(speakNext, PAUSE_BETWEEN_CHUNKS_MS)
      } else {
        onDone()
      }
    }
    utt.onerror = () => {
      index++
      setTimeout(() => speakNext(), 100)
    }
    synth.speak(utt)
  }
  setTimeout(() => speakNext(), 150)
}

/**
 * Versión corta para un solo mensaje (ej. "Mesa 5 lista") sin partir en chunks.
 */
export function speakShort(text: string, onDone?: () => void): void {
  const synth = getSynth()
  if (!synth) {
    onDone?.()
    return
  }
  synth.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = "es-AR"
  utt.rate = RATE
  utt.volume = 1
  const voice = getSpanishVoice(synth)
  if (voice) utt.voice = voice
  utt.onend = () => onDone?.()
  utt.onerror = () => onDone?.()
  setTimeout(() => synth.speak(utt), 150)
}

export function cancelSpeech(): void {
  getSynth()?.cancel()
}
