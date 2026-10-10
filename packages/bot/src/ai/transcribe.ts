/**
 * Voice note → text via Groq Whisper (free plan). WhatsApp voice notes are OGG/Opus.
 * The transcript then goes through the normal extraction pipeline and confirmation card.
 */

export interface Transcript {
  text: string;
  language: string | null;
}

export interface Transcriber {
  transcribe(audio: Uint8Array, mimeType: string): Promise<Transcript>;
}

const MAX_BYTES = 25 * 1024 * 1024;

export function createGroqTranscriber(
  env: Record<string, string | undefined> = process.env,
  fetchFn: typeof fetch = fetch,
): Transcriber | null {
  const key = env.GROQ_API_KEY;
  if (!key) return null;
  const model = env.GROQ_STT_MODEL || "whisper-large-v3-turbo";
  return {
    async transcribe(audio, mimeType) {
      if (audio.byteLength === 0 || audio.byteLength > MAX_BYTES) throw new Error("Audio empty or too large");
      const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mpeg") ? "mp3" : mimeType.includes("mp4") ? "m4a" : "wav";
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `voice.${ext}`);
      form.append("model", model);
      form.append("response_format", "verbose_json");
      form.append("temperature", "0");
      // Context prompt helps Whisper spell blood-request vocabulary correctly.
      form.append("prompt", "Blood request: B positive, O negative, platelets, PRBC, unit, hospital, chahiye, पाहिजे.");
      const res = await fetchFn("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`Transcription failed: HTTP ${res.status}`);
      const data = (await res.json()) as { text?: string; language?: string };
      const text = (data.text ?? "").trim();
      if (!text) throw new Error("Empty transcript");
      return { text, language: data.language ?? null };
    },
  };
}