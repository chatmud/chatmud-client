import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { initServices } from './lib/services/init';

initServices();

const app = mount(App, {
  target: document.getElementById('app')!,
});

if (import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      onNeedRefresh() {
        window.location.reload();
      },
      onOfflineReady() {},
    });
  });
}

export default app;
