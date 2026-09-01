import { useState, useEffect, useRef } from 'react';
import { searchCities, type GeocodingResult } from '../services/weather';

/**
 * Debounced city search with a sequence guard so a late response from an
 * earlier query can never overwrite the results of a newer one.
 */
export function useCitySearch(query: string, minChars = 2, delay = 300): GeocodingResult[] {
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const seqRef = useRef(0);

  useEffect(() => {
    if (query.trim().length < minChars) {
      setResults([]);
      return;
    }
    const seq = ++seqRef.current;
    const handle = setTimeout(async () => {
      const found = await searchCities(query);
      if (seq === seqRef.current) setResults(found);
    }, delay);
    return () => clearTimeout(handle);
  }, [query, minChars, delay]);

  return results;
}
