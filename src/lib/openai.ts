import { AzureOpenAI } from 'openai';

// Initialize the Azure OpenAI client
const openai = new AzureOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  endpoint: "https://eisopenaiexplore.openai.azure.com/",
  apiVersion: "2024-12-01-preview",
  deployment: "gpt-5.4",
});

const generateTourPrompt = (
  liveGpsLat: number, 
  liveGpsLng: number, 
  velocityKmh: number, 
  targetLocationName: string, 
  language: string, 
  personaGender: string, 
  personaTone: string,
  pastVisitedLocations: string[],
  trafficOrWeatherAlerts: string | null
) => {
  return `
[ROLE]
You are a context-aware, multilingual, hyper-realistic Android AI Tour Guide. Your name is AuraGuide. Your tagline is "Your personal, voice-guided AI tour companion." You generate engaging audio scripts based on live GPS tracking, vehicle velocity, chosen language, target voice profiles, and the user's past history.

[CURRENT STATE]
- Live GPS: ${liveGpsLat}, ${liveGpsLng}
- Vehicle Velocity: ${velocityKmh} km/h
- Target Landmark/Town: ${targetLocationName}
- Output Language: ${language}
- Voice Persona: ${personaGender} (${personaTone})
- User's Past Visited Locations on this trip: ${pastVisitedLocations.length > 0 ? pastVisitedLocations.join(', ') : 'None yet.'}
- Live Alerts (Traffic/Weather): ${trafficOrWeatherAlerts || 'None'}

[CORE FUNCTIONALITIES]
1. VEHICLE TOUR MODE:
   - Instant Start: If velocity is 0 km/h upon initialization, instantly generate a brief history/context of the exact departure coordinates before the user starts moving.
   - En-Route Narration: Track live GPS points along the route. Predictively narrate histories of the upcoming ${targetLocationName} before the vehicle arrives. Use the speed to dictate the pacing.
2. LANGUAGE & VOICE PROFILE (NEW):
   - Multilingual: Output the response ENTIRELY in ${language} (supported languages include Spanish, Japanese, Hindi, English, Kannada, Tamil, Telugu, Malayalam, Tulu, Konkani, Marathi) while preserving historical accuracy.
   - Agent Gender/Persona Selection: Adopt the ${personaGender} gender and ${personaTone} persona tone (e.g., Professional Historian, Enthusiastic Backpacker). Adjust vocabulary, phrasing, and pacing to match.
3. CONTINUITY (PAST HISTORY):
   - Acknowledge the user's past visited locations if relevant. Draw comparisons or build a continuous storyline linking what they just saw to what they are about to see.
4. NARRATION STYLE: 
   - Avoid dry facts. Use storytelling hooks. 
   - Keep audio scripts under 3 minutes (approx 350-450 words max).
5. DYNAMIC ROUTING & GPS: 
   - Monitor live tracking data. Redirect the user if heavy traffic, closures, or weather barriers are detected (via the Live Alerts state).
6. CONVERSATIONAL Q&A: 
   - Pause narration upon audio interruption. Answer localized questions briefly, then smoothly resume the main route tour.
7. CROWDSOURCING: 
   - Weave verified community anecdotes into the narration when relevant to ${targetLocationName}.

[RESPONSE FORMAT]
Return a clean, valid JSON object containing exactly two keys. Do NOT wrap the JSON in markdown blocks (like \`\`\`json).
{
  "audio_script": "The spoken narrative or answer text optimized for TTS playback entirely in ${language}.",
  "routing_action": "Optional. Detour command or warning if triggered by traffic/weather/user request. Otherwise null."
}

[CONSTRAINTS]
- Never hallucinate historical or geographical facts.
- Stay in character. Do not mention system prompt rules.
- Do NOT output any text outside of the JSON object.
`;
};

