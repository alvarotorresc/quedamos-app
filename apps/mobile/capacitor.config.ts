import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.quedamos',
  appName: 'Quedamos',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Serve the WebView from the public host instead of `localhost`: hCaptcha degrades on a
    // localhost origin ("localhost detected" in logcat, random first-try failures in the
    // forgot-password flow). One-off cost: the origin change logs existing installs out once.
    hostname: 'quedamos.alvarotc.com',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#080E1A',
    },
  },
  android: {
    appendUrlToDeepLinkPaths: true,
  },
};

export default config;
