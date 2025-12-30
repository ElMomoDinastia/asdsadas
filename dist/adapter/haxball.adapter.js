"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HBRoomAdapter = void 0;
exports.createHBRoomAdapter = createHBRoomAdapter;
const puppeteer_1 = __importDefault(require("puppeteer"));
const logger_1 = require("../utils/logger");
const HAXBALL_HEADLESS_URL = 'https://www.haxball.com/headless';
class HBRoomAdapter {
    browser = null;
    page = null;
    roomLink = null;
    handlers = {};
    config;
    initialized = false;
    pollingInterval = null;
    constructor(config) {
        this.config = config;
    }
    async initialize() {
        if (this.initialized) {
            logger_1.roomLogger.warn('Room adapter already initialized');
            return;
        }
        logger_1.roomLogger.info({ roomName: this.config.roomName }, 'Initializing HaxBall room with Puppeteer...');
        try {
            this.browser = await puppeteer_1.default.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-features=WebRtcHideLocalIpsWithMdns',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--use-fake-ui-for-media-stream',
                    '--use-fake-device-for-media-stream',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins',
                    '--disable-site-isolation-trials',
                    '--ignore-certificate-errors',
                    '--allow-running-insecure-content',
                ],
            });
            this.page = await this.browser.newPage();
            this.page.on('console', (msg) => {
                const text = msg.text();
                if (text.includes('[HaxBall]')) {
                    logger_1.roomLogger.debug({ browserLog: text }, 'Browser console');
                }
            });
            // esto
            logger_1.roomLogger.info('Navigating to HaxBall headless page...');
            await this.page.goto(HAXBALL_HEADLESS_URL, { waitUntil: 'networkidle0', timeout: 30000 });
            await this.page.waitForFunction('typeof HBInit === "function"', { timeout: 30000 });
            logger_1.roomLogger.info('HBInit API is ready');
            const roomConfig = {
                roomName: this.config.roomName,
                maxPlayers: this.config.maxPlayers,
                noPlayer: this.config.noPlayer,
                token: this.config.token || '',
                public: this.config.public ?? true,
                password: this.config.password || null,
            };
            // Initialize the room
            logger_1.roomLogger.info({ config: { ...roomConfig, token: '[REDACTED]' } }, 'Creating HaxBall room...');
            const roomLink = await this.page.evaluate(async (config) => {
                return new Promise((resolve, reject) => {
                    try {
                        // @ts-expect-error HBInit is global in HaxBall headless page
                        const room = HBInit(config);
                        // Store room globally for later access
                        // @ts-expect-error Setting global for communication
                        window.__haxRoom = room;
                        // @ts-expect-error Setting global for events
                        window.__haxEvents = [];
                        // Set up event collection
                        room.onPlayerJoin = (player) => {
                            // @ts-expect-error Global access
                            window.__haxEvents.push({ type: 'playerJoin', player });
                        };
                        room.onPlayerLeave = (player) => {
                            // @ts-expect-error Global access
                            window.__haxEvents.push({ type: 'playerLeave', player });
                        };
                        room.onPlayerChat = (player, message) => {
                            // @ts-expect-error Global access
                            window.__haxEvents.push({ type: 'playerChat', player, message });
                            // Return false to block all messages - we'll echo allowed ones via sendAnnouncement
                            return false;
                        };
                        room.onRoomLink = (link) => {
                            resolve(link);
                        };
                        // Fallback timeout
                        setTimeout(() => {
                            reject(new Error('Timeout waiting for room link'));
                        }, 60000);
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            }, roomConfig);
            this.roomLink = roomLink;
            this.initialized = true;
            logger_1.roomLogger.info({ link: roomLink }, '🎮 HaxBall room created successfully!');
            // Load the custom Impostor stadium immediately
            await this.loadDefaultStadium();
            // Start event polling
            this.startEventPolling();
            // Notify handler
            if (this.handlers.onRoomLink) {
                this.handlers.onRoomLink(roomLink);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // eslint-disable-next-line no-console
            console.error('HaxBall room initialization error:', error);
            logger_1.roomLogger.error({ error: errorMessage }, 'Failed to initialize HaxBall room');
            await this.close();
            throw error;
        }
    }
    async loadDefaultStadium() {
        if (!this.page)
            return;
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
            logger_1.roomLogger.info('Custom Impostor stadium loaded');
        }
        catch (error) {
            logger_1.roomLogger.error({ error }, 'Failed to load default stadium');
        }
    }
    startEventPolling() {
        // Poll for events from the browser every 100ms
        this.pollingInterval = setInterval(async () => {
            if (!this.page || !this.initialized)
                return;
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
            }
            catch (error) {
                // Page might be closed
                logger_1.roomLogger.debug('Event polling error (page may be closed)');
            }
        }, 100);
    }
    handleEvent(event) {
        switch (event.type) {
            case 'playerJoin':
                if (event.player) {
                    logger_1.roomLogger.info({ playerId: event.player.id, name: event.player.name }, 'Player joined');
                    this.handlers.onPlayerJoin?.(event.player);
                }
                break;
            case 'playerLeave':
                if (event.player) {
                    logger_1.roomLogger.info({ playerId: event.player.id, name: event.player.name }, 'Player left');
                    this.handlers.onPlayerLeave?.(event.player);
                }
                break;
            case 'playerChat':
                if (event.player && event.message !== undefined) {
                    logger_1.roomLogger.debug({ playerId: event.player.id, message: event.message }, 'Player chat');
                    this.handlers.onPlayerChat?.(event.player, event.message);
                }
                break;
        }
    }
    isInitialized() {
        return this.initialized;
    }
    getRoomLink() {
        return this.roomLink;
    }
    async getPlayerList() {
        if (!this.page || !this.initialized)
            return [];
        try {
            return await this.page.evaluate(() => {
                // @ts-expect-error Global access  
                return window.__haxRoom?.getPlayerList() || [];
            });
        }
        catch {
            return [];
        }
    }
    async getPlayer(id) {
        if (!this.page || !this.initialized)
            return null;
        try {
            return await this.page.evaluate((playerId) => {
                // @ts-expect-error Global access
                return window.__haxRoom?.getPlayer(playerId) || null;
            }, id);
        }
        catch {
            return null;
        }
    }
    async setPlayerAdmin(playerId, admin) {
        if (!this.page || !this.initialized)
            return;
        try {
            await this.page.evaluate((id, isAdmin) => {
                // @ts-expect-error Global access
                window.__haxRoom?.setPlayerAdmin(id, isAdmin);
            }, playerId, admin);
        }
        catch (error) {
            logger_1.roomLogger.error({ playerId, error }, 'Failed to set player admin');
        }
    }
    async setPlayerTeam(playerId, team) {
        if (!this.page || !this.initialized)
            return;
        try {
            await this.page.evaluate((id, t) => {
                // @ts-expect-error Global access
                window.__haxRoom?.setPlayerTeam(id, t);
            }, playerId, team);
        }
        catch (error) {
            logger_1.roomLogger.error({ playerId, error }, 'Failed to set player team');
        }
    }
    async kickPlayer(playerId, reason, ban = false) {
        if (!this.page || !this.initialized)
            return;
        try {
            await this.page.evaluate((id, r, b) => {
                // @ts-expect-error Global access
                window.__haxRoom?.kickPlayer(id, r, b);
            }, playerId, reason, ban);
        }
        catch (error) {
            logger_1.roomLogger.error({ playerId, error }, 'Failed to kick player');
        }
    }
    async sendChat(message, targetId) {
        if (!this.page || !this.initialized)
            return;
        try {
            await this.page.evaluate((msg, tid) => {
                // @ts-expect-error Global access
                window.__haxRoom?.sendChat(msg, tid);
            }, message, targetId);
        }
        catch (error) {
            logger_1.roomLogger.error({ error }, 'Failed to send chat');
        }
    }
    async sendAnnouncement(message, targetId, options) {
        if (!this.page || !this.initialized)
            return;
        try {
            await this.page.evaluate((msg, tid, opts) => {
                // @ts-expect-error Global access
                window.__haxRoom?.sendAnnouncement(msg, tid, opts?.color, opts?.style, opts?.sound);
            }, message, targetId, options);
        }
        catch (error) {
            logger_1.roomLogger.error({ error }, 'Failed to send announcement');
        }
    }
    setEventHandlers(handlers) {
        this.handlers = handlers;
    }
    async setCustomStadium(stadium) {
        if (!this.page || !this.initialized)
            return;
        try {
            await this.page.evaluate((stadiumJson) => {
                // @ts-expect-error Global access
                window.__haxRoom?.setCustomStadium(stadiumJson);
            }, stadium);
        }
        catch (error) {
            logger_1.roomLogger.error({ error }, 'Failed to set custom stadium');
        }
    }
    async setPlayerDiscProperties(playerId, props) {
        if (!this.page || !this.initialized)
            return;
        try {
            await this.page.evaluate((id, properties) => {
                // @ts-expect-error Global access
                window.__haxRoom?.setPlayerDiscProperties(id, properties);
            }, playerId, props);
        }
        catch (error) {
            logger_1.roomLogger.error({ playerId, error }, 'Failed to set player disc properties');
        }
    }
    async startGame() {
        if (!this.page || !this.initialized)
            return;
        try {
            await this.page.evaluate(() => {
                // @ts-expect-error Global access
                window.__haxRoom?.startGame();
            });
        }
        catch (error) {
            logger_1.roomLogger.error({ error }, 'Failed to start game');
        }
    }
    async stopGame() {
        if (!this.page || !this.initialized)
            return;
        try {
            await this.page.evaluate(() => {
                // @ts-expect-error Global access
                window.__haxRoom?.stopGame();
            });
        }
        catch (error) {
            logger_1.roomLogger.error({ error }, 'Failed to stop game');
        }
    }
    async setTeamsLock(locked) {
        if (!this.page || !this.initialized)
            return;
        try {
            await this.page.evaluate((isLocked) => {
                // @ts-expect-error Global access
                window.__haxRoom?.setTeamsLock(isLocked);
            }, locked);
            logger_1.roomLogger.info({ locked }, 'Teams lock set');
        }
        catch (error) {
            logger_1.roomLogger.error({ error }, 'Failed to set teams lock');
        }
    }
    async close() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        if (this.page) {
            try {
                await this.page.close();
            }
            catch {
                // Ignore close errors
            }
            this.page = null;
        }
        if (this.browser) {
            try {
                await this.browser.close();
            }
            catch {
                // Ignore close errors
            }
            this.browser = null;
        }
        this.roomLink = null;
        this.initialized = false;
        logger_1.roomLogger.info('Room adapter closed');
    }
}
exports.HBRoomAdapter = HBRoomAdapter;
/**
 * Factory function to create real HaxBall adapter
 */
function createHBRoomAdapter(config) {
    return new HBRoomAdapter(config);
}
//# sourceMappingURL=haxball.adapter.js.map