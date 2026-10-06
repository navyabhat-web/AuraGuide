import { NextRequest, NextResponse } from 'next/server';
import { answerQuestion } from '@/lib/openai';
import { generateTTS } from '@/lib/tts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poi, question, language = 'English', voicePersona = 'Female' } = body;

    if (!poi || !poi.name || !question) {
      return NextResponse.json({ error: "Missing POI or question" }, { status: 400 });
    }

    const answer = await answerQuestion(poi, question, language);
    
    // Generate Audio for the answer
    // Using a default voice persona (e.g. Female) or what you want
    let base64Audio = null;
    try {
      const audioBuffer = await generateTTS(answer, voicePersona as 'Male' | 'Female');
      base64Audio = Buffer.from(audioBuffer).toString('base64');
    } catch (e) {
      console.error("Failed to generate TTS for chat answer:", e);
    }

    return NextResponse.json({ answer, audioBase64: base64Audio }, { status: 200 });
  } catch (error: any) {
    console.error("Chat API Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
