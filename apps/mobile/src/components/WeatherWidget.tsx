import { useTranslation } from 'react-i18next';
import type { WeatherData } from '../services/weather';

interface WeatherWidgetProps {
  weather: WeatherData[];
}

export function getWeatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}

export function getWeatherDescKey(code: number): string {
  if (code === 0) return 'weather.desc.clear';
  if (code <= 3) return 'weather.desc.partlyCloudy';
  if (code <= 48) return 'weather.desc.foggy';
  if (code <= 55) return 'weather.desc.drizzle';
  if (code <= 65) return 'weather.desc.rain';
  if (code <= 75) return 'weather.desc.snow';
  if (code <= 82) return 'weather.desc.showers';
  if (code <= 86) return 'weather.desc.snowShowers';
  return 'weather.desc.thunderstorm';
}

export function WeatherWidget({ weather }: WeatherWidgetProps) {
  const { t } = useTranslation();

  if (!weather || weather.length === 0) {
    return (
      <p className="text-[11px] text-text-dark">{t('weather.noData')}</p>
    );
  }

  // Group by city, show today's weather
  const today = new Date().toISOString().split('T')[0];
  const todayWeather = weather.filter((w) => w.date === today);

  if (todayWeather.length === 0) {
    return null;
  }

  // Deduplicate by city
  const seen = new Set<string>();
  const unique = todayWeather.filter((w) => {
    if (seen.has(w.city)) return false;
    seen.add(w.city);
    return true;
  });

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {unique.map((w) => (
        <div
          key={w.city}
          className="shrink-0 rounded-[12px] px-3 py-2 min-w-[120px]"
          style={{
            background: 'var(--app-bg-card)',
            border: '1px solid var(--app-border)',
          }}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-base">{getWeatherIcon(w.weatherCode)}</span>
            <span className="text-[11px] font-semibold text-text truncate">{w.city}</span>
          </div>
          <div className="text-[10px] text-text-muted">
            {Math.round(w.tempMax)}° / {Math.round(w.tempMin)}°
          </div>
          <div className="text-[9px] text-text-dark truncate">{t(getWeatherDescKey(w.weatherCode))}</div>
        </div>
      ))}
    </div>
  );
}

export function WeatherBadge({ weatherCode, tempMax }: { weatherCode: number; tempMax: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted">
      {getWeatherIcon(weatherCode)} {Math.round(tempMax)}°
    </span>
  );
}
