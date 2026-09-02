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
      seqRef.current += 1;
      setResults([]);
      return;
    }
    const seq = ++seqRef.current;
    const handle = setTimeout(() => {
      searchCities(query)
        .then((found) => {
          if (seq === seqRef.current) setResults(found);
        })
        .catch(() => {
          if (seq === seqRef.current) setResults([]);
        });
    }, delay);
    return () => clearTimeout(handle);
  }, [query, minChars, delay]);

  return results;
}