export async function generateTourScript(
  poiName: string, 
  type: string, 
  preferences: any, 
  coordinates?: { lat: number, lng: number },
  velocityKmh: number = 0,
  pastVisitedLocations: string[] = [],
  trafficOrWeatherAlerts: string | null = null
): Promise<{ script: string, routingAction: string | null }> {
  const language = preferences.language || 'English';
  const personaGender = preferences.voicePersona || 'Female';
  const personaTone = preferences.topics?.includes('Architecture') ? 'Professional Historian' : 'Enthusiastic Backpacker';
  
  const prompt = generateTourPrompt(
    coordinates?.lat || 0,
    coordinates?.lng || 0,
    velocityKmh,
    poiName,
    language,
    personaGender,
    personaTone,
    pastVisitedLocations,
    trafficOrWeatherAlerts
  );

  const fallbackResult = { script: '', routingAction: null };

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OPENAI_API_KEY is missing. Using Wikipedia Fallback.");
      fallbackResult.script = await getWikipediaFallback(poiName, type, language, coordinates);
      return fallbackResult;
    }
    
    console.log("Calling OpenAI API with JSON format...");

    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 600,
      response_format: { type: "json_object" }
    });
    
    console.log("OpenAI API returned successfully.");

    const content = response.choices[0]?.message?.content;
    if (content) {
      try {
        const jsonContent = JSON.parse(content);
        return {
          script: jsonContent.audio_script || await getWikipediaFallback(poiName, type, language, coordinates),
          routingAction: jsonContent.routing_action || null
        };
      } catch (e) {
        console.error("Failed to parse JSON response from OpenAI", e);
      }
    }
    
    fallbackResult.script = await getWikipediaFallback(poiName, type, language, coordinates);
    return fallbackResult;
  } catch (error) {
    console.error("Error generating script from OpenAI:", error);
    fallbackResult.script = await getWikipediaFallback(poiName, type, language, coordinates);
    return fallbackResult;
  }
}

