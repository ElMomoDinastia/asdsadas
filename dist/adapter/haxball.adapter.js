"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HBRoomAdapter = void 0;
exports.createHBRoomAdapter = createHBRoomAdapter;

const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());

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

        try {
            this.browser = await puppeteer_extra_1.default.launch({
                headless: "new",
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                ],
            });
            this.page = await this.browser.newPage();
            
            await this.page.goto(HAXBALL_HEADLESS_URL, { waitUntil: 'networkidle0', timeout: 30000 });
            await this.page.waitForFunction('typeof HBInit === "function"', { timeout: 30000 });

            /* ───────────── CONFIGURACIÓN DE TELEESE PROJECT ───────────── */
            
            const roomNumber = this.config.roomNumber || 0;
            const isDecorativo = this.config.isHeader || this.config.isFooter;
            
            let finalName = "";
            if (this.config.isHeader) {
                finalName = "◢◤━━━━━━━  𝙏𝙀𝙇𝙀𝙀𝙎𝙀 𝙋𝙍𝙊𝙅𝙀𝘾𝙏  ━━━━━━━◥◣";
            } else if (this.config.isFooter) {
                finalName = "◥◣━━━━━━  ᴅsᴄ.ɢɢ/ᴄʜɪɴᴏᴄɪᴛʏ  ━━━━━━◢◤";
            } else {
                const fancyNums = ["𝟬𝟬", "𝟬𝟭", "𝟬𝟮", "𝟬𝟯", "𝟬𝟰", "𝟬𝟱"];
                const n = fancyNums[roomNumber] || roomNumber;
                finalName = `▌  🔴   »  「 𝙄𝙈𝙋𝙊𝙎𝙏𝙊𝙍 」  𝙎-${n}  «  ▐`;
            }
          
            const latBase = -34.501026; 
            const lonBase = -58.442214;
            const gap = 0.0002; 

            const roomConfig = {
                roomName: finalName,
                maxPlayers: isDecorativo ? 2 : (this.config.maxPlayers || 15),
                noPlayer: false,
                token: this.config.token || '',
                public: this.config.public ?? true,
                password: this.config.password || null,
                geo: { 
                    "code": "ar", 
                    "lat": latBase, 
                    "lon": lonBase - (roomNumber * gap) 
                }
            };

            /* ───────────── INYECCIÓN Y CREACIÓN ───────────── */

            const roomLink = await this.page.evaluate(async (config, isDeco) => {
                return new Promise((resolve, reject) => {
                    try {
                        const room = HBInit(config);
                        window.__haxRoom = room;
                        window.__haxEvents = [];

                        room.onRoomLink = (link) => resolve(link);

                        room.onPlayerJoin = (player) => {
                            if (isDeco) {
                                room.kickPlayer(player.id, "SALA INFORMATIVA - TELEESE PROJECT", false);
                            } else {
                                window.__haxEvents.push({ type: 'playerJoin', player });
                            }
                        };

                        room.onPlayerLeave = (player) => {
                            if (!isDeco) window.__haxEvents.push({ type: 'playerLeave', player });
                        };

                        room.onPlayerChat = (player, message) => {
                            if (isDeco) return false;
                            window.__haxEvents.push({ type: 'playerChat', player, message });
                            return false;
                        };

                        setTimeout(() => reject(new Error('Timeout en link')), 60000);
                    } catch (err) { reject(err); }
                });
            }, roomConfig, isDecorativo);

            this.roomLink = roomLink;
            this.initialized = true;

            if (!isDecorativo) {
                await this.loadDefaultStadium();
                this.startEventPolling();
            } else {
                await this.page.evaluate(() => {
                    window.__haxRoom?.setTeamsLock(true);
                    window.__haxRoom?.setTimeLimit(0);
                });
            }

            if (this.handlers.onRoomLink) this.handlers.onRoomLink(roomLink);
            logger_1.roomLogger.info({ link: roomLink, room: finalName }, '✅ Sala publicada');

        } catch (error) {
            logger_1.roomLogger.error('Error inicializando:', error);
            await this.close();
            throw error;
        }
    }

    async loadDefaultStadium() {
        if (!this.page) return;
        try {
            const stadium = JSON.stringify({
                "name": "Mesa Impostor by Teleese",
                "width": 400, "height": 400,
                "bg": { "type": "grass", "width": 400, "height": 400, "kickOffRadius": 0 },
                "discs": [
                    { "pos": [0, -130], "radius": 30, "invMass": 0, "color": "transparent", "cGroup": ["c0"], "cMask": ["ball"] },
                    { "pos": [124, -40], "radius": 30, "invMass": 0, "color": "transparent", "cGroup": ["c0"], "cMask": ["ball"] },
                    { "pos": [76, 105], "radius": 30, "invMass": 0, "color": "transparent", "cGroup": ["c0"], "cMask": ["ball"] },
                    { "pos": [-76, 105], "radius": 30, "invMass": 0, "color": "transparent", "cGroup": ["c0"], "cMask": ["ball"] },
                    { "pos": [-124, -40], "radius": 30, "invMass": 0, "color": "transparent", "cGroup": ["c0"], "cMask": ["ball"] },
                    { "pos": [0, 0], "radius": 35, "invMass": 0, "color": "2D3748", "cGroup": ["wall"], "cMask": ["all"] }
                ],
                "spawnDistance": 0, "spawns": [{ "x": 0, "y": 0, "team": "red" }], "balls": [{ "pos": [0, 0], "color": "FFFFFF" }]
            });
            await this.page.evaluate((s) => window.__haxRoom?.setCustomStadium(s), stadium);
        } catch (e) { logger_1.roomLogger.error('Error stadium'); }
    }

    startEventPolling() {
        this.pollingInterval = setInterval(async () => {
            if (!this.page) return;
            try {
                const events = await this.page.evaluate(() => {
                    const evts = window.__haxEvents || [];
                    window.__haxEvents = [];
                    return evts;
                });
                events.forEach(e => {
                    if (e.type === 'playerJoin') this.handlers.onPlayerJoin?.(e.player);
                    if (e.type === 'playerLeave') this.handlers.onPlayerLeave?.(e.player);
                    if (e.type === 'playerChat') this.handlers.onPlayerChat?.(e.player, e.message);
                });
            } catch (err) {}
        }, 100);
    }

    /* ───────────── MÉTODOS DE API ───────────── */

    async sendChat(msg, id) { await this.page?.evaluate((m, i) => window.__haxRoom?.sendChat(m, i), msg, id); }
    async kickPlayer(id, r, b) { await this.page?.evaluate((i, r, b) => window.__haxRoom?.kickPlayer(i, r, b), id, r, b); }
    async setPlayerAdmin(id, a) { await this.page?.evaluate((i, a) => window.__haxRoom?.setPlayerAdmin(i, a), id, a); }
    
    setEventHandlers(h) { this.handlers = h; }

    async close() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        if (this.page) await this.page.close().catch(() => {});
        if (this.browser) await this.browser.close().catch(() => {});
        this.initialized = false;
    }
}

exports.HBRoomAdapter = HBRoomAdapter;
function createHBRoomAdapter(config) {
    return new HBRoomAdapter(config);
}
