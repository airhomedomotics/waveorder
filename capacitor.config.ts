import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.waveorder.app',
  appName: 'WaveOrder',
  webDir: 'out',
  server: {
    url: 'https://waveorder.garganoadvisor.com/login',
    cleartext: true
  }
};

export default config;
