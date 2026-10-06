import { NextRequest, NextResponse } from 'next/server';
import { generateTourScript } from '@/lib/openai';
import { generateTTS } from '@/lib/tts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poi, preferences, location, velocityKmh, pastVisitedLocations, trafficOrWeatherAlerts } = body;

    if (!poi || !poi.name || !poi.category) {
      return NextResponse.json({ error: "Missing POI data" }, { status: 400 });
    }

    console.log(`Generating script for ${poi.name}...`);
    // 1. Generate the narrative script
    const { script, routingAction } = await generateTourScript(
      poi.name, 
      poi.category, 
      preferences, 
      poi.coordinates || location,
      velocityKmh || 0,
      pastVisitedLocations || [],
      trafficOrWeatherAlerts || null
    );

    // Audio & Text Validation Filter
    // Split sentences using standard punctuation AND Devanagari Danda for Hindi
    const sentences = script.split(/[.!?।]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;
    
    // Check for generic terms and exact name inclusion
    const isGenericTerm = script.toLowerCase().includes("generic") || script.toLowerCase().includes("this category of place");
    
    // To handle translations or LLM rewrites, check if at least one significant word from the POI name is present
    const nameWords = poi.name.toLowerCase().split(/[\s,.-]+/).filter((w: string) => w.length > 3);
    const hasNamePart = nameWords.length > 0 
      ? nameWords.some((w: string) => script.toLowerCase().includes(w))
      : script.toLowerCase().includes(poi.name.toLowerCase());

    const isNonEnglish = preferences.language && preferences.language.toLowerCase() !== 'english';
    const isGeneric = isGenericTerm || (!isNonEnglish && !hasNamePart && !script.toLowerCase().includes("here"));

    if (isGeneric) {
      console.warn(`Validation failed for ${poi.name}. Sentences: ${sentenceCount}. Generic: ${isGeneric}`);
      throw new Error("AI generation failed validation constraints (generic content).");
    }

    console.log(`Generating audio for ${poi.name}...`);
    // 2. Generate the TTS audio (graceful fallback)
    let base64Audio = null;
    try {
      const audioBuffer = await generateTTS(script, preferences.voicePersona);
      base64Audio = Buffer.from(audioBuffer).toString('base64');
    } catch (ttsError) {
      console.warn("TTS Generation failed (missing key or quota). Returning script only for native fallback.");
    }

    // 3. Return JSON containing text (and audio if successful)
    return NextResponse.json({
      script: script,
      audioBase64: base64Audio,
      routingAction: routingAction
    }, { status: 200 });
  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; // Prevent any aggressive caching
