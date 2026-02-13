import { useEffect, useRef } from 'react';

export function useScrollAnimation<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Immediately check if element is already in viewport
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 100) {
      el.classList.add('landing-visible');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('landing-visible');
          observer.unobserve(el);
        }
      },
      { threshold: 0, rootMargin: '100px' },
    );

    observer.observe(el);

    // Fallback: make visible after 2s regardless
    const timeout = setTimeout(() => {
      el.classList.add('landing-visible');
    }, 2000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, []);

  return ref;
}
