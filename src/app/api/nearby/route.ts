import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Trigger Turbopack recompile
export async function POST(req: NextRequest) {
  try {
    const { lat, lng, language = 'English' } = await req.json();

    if (!lat || !lng) {
      return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
    }

    // Attempt Overpass API Query: Find places across 6 domains within 50000m (50km)
    let pois = await fetchOverpass(lat, lng, language);

    // Mandatory City-Center Fallback
    if (pois.length < 5) {
      console.log("Fewer than 5 results found, attempting city-center geocoding fallback...");
      try {
        const nominatimResponse = await fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=" + lat + "&lon=" + lng + "&zoom=10");
        if (nominatimResponse.ok) {
          const locData = await nominatimResponse.json();
          // Find the city or district center
          const fallbackLat = parseFloat(locData.lat);
          const fallbackLng = parseFloat(locData.lon);
          
          if (!isNaN(fallbackLat) && !isNaN(fallbackLng) && (fallbackLat !== lat || fallbackLng !== lng)) {
             console.log("Geocoded city center at " + fallbackLat + ", " + fallbackLng);
             const fallbackPois = await fetchOverpass(fallbackLat, fallbackLng, language);
             // Merge while avoiding duplicates
             const existingIds = new Set(pois.map(p => p.id));
             fallbackPois.forEach(p => {
               if (!existingIds.has(p.id)) pois.push(p);
             });
          }
        }
      } catch (e) {
        console.error("City-center Nominatim fallback failed", e);
      }
    }

    // Dynamic Wikipedia GeoSearch Fallback
    if (pois.length === 0) {
      console.warn("Overpass failed or returned 0 results. Falling back to Live Wikipedia GeoSearch.");
      pois = await fetchWikipediaNearby(lat, lng, language);
    }

    return NextResponse.json({ pois }, { status: 200 });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch nearby POIs" }, { status: 500 });
  }
}

async function fetchWikipediaNearby(lat: number, lng: number, language: string) {
  try {
    // ALWAYS search Wikipedia using English to prevent filtering out places when regional languages are selected
    const code = 'en';
    
    const url = `https://${code}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=10000&gslimit=15&format=json&origin=*`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return [];
    
    const data = await response.json();
    if (!data.query || !data.query.geosearch) return [];
    
    return data.query.geosearch.map((item: any) => ({
      id: "wiki_" + item.pageid,
      name: item.title,
      coordinates: { lat: item.lat, lng: item.lon },
      category: "Historic & Ancient", // Default category for wiki articles
      description: `A notable location approximately ${Math.round(item.dist)} meters away.`
    }));
  } catch (e) {
    console.error("Wikipedia GeoSearch failed", e);
    return [];
  }
}

async function fetchOverpass(lat: number, lng: number, language: string) {
  const overpassQuery = `
    [out:json][timeout:25];
    (
      nwr(around:50000, ${lat}, ${lng})["tourism"];
      nwr(around:50000, ${lat}, ${lng})["historic"];
      nwr(around:50000, ${lat}, ${lng})["waterway"="waterfall"];
      nwr(around:50000, ${lat}, ${lng})["amenity"="place_of_worship"];
      nwr(around:50000, ${lat}, ${lng})["natural"="hill"];
      nwr(around:50000, ${lat}, ${lng})["natural"="peak"];
      nwr(around:50000, ${lat}, ${lng})["natural"="beach"];
      nwr(around:50000, ${lat}, ${lng})["leisure"="park"];
      nwr(around:50000, ${lat}, ${lng})["shop"="mall"];
      nwr(around:2000, ${lat}, ${lng})["shop"];
      nwr(around:2000, ${lat}, ${lng})["office"];
      nwr(around:2000, ${lat}, ${lng})["highway"];
      nwr(around:2000, ${lat}, ${lng})["building"];
    );
    out center 800;
  `;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter'
  ];

  let data = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(overpassQuery),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        cache: 'no-store'
      });
      if (response.ok) {
        data = await response.json();
        break; 
      }
    } catch (e) {}
  }

  if (!data || !data.elements) return [];
  const combinedElements = data.elements;

  const langCodeMap: Record<string, string> = {
    'English': 'en',
    'Kannada': 'kn',
    'Hindi': 'hi',
    'Tulu': 'tcy',
    'Telugu': 'te',
    'Tamil': 'ta',
    'Malayalam': 'ml',
    'Konkani': 'kok'
  };

  const code = langCodeMap[language] || 'en';

  return combinedElements
    .filter((el: any) => el.tags)
    .map((el: any) => {
      let category = "Historic & Ancient";
      const t = el.tags;
      
      let exactName = t['name:' + code] || t['name:en'] || t.name || t.official_name || t.historic_name;

      if (t.tourism) category = "All Places";
      if (t.amenity === 'place_of_worship') category = "Temples & Spiritual";
      if (t.natural || t.waterway) category = "Nature & Scenery";
      if (t.shop === 'mall' || t.amenity === 'bus_station' || t.aeroway || t.railway) category = "Urban & Modern";
      else if (t.shop) category = "Commercial & Shops";
      
      if (t.office) category = "Offices & Companies";
      if (t.highway) category = "Infrastructure & Roads";
      if (t.historic === 'fort' || t.historic === 'castle') category = "Defense & Infrastructure";
      else if (t.building && category === "Historic & Ancient") category = "Buildings & Structures";

      // If the location has no mapped name, give it a smart fallback based on its type
      if (!exactName) {
         if (t.amenity === 'place_of_worship') exactName = 'Local Temple / Shrine';
         else if (t.historic) exactName = 'Historic Site';
         else if (t.natural) exactName = 'Natural Landmark';
         else if (t.leisure) exactName = 'Local Park / Recreation';
         else if (t.waterway === 'waterfall') exactName = 'Local Waterfall';
         else if (t.shop) exactName = 'Local Shop';
         else if (t.office) exactName = 'Local Office';
         else if (t.highway) exactName = 'Local Street / Road';
         else if (t.building) exactName = 'Local Building';
         else exactName = 'Point of Interest';
      }

      const finalLat = el.lat || (el.center && el.center.lat);
      const finalLon = el.lon || (el.center && el.center.lon);

      let desc = t.description || t.wikipedia || ("A notable landmark located at " + finalLat.toFixed(4) + ", " + finalLon.toFixed(4) + ".");

      return {
        id: "poi_" + el.id,
        name: exactName,
        coordinates: { lat: finalLat, lng: finalLon },
        category: category,
        description: desc
      };
  });
}
