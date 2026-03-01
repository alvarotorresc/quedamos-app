export function getGoogleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

export function openInMaps(location: string): void {
  window.open(getGoogleMapsUrl(location), '_blank');
}
