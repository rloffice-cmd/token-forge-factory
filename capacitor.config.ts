import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c789e62a6c804817af6a864347682163',
  appName: 'Money Machine',
  webDir: 'dist',
  server: {
    url: 'https://c789e62a-6c80-4817-af6a-864347682163.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
