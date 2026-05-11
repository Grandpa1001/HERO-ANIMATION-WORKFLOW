import fs from "fs";
import chokidar from "chokidar";
import { getHeroesRoot } from "@/lib/paths";

type Listener = () => void;

class FileWatcherHub {
  private watcher: ReturnType<typeof chokidar.watch> | null = null;
  private readonly listeners = new Set<Listener>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(cb: Listener): () => void {
    if (this.destroyTimer) {
      clearTimeout(this.destroyTimer);
      this.destroyTimer = null;
    }
    this.ensureWatcher();
    this.listeners.add(cb);
    return () => this.unsubscribe(cb);
  }

  private unsubscribe(cb: Listener) {
    this.listeners.delete(cb);
    if (this.listeners.size === 0) {
      this.destroyTimer = setTimeout(() => {
        if (this.listeners.size === 0) {
          void this.destroyWatcher();
        }
      }, 4000);
    }
  }

  private notify() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.listeners.forEach((l) => {
        try {
          l();
        } catch {
          /* ignore */
        }
      });
    }, 400);
  }

  private ensureWatcher() {
    if (this.watcher) return;
    const root = getHeroesRoot();
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
    }
    this.watcher = chokidar.watch(root, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 2000 },
    });
    this.watcher.on("add", () => this.notify());
    this.watcher.on("change", () => this.notify());
    this.watcher.on("unlink", () => this.notify());
  }

  private async destroyWatcher() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}

const globalForWatcher = globalThis as typeof globalThis & {
  __heroFileWatcherHub?: FileWatcherHub;
};

export function getFileWatcherHub(): FileWatcherHub {
  if (!globalForWatcher.__heroFileWatcherHub) {
    globalForWatcher.__heroFileWatcherHub = new FileWatcherHub();
  }
  return globalForWatcher.__heroFileWatcherHub;
}