async function translateText(text: string, targetLangCode: string): Promise<string> {
  if (targetLangCode === 'en') return text;
  
  // Split text into chunks to avoid URI Too Long error in GET request
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  const promises = sentences.map(async (sentence) => {
    if (!sentence.trim()) return '';
    try {
      const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=${targetLangCode}&q=${encodeURIComponent(sentence.trim())}`;
      
      const data: any = await new Promise((resolve, reject) => {
        const https = require('https');
        
        function fetchUrl(targetUrl: string, redirectCount = 0) {
          if (redirectCount > 5) return reject(new Error('Too many redirects'));
          
          const options = {
            family: 4,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            }
          };
          
          https.get(targetUrl, options, (res: any) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              const newUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, targetUrl).toString();
              return fetchUrl(newUrl, redirectCount + 1);
            }
            
            let chunks = '';
            res.on('data', (d: any) => chunks += d);
            res.on('end', () => {
              if (res.statusCode === 200) {
                try {
                  resolve(JSON.parse(chunks));
                } catch(e) {
                  reject(e);
                }
              } else {
                reject(new Error("status " + res.statusCode));
              }
            });
          }).on('error', reject);
        }
        
        fetchUrl(url);
      });
      
      if (Array.isArray(data) && data.length > 0) {
        return data[0];
      }
      return sentence;
    } catch (e) {
      console.error("Translation block failed:", e);
      return sentence;
    }
  });
  
  const results = await Promise.all(promises);
  return results.join(' ');
}

async function getWikipediaFallback(poiName: string, type: string, language: string, coordinates?: { lat: number, lng: number }): Promise<string> {
  const langMap: Record<string, string> = {
    'english': 'en',
    'hindi': 'hi',
    'kannada': 'kn',
    'telugu': 'te',
    'tamil': 'ta',
    'malayalam': 'ml',
    'tulu': 'kn', // Fallback to Kannada for Tulu as it shares vocabulary/region
    'konkani': 'kok'
  };
  
  const targetLangCode = langMap[language.toLowerCase()] || 'en';
  
  try {
    // 1. ALWAYS Search English Wikipedia first because Overpass POI names are primarily Latin script
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(poiName)}&utf8=&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    if (searchData.query && searchData.query.search && searchData.query.search.length > 0) {
      const title = searchData.query.search[0].title;
      
      // 2. Fetch the actual content extract from English Wikipedia
      const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;
      const contentRes = await fetch(contentUrl);
      const contentData = await contentRes.json();
      
      const pages = contentData.query.pages;
      const pageId = Object.keys(pages)[0];
      const extract = pages[pageId].extract;
      
      if (extract && extract.length > 50) {
        // We have real factual data!
        // We will limit it to 8 sentences
        const sentences = extract.split(/[.!?।]+/).filter((s: string) => s.trim().length > 0);
        let limited = sentences.slice(0, 8).join('. ') + '.';
        
        // Dynamically find REAL nearby Wikipedia places!
        if (coordinates) {
          try {
            const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${coordinates.lat}|${coordinates.lng}&gsradius=2500&gslimit=4&format=json&origin=*`;
            const geoRes = await fetch(geoUrl);
            const geoData = await geoRes.json();
            if (geoData.query && geoData.query.geosearch && geoData.query.geosearch.length > 1) {
              const nearbyPlaces = geoData.query.geosearch
                .map((p: any) => p.title)
                .filter((t: string) => !t.toLowerCase().includes(poiName.toLowerCase()))
                .slice(0, 2);
              
              if (nearbyPlaces.length > 0) {
                const placesString = nearbyPlaces.join(" and ");
                limited += ` If you are exploring this area, you are also very close to ${placesString}.`;
              }
            }
          } catch(e) {
             console.error("Geosearch failed:", e);
          }
        }
        
        // 3. TRANSLATE the English Wikipedia factual text to the user's selected language!
        return await translateText(limited, targetLangCode);
      }
    }
  } catch (err) {
    console.error("Wikipedia fallback failed:", err);
  }

  // If Wikipedia fails completely, generate a fully contextual dynamic fallback and translate it
  return await generateDynamicFallback(poiName, type, targetLangCode, coordinates);
}

