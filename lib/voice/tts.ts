"use client";

// Thin interface so browser TTS can be swapped for a paid engine later
// without touching any UI code — nothing outside this file should ever
// reference `speechSynthesis` directly.
export interface SpeakOptions {
  onStart?: () => void;
  onEnd?: () => void;
}

export interface TtsEngine {
  isSupported(): boolean;
  speak(text: string, options?: SpeakOptions): void;
  cancel(): void;
}

let cachedVoice: SpeechSynthesisVoice | null | undefined;
let voicesReadyPromise: Promise<void> | null = null;

// getVoices() returns [] on first call in most browsers — the list loads
// asynchronously and only 'voiceschanged' tells you when it's ready.
function ensureVoicesLoaded(): Promise<void> {
  if (voicesReadyPromise) return voicesReadyPromise;
  voicesReadyPromise = new Promise((resolve) => {
    if (window.speechSynthesis.getVoices().length > 0) {
      resolve();
      return;
    }
    const handler = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve();
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    // Some browsers never fire voiceschanged if a voice list was already
    // cached — don't let selection hang forever.
    setTimeout(resolve, 1000);
  });
  return voicesReadyPromise;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  const deepMale = voices.find((v) => /^en-(US|GB)/.test(v.lang) && /daniel|david|male/i.test(v.name));
  const localEnglish = voices.find((v) => v.lang.startsWith("en") && v.localService);
  const anyEnglish = voices.find((v) => v.lang.startsWith("en"));
  cachedVoice = deepMale ?? localEnglish ?? anyEnglish ?? voices[0] ?? null;
  return cachedVoice;
}

export const browserTts: TtsEngine = {
  isSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  },

  speak(text, options) {
    if (!this.isSupported()) {
      options?.onEnd?.();
      return;
    }
    void ensureVoicesLoaded().then(() => {
      window.speechSynthesis.cancel(); // clear anything queued
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      utterance.rate = 1.02;
      utterance.pitch = 0.9;
      utterance.onstart = () => options?.onStart?.();
      utterance.onend = () => options?.onEnd?.();
      utterance.onerror = () => options?.onEnd?.();
      window.speechSynthesis.speak(utterance);
    });
  },

  cancel() {
    if (this.isSupported()) window.speechSynthesis.cancel();
  },
};
