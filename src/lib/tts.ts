export async function generateTTS(text: string, voicePersona: 'Male' | 'Female' = 'Female'): Promise<ArrayBuffer> {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key is missing.");
  }

  // Default IDs from ElevenLabs
  const femaleVoiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel
  const maleVoiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam
  const voiceId = voicePersona === 'Male' ? maleVoiceId : femaleVoiceId;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API responded with status: ${response.status}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error("Error generating TTS from ElevenLabs:", error);
    throw new Error("Failed to generate audio.");
  }
}