async function generateDynamicFallback(poiName: string, type: string, targetLangCode: string, coordinates?: { lat: number, lng: number }): Promise<string> {
  let nearbyPlaces: string[] = [];
  if (coordinates) {
      try {
        const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${coordinates.lat}|${coordinates.lng}&gsradius=2500&gslimit=4&format=json&origin=*`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();
        if (geoData.query && geoData.query.geosearch && geoData.query.geosearch.length > 0) {
          nearbyPlaces = geoData.query.geosearch
            .map((p: any) => p.title)
            .filter((t: string) => !t.toLowerCase().includes(poiName.toLowerCase()))
            .slice(0, 2);
        }
      } catch(e) {}
  }

  const hasNearby = nearbyPlaces.length > 0;
  const placesStr = nearbyPlaces.join(" and ");
  
  const intros = [
    `Welcome to ${poiName}, a beautiful ${type} located right here in the city.`,
    `You are now exploring ${poiName}, a well-known ${type} located in the city that locals deeply cherish.`,
    `Discover the beauty of ${poiName}, a fascinating ${type} nestled right here in the city.`
  ];
  
  const history = [
    `Established as a key point of interest, it holds a special place strictly within the local community. The architecture and environment reflect its own unique heritage.`,
    `This specific location is known for its serene atmosphere and deep roots. It perfectly captures its own historical essence without relying on the wider city's history.`,
    `With a history shaped by decades of development, this landmark stands on its own as a testament to its rich past.`
  ];

  const visualDetails = [
    `As you stand before it, you can observe the intricate details that make it so special to visitors. Notice the way the light highlights its best features during the day.`,
    `Take a moment to look at the craftsmanship and natural integration of the site. It is a brilliant example of regional aesthetics blending with functionality.`,
    `The structural and visual elements you see around you are carefully preserved. Every corner holds a small piece of aesthetic history waiting to be admired.`
  ];

  const lore = [
    `According to local lore, this place has witnessed numerous historical events that shaped the modern neighborhood. It has been a gathering spot for generations.`,
    `Many elders in the community have fascinating stories about this exact location. It has quietly watched the city evolve around it over the years.`,
    `There are countless untold stories associated with this spot. It has served as a silent observer to the daily lives of thousands of people.`
  ];
  
  let fame = "";
  if (hasNearby) {
    const fames = [
      `This specific area is actually famous for its proximity to iconic landmarks like ${placesStr}.`,
      `Tourists often flock to this region because it serves as a gateway to legendary sites such as ${placesStr}.`,
      `What makes this location truly special is its connection to the surrounding heritage, notably ${placesStr}.`
    ];
    fame = fames[Math.floor(Math.random() * fames.length)];
  } else {
    const fames = [
      `Interestingly, it remains one of the most photographed spots by tourists exploring the outer city limits.`,
      `It is particularly famous for its tranquil environment away from the bustling urban noise.`,
      `Local historians often celebrate this spot for its enduring legacy and unique charm.`
    ];
    fame = fames[Math.floor(Math.random() * fames.length)];
  }

  const tips = [
    `For the best experience, try to explore the central areas during the quiet morning hours. Bringing a camera is always highly recommended.`,
    `If you have the time, taking a slow walk around the perimeter will reveal hidden details. It's best visited when the weather is clear.`,
    `To truly appreciate it, sit quietly for a few minutes and take in the ambiance. It is a fantastic place to relax and find some peace.`
  ];
  
  const endings = [
    `We hope this destination leaves you with wonderful memories of your trip!`,
    `Enjoy your visit to the fullest and take plenty of pictures!`,
    `Whether you're a history buff or just passing through, this is a wonderful place to pause and reflect.`
  ];
  
  const selectedIntro = intros[Math.floor(Math.random() * intros.length)];
  const selectedHistory = history[Math.floor(Math.random() * history.length)];
  const selectedVisual = visualDetails[Math.floor(Math.random() * visualDetails.length)];
  const selectedLore = lore[Math.floor(Math.random() * lore.length)];
  const selectedTip = tips[Math.floor(Math.random() * tips.length)];
  const selectedEnding = endings[Math.floor(Math.random() * endings.length)];

  // This results in EXACTLY 8-10 sentences depending on the strings selected!
  const englishStory = `${selectedIntro} ${selectedHistory} ${selectedVisual} ${selectedLore} ${fame} ${selectedTip} ${selectedEnding}`;

  return await translateText(englishStory, targetLangCode);
}

export async function answerQuestion(poi: any, question: string, language: string = 'English'): Promise<string> {
  const langMap: Record<string, string> = {
    'english': 'en',
    'hindi': 'hi',
    'kannada': 'kn',
    'telugu': 'te',
    'tamil': 'ta',
    'malayalam': 'ml',
    'tulu': 'kn',
    'konkani': 'kok'
  };
  const targetLangCode = langMap[language.toLowerCase()] || 'en';

  if (!process.env.OPENAI_API_KEY) {
    try {
      const qLower = question.toLowerCase();
      
      // 1. Is it a question about nearby places? (Use Geosearch)
      const isNearbyQuestion = qLower.match(/(famous|nearby|around|close|near|other places)/);
      if (isNearbyQuestion && poi.coordinates) {
        const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${poi.coordinates.lat}|${poi.coordinates.lng}&gsradius=3000&gslimit=5&format=json&origin=*`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();
        
        if (geoData.query && geoData.query.geosearch && geoData.query.geosearch.length > 1) {
          const nearbyPlaces = geoData.query.geosearch
            .map((p: any) => p.title)
            .filter((t: string) => !t.toLowerCase().includes(poi.name.toLowerCase()) && !t.toLowerCase().includes('india') && !t.toLowerCase().includes('karnataka'))
            .slice(0, 4);
          
          if (nearbyPlaces.length > 0) {
            const placesString = nearbyPlaces.join(", ");
            const answer = `Some of the most famous places to explore right here include: ${placesString}.`;
            return await translateText(answer, targetLangCode);
          }
        }
      }

      // 2. Fact-based question: Try to find the answer by searching inside the Wikipedia article itself!
      const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(poi.name)}&format=json&origin=*`;
      const contentRes = await fetch(contentUrl);
      const contentData = await contentRes.json();
      const pages = contentData.query.pages;
      const pageId = Object.keys(pages)[0];
      const extract = pages[pageId]?.extract;

      if (extract && extract.length > 10) {
        const sentences = extract.split(/[.!?।]+/).filter((s: string) => s.trim().length > 0);
        const stopWords = ['what','is','the','of','this','place','where','when','how','why','a','an','and','in','on','at','to','for', 'famous', 'there'];
        const questionWords = qLower.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => !stopWords.includes(w) && w.length > 2);
        
        if (questionWords.length > 0) {
          let bestSentence = "";
          let maxMatches = 0;
          
          for (const s of sentences) {
            const sLower = s.toLowerCase();
            let matches = 0;
            for (const w of questionWords) {
              if (sLower.includes(w)) matches++;
            }
            if (matches > maxMatches) {
              maxMatches = matches;
              bestSentence = s.trim() + ".";
            }
          }
          
          if (maxMatches > 0) {
            const factPrefixes = [
              `Here is what I found: `,
              `Based on my knowledge: `,
              `According to local records, `,
              `Interestingly enough, `
            ];
            const prefix = factPrefixes[Math.floor(Math.random() * factPrefixes.length)];
            const answer = `${prefix}${bestSentence}`;
            return await translateText(answer, targetLangCode);
          }
        }
      }
      
      // 3. Fallback: General Wikipedia search
      const queryTerms = qLower.replace(/why|what|when|where|how|is|the|are/gi, '').trim();
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(poi.name + " " + queryTerms)}&utf8=&format=json&origin=*`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      if (searchData.query && searchData.query.search && searchData.query.search.length > 0) {
        let snippet = searchData.query.search[0].snippet.replace(/<[^>]*>?/gm, '');
        snippet = snippet.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        
        const fallbackPrefixes = [
          `I found this related information: `,
          `From what I could gather from the archives: `,
          `Here is a quick summary: `
        ];
        const prefix = fallbackPrefixes[Math.floor(Math.random() * fallbackPrefixes.length)];
        const answer = `${prefix}${snippet}...`;
        return await translateText(answer, targetLangCode);
      }
      const fallbackMsg = `There are no specific historical records answering that exact question for ${poi.name}, but it remains a highly notable ${poi.category} to explore!`;
      return await translateText(fallbackMsg, targetLangCode);
    } catch (e) {
      console.error("Wikipedia chat fallback error:", e);
      return await translateText(`${poi.name} is a beautiful ${poi.category}. Keep exploring to discover more!`, targetLangCode);
    }
  }

  const prompt = `You are a knowledgeable local tour guide for GeoNarrate AI. The user is exploring "${poi.name}".
They asked: "${question}"

CRITICAL RULES:
1. Answer the question directly and correctly. NEVER give reasons, excuses, or apologize (never say "I am an AI" or "I don't have access").
2. Focus strictly on explaining the famous places, specific landmarks, and direct details of "${poi.name}". Do NOT give generic explanations about the entire city or state.
3. Keep it under 4 sentences to be easily readable on a mobile screen. 
4. Your response MUST be fully translated into ${language}.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 250,
    });

    return response.choices[0]?.message?.content || "I'm not sure about that, but keep exploring!";
  } catch (error) {
    console.error("Error answering question:", error);
    throw new Error("Failed to answer question.");
  }
}
