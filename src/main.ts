// Point d'entrée : charge la sauvegarde locale et lance l'interface.
import './ui/styles.css';
import { audio } from './audio/audio';
import { Game } from './meta/game';
import { MemoryStore, type KeyValueStore } from './meta/save';
import { App } from './ui/app';
import './ui/screens/home';
import './ui/screens/battle';
import './ui/screens/collection';
import './ui/screens/shop';
import './ui/screens/chests';
import './ui/screens/pass';
import './ui/screens/events';
import './ui/screens/profile';

function storage(): KeyValueStore {
  try {
    const k = '__se_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return new MemoryStore(); // stockage indisponible : la partie fonctionne mais n'est pas persistée
  }
}

const mount = document.getElementById('app')!;
try {
  const game = new Game(storage());
  audio.setVolumes(game.data.settings.music, game.data.settings.sfx);
  const unlock = () => { audio.unlock(); audio.setVolumes(game.data.settings.music, game.data.settings.sfx); audio.startMusic(app.current === 'battle' ? 'battle' : 'menu'); };
  window.addEventListener('pointerdown', unlock, { once: true });
  const app = new App(game, mount);
  app.go('home');
  document.addEventListener('visibilitychange', () => { if (document.hidden) { game.persist(); audio.suspend(); } else audio.resume(); });
  (window as unknown as { __game: Game; __app: App }).__game = game;
  (window as unknown as { __game: Game; __app: App }).__app = app;
} catch (e) {
  mount.innerHTML = `<div class="boot" style="padding:20px;text-align:center">Erreur au démarrage : ${(e as Error).message}</div>`;
  throw e;
}
