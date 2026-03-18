export function getGoogleMapsUrl(location: string, lat?: number, lon?: number): string {
  if (lat != null && lon != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

export function openInMaps(location: string, lat?: number, lon?: number): void {
  window.open(getGoogleMapsUrl(location, lat, lon), '_blank');
}

export function hasCoordinates(lat?: number, lon?: number): boolean {
  return lat != null && lon != null;
}
