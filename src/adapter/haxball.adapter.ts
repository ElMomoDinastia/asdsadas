/**
 * Real HaxBall Room Adapter using Puppeteer + Native HBInit API
 * 
 * This adapter launches a headless Chrome browser, navigates to the
 * HaxBall headless page, and interacts with the native HBInit API.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import {
  IHBRoomAdapter,
  HBPlayer,
  RoomConfig,
  RoomEventHandlers,
  AnnouncementOptions,
  PlayerDiscProperties,
} from './types';
import { roomLogger } from '../utils/logger';

const HAXBALL_HEADLESS_URL = 'https://www.haxball.com/headless';

/**
 * Real implementation of IHBRoomAdapter using Puppeteer
 */
export class HBRoomAdapter implements IHBRoomAdapter {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private roomLink: string | null = null;
  private handlers: RoomEventHandlers = {};
  private config: RoomConfig;
  private initialized: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(config: RoomConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      roomLogger.warn('Room adapter already initialized');
      return;
    }

    roomLogger.info({ roomName: this.config.roomName }, 'Initializing HaxBall room with Puppeteer...');

    try {
      // Launch headless browser
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-features=WebRtcHideLocalIpsWithMdns',
          '--disable-gpu',
          '--disable-software-rasterizer',
        ],
      });

      this.page = await this.browser.newPage();

      // Set up console message forwarding
      this.page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('[HaxBall]')) {
          roomLogger.debug({ browserLog: text }, 'Browser console');
        }
      });

      // Navigate to HaxBall headless page
      roomLogger.info('Navigating to HaxBall headless page...');
      await this.page.goto(HAXBALL_HEADLESS_URL, { waitUntil: 'networkidle0', timeout: 30000 });

      // Wait for HBInit to be available
      await this.page.waitForFunction('typeof HBInit === "function"', { timeout: 30000 });
      roomLogger.info('HBInit API is ready');

      // Create room configuration for HBInit
      const roomConfig = {
        roomName: this.config.roomName,
        maxPlayers: this.config.maxPlayers,
        noPlayer: this.config.noPlayer,
        token: this.config.token || '',
        public: this.config.public ?? true,
        password: this.config.password || null,
      };

      // Initialize the room
      roomLogger.info({ config: { ...roomConfig, token: '[REDACTED]' } }, 'Creating HaxBall room...');

      const roomLink = await this.page.evaluate(async (config) => {
        return new Promise<string>((resolve, reject) => {
          try {
            // @ts-expect-error HBInit is global in HaxBall headless page
            const room = HBInit(config);

            // Store room globally for later access
            // @ts-expect-error Setting global for communication
            window.__haxRoom = room;
            // @ts-expect-error Setting global for events
            window.__haxEvents = [];

            // Set up event collection
            room.onPlayerJoin = (player: unknown) => {
              // @ts-expect-error Global access
              window.__haxEvents.push({ type: 'playerJoin', player });
            };
            room.onPlayerLeave = (player: unknown) => {
              // @ts-expect-error Global access
              window.__haxEvents.push({ type: 'playerLeave', player });
            };
            room.onPlayerChat = (player: unknown, message: string) => {
              // @ts-expect-error Global access
              window.__haxEvents.push({ type: 'playerChat', player, message });
              // Return false to block all messages - we'll echo allowed ones via sendAnnouncement
              return false;
            };
            room.onRoomLink = (link: string) => {
              resolve(link);
            };

            // Fallback timeout
            setTimeout(() => {
              reject(new Error('Timeout waiting for room link'));
            }, 60000);
          } catch (err) {
            reject(err);
          }
        });
      }, roomConfig);

      this.roomLink = roomLink;
      this.initialized = true;
      roomLogger.info({ link: roomLink }, '🎮 HaxBall room created successfully!');

      // Load the custom Impostor stadium immediately
      await this.loadDefaultStadium();

      // Start event polling
      this.startEventPolling();

      // Notify handler
      if (this.handlers.onRoomLink) {
        this.handlers.onRoomLink(roomLink);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error('HaxBall room initialization error:', error);
      roomLogger.error({ error: errorMessage }, 'Failed to initialize HaxBall room');
      await this.close();
      throw error;
    }
  }

  private async loadDefaultStadium(): Promise<void> {
    if (!this.page) return;
    
    try {
      // Load the Impostor stadium JSON
      const stadiumJson = JSON.stringify({
        "name": "Mesa Impostor PRO 5P",
        "width": 400,
        "height": 400,
        "spawnDistance": 0,
        "bg": { "type": "grass", "width": 400, "height": 400, "kickOffRadius": 0 },
        "playerPhysics": {
          "radius": 15,
          "acceleration": 0,
          "kickingAcceleration": 0,
          "kickStrength": 12,
          "damping": 0.96,
          "invMass": 0.5,
          "kickingDamping": 0.96
        },
        "ballPhysics": { "radius": 10, "invMass": 0.5, "damping": 0.99, "color": "FFFFFF" },
        "vertexes": [],
        "segments": [],
        "discs": [
          { "pos": [0, -130], "radius": 30, "invMass": 0, "color": "transparent", "cGroup": ["c0"], "cMask": ["ball"] },
          { "pos": [124, -40], "radius": 30, "invMass": 0, "color": "transparent", "cGroup": ["c0"], "cMask": ["ball"] },
          { "pos": [76, 105], "radius": 30, "invMass": 0, "color": "transparent", "cGroup": ["c0"], "cMask": ["ball"] },
          { "pos": [-76, 105], "radius": 30, "invMass": 0, "color": "transparent", "cGroup": ["c0"], "cMask": ["ball"] },
          { "pos": [-124, -40], "radius": 30, "invMass": 0, "color": "transparent", "cGroup": ["c0"], "cMask": ["ball"] },
          { "pos": [0, 0], "radius": 35, "invMass": 0, "color": "2D3748", "cGroup": ["wall"], "cMask": ["all"] }
        ],
        "planes": [
          { "normal": [0, 1], "dist": -400, "cMask": ["all"] },
          { "normal": [0, -1], "dist": -400, "cMask": ["all"] },
          { "normal": [1, 0], "dist": -400, "cMask": ["all"] },
          { "normal": [-1, 0], "dist": -400, "cMask": ["all"] }
        ],
        "goals": [],
        "spawns": [{ "x": 0, "y": 0, "team": "red" }],
        "balls": [{ "pos": [0, 0], "color": "FFFFFF" }],
        "traits": {}
      });

      await this.page.evaluate((stadium) => {
        // @ts-expect-error Global access
        window.__haxRoom?.setCustomStadium(stadium);
      }, stadiumJson);
      
      roomLogger.info('Custom Impostor stadium loaded');
    } catch (error) {
      roomLogger.error({ error }, 'Failed to load default stadium');
    }
  }

  private startEventPolling(): void {
    // Poll for events from the browser every 100ms
    this.pollingInterval = setInterval(async () => {
      if (!this.page || !this.initialized) return;

      try {
        const events = await this.page.evaluate(() => {
          // @ts-expect-error Global access
          const evts = window.__haxEvents || [];
          // @ts-expect-error Global access
          window.__haxEvents = [];
          return evts;
        });

        for (const event of events) {
          this.handleEvent(event);
        }
      } catch (error) {
        // Page might be closed
        roomLogger.debug('Event polling error (page may be closed)');
      }
    }, 100);
  }

  private handleEvent(event: { type: string; player?: HBPlayer; message?: string }): void {
    switch (event.type) {
      case 'playerJoin':
        if (event.player) {
          roomLogger.info({ playerId: event.player.id, name: event.player.name }, 'Player joined');
          this.handlers.onPlayerJoin?.(event.player);
        }
        break;
      case 'playerLeave':
        if (event.player) {
          roomLogger.info({ playerId: event.player.id, name: event.player.name }, 'Player left');
          this.handlers.onPlayerLeave?.(event.player);
        }
        break;
      case 'playerChat':
        if (event.player && event.message !== undefined) {
          roomLogger.debug({ playerId: event.player.id, message: event.message }, 'Player chat');
          this.handlers.onPlayerChat?.(event.player, event.message);
        }
        break;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getRoomLink(): string | null {
    return this.roomLink;
  }

  async getPlayerList(): Promise<HBPlayer[]> {
    if (!this.page || !this.initialized) return [];
    try {
      return await this.page.evaluate(() => {
        // @ts-expect-error Global access  
        return window.__haxRoom?.getPlayerList() || [];
      });
    } catch {
      return [];
    }
  }

  async getPlayer(id: number): Promise<HBPlayer | null> {
    if (!this.page || !this.initialized) return null;
    try {
      return await this.page.evaluate((playerId) => {
        // @ts-expect-error Global access
        return window.__haxRoom?.getPlayer(playerId) || null;
      }, id);
    } catch {
      return null;
    }
  }

  async setPlayerAdmin(playerId: number, admin: boolean): Promise<void> {
    if (!this.page || !this.initialized) return;
    try {
      await this.page.evaluate((id, isAdmin) => {
        // @ts-expect-error Global access
        window.__haxRoom?.setPlayerAdmin(id, isAdmin);
      }, playerId, admin);
    } catch (error) {
      roomLogger.error({ playerId, error }, 'Failed to set player admin');
    }
  }

  async setPlayerTeam(playerId: number, team: number): Promise<void> {
    if (!this.page || !this.initialized) return;
    try {
      await this.page.evaluate((id, t) => {
        // @ts-expect-error Global access
        window.__haxRoom?.setPlayerTeam(id, t);
      }, playerId, team);
    } catch (error) {
      roomLogger.error({ playerId, error }, 'Failed to set player team');
    }
  }

  async kickPlayer(playerId: number, reason: string, ban: boolean = false): Promise<void> {
    if (!this.page || !this.initialized) return;
    try {
      await this.page.evaluate((id, r, b) => {
        // @ts-expect-error Global access
        window.__haxRoom?.kickPlayer(id, r, b);
      }, playerId, reason, ban);
    } catch (error) {
      roomLogger.error({ playerId, error }, 'Failed to kick player');
    }
  }

  async sendChat(message: string, targetId?: number): Promise<void> {
    if (!this.page || !this.initialized) return;
    try {
      await this.page.evaluate((msg, tid) => {
        // @ts-expect-error Global access
        window.__haxRoom?.sendChat(msg, tid);
      }, message, targetId);
    } catch (error) {
      roomLogger.error({ error }, 'Failed to send chat');
    }
  }

  async sendAnnouncement(
    message: string,
    targetId?: number | null,
    options?: AnnouncementOptions
  ): Promise<void> {
    if (!this.page || !this.initialized) return;
    try {
      await this.page.evaluate((msg, tid, opts) => {
        // @ts-expect-error Global access
        window.__haxRoom?.sendAnnouncement(
          msg,
          tid,
          opts?.color,
          opts?.style,
          opts?.sound
        );
      }, message, targetId, options);
    } catch (error) {
      roomLogger.error({ error }, 'Failed to send announcement');
    }
  }

  setEventHandlers(handlers: RoomEventHandlers): void {
    this.handlers = handlers;
  }

  async setCustomStadium(stadium: string): Promise<void> {
    if (!this.page || !this.initialized) return;
    try {
      await this.page.evaluate((stadiumJson) => {
        // @ts-expect-error Global access
        window.__haxRoom?.setCustomStadium(stadiumJson);
      }, stadium);
    } catch (error) {
      roomLogger.error({ error }, 'Failed to set custom stadium');
    }
  }

  async setPlayerDiscProperties(playerId: number, props: PlayerDiscProperties): Promise<void> {
    if (!this.page || !this.initialized) return;
    try {
      await this.page.evaluate((id, properties) => {
        // @ts-expect-error Global access
        window.__haxRoom?.setPlayerDiscProperties(id, properties);
      }, playerId, props);
    } catch (error) {
      roomLogger.error({ playerId, error }, 'Failed to set player disc properties');
    }
  }

  async startGame(): Promise<void> {
    if (!this.page || !this.initialized) return;
    try {
      await this.page.evaluate(() => {
        // @ts-expect-error Global access
        window.__haxRoom?.startGame();
      });
    } catch (error) {
      roomLogger.error({ error }, 'Failed to start game');
    }
  }

  async stopGame(): Promise<void> {
    if (!this.page || !this.initialized) return;
    try {
      await this.page.evaluate(() => {
        // @ts-expect-error Global access
        window.__haxRoom?.stopGame();
      });
    } catch (error) {
      roomLogger.error({ error }, 'Failed to stop game');
    }
  }

  async setTeamsLock(locked: boolean): Promise<void> {
    if (!this.page || !this.initialized) return;
    try {
      await this.page.evaluate((isLocked) => {
        // @ts-expect-error Global access
        window.__haxRoom?.setTeamsLock(isLocked);
      }, locked);
      roomLogger.info({ locked }, 'Teams lock set');
    } catch (error) {
      roomLogger.error({ error }, 'Failed to set teams lock');
    }
  }

  async close(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.page) {
      try {
        await this.page.close();
      } catch {
        // Ignore close errors
      }
      this.page = null;
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore close errors
      }
      this.browser = null;
    }

    this.roomLink = null;
    this.initialized = false;
    roomLogger.info('Room adapter closed');
  }
}

/**
 * Factory function to create real HaxBall adapter
 */
export function createHBRoomAdapter(config: RoomConfig): HBRoomAdapter {
  return new HBRoomAdapter(config);
}
