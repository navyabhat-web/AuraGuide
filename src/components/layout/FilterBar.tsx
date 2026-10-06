import React from 'react';

import { useLanguage } from '../../contexts/LanguageContext';
import { TranslationKey } from '../../lib/translations';

const CATEGORIES = ["All Places", "Temples & Spiritual", "Historic & Ancient", "Nature & Scenery", "Urban & Modern", "Defense & Infrastructure", "Commercial & Shops", "Offices & Companies", "Infrastructure & Roads", "Buildings & Structures"];

const categoryKeys: Record<string, TranslationKey> = {
  "All Places": "allPlaces",
  "Temples & Spiritual": "templesSpiritual",
  "Historic & Ancient": "historicAncient",
  "Nature & Scenery": "natureScenery",
  "Urban & Modern": "urbanModern",
  "Defense & Infrastructure": "defenseInfrastructure",
  "Commercial & Shops": "commercialShops",
  "Offices & Companies": "officesCompanies",
  "Infrastructure & Roads": "infrastructureRoads",
  "Buildings & Structures": "buildingsStructures"
};

export const FilterBar = ({ activeFilter, setFilter }: { activeFilter: string, setFilter: (c: string) => void }) => {
  const { t } = useLanguage();
  return (
    <div className="absolute top-20 left-0 w-full z-10 px-4 pointer-events-none">
      <div className="flex space-x-2 overflow-x-auto no-scrollbar pointer-events-auto pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-md backdrop-blur-md border ${
              activeFilter === cat 
                ? 'bg-deep-rose text-white border-deep-rose shadow-[0_0_15px_rgba(194,24,91,0.4)]' 
                : 'bg-white/80 text-deep-rose-dark border-pink-200 hover:bg-baby-pink'
            }`}
          >
            {t(categoryKeys[cat] || 'allPlaces')}
          </button>
        ))}
      </div>
    </div>
  );
};


