import React, { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

const getFallbackImage = (category: string) => {
  switch(category) {
    case 'Temples & Spiritual': return 'https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=400';
    case 'Historic & Ancient': return 'https://images.unsplash.com/photo-1544413660-299165566b1d?w=400';
    case 'Nature & Scenery': return 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400';
    case 'Urban & Modern': return 'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=400';
    case 'Defense & Infrastructure': return 'https://images.unsplash.com/photo-1565019014169-232cb979d5bb?w=400';
    case 'Commercial & Shops': return 'https://images.unsplash.com/photo-1555529771-835f59bfc50c?w=400';
    case 'Offices & Companies': return 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400';
    case 'Infrastructure & Roads': return 'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=400';
    case 'Buildings & Structures': return 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400';
    default: return 'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=400';
  }
};

export const LazyWikiImage = ({ poiName, category, lat, lng }: { poiName: string, category: string, lat?: number, lng?: number }) => {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '100px' });
    
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    
    let isMounted = true;
    const fetchImage = async () => {
      try {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(poiName)}&gsrlimit=1&prop=pageimages&pithumbsize=400&format=json&origin=*`;
        const res = await fetch(searchUrl);
        const data = await res.json();
        
        if (data.query && data.query.pages) {
          const pages = data.query.pages;
          const pageId = Object.keys(pages)[0];
          if (pages[pageId].thumbnail && isMounted) {
            setImgUrl(pages[pageId].thumbnail.source);
            return;
          }
        }
        // Fallback to Wikipedia Geosearch for the exact city/location!
        if (isMounted && lat && lng) {
          try {
            const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${lat}|${lng}&ggsradius=5000&ggslimit=10&prop=pageimages&pithumbsize=400&format=json&origin=*`;
            const geoRes = await fetch(geoUrl);
            const geoData = await geoRes.json();
            
            if (geoData.query && geoData.query.pages) {
              const pages = geoData.query.pages;
              for (const key in pages) {
                if (pages[key].thumbnail && pages[key].thumbnail.source && isMounted) {
                  setImgUrl(pages[key].thumbnail.source);
                  return;
                }
              }
            }
          } catch (e) {}
        }
      } catch (err) {}
      
      // Ultimate Fallback
      if (isMounted) setImgUrl(getFallbackImage(category));
    };
    
    fetchImage();
    return () => { isMounted = false; };
  }, [isVisible, poiName, category]);

  return (
    <div ref={imgRef} className="w-full h-32 bg-cream-alt rounded-xl mb-3 flex items-center justify-center border border-pink-200 overflow-hidden relative">
      <img 
        src={imgUrl || getFallbackImage(category)} 
        alt={poiName} 
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${imgUrl ? 'opacity-90' : 'opacity-50 blur-sm'}`}
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-rose-950/40 to-transparent" />
      <MapPin size={24} className="text-white/80 absolute bottom-3 right-3 drop-shadow-md" />
    </div>
  );
};
