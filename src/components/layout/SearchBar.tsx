import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { usePOIStore } from '../../hooks/usePOIStore';
import { useMap } from 'react-leaflet'; // This would need to be inside MapContainer if used directly, or we can just update a state that MapController watches.

import { useLanguage } from '../../contexts/LanguageContext';

// Better approach: pass a function to update the map center.
interface Props {
  onSearch: (lat: number, lng: number) => void;
  theme: string;
}

export const SearchBar = ({ onSearch, theme }: Props) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        onSearch(parseFloat(lat), parseFloat(lon));
        setQuery(''); // clear after search
      } else {
        alert("Location not found. Try a different search.");
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form 
      onSubmit={handleSearch} 
      className={`relative flex-1 max-w-md mx-4 flex items-center px-4 py-2 rounded-full shadow-md backdrop-blur-xl border transition-all bg-white/80 border-pink-200 text-deep-rose-dark focus-within:bg-white`}
    >
      <Search size={18} className={`shrink-0 text-deep-rose`} />
      <input
        type="text"
        placeholder={t('searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-transparent border-none outline-none px-3 placeholder-rose-400/70 text-sm"
        disabled={loading}
      />
      {loading && <span className="shrink-0 animate-spin text-pink-500 rounded-full h-4 w-4 border-b-2 border-pink-500"></span>}
    </form>
  );
};
