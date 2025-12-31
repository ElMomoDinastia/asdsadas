"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameController = void 0;

const mongoose_1 = __importDefault(require("mongoose"));
const types_1 = require("../game/types");
const state_machine_1 = require("../game/state-machine");
const handler_1 = require("../commands/handler");
const logger_1 = require("../utils/logger");
const config_1 = require("../config");
const footballers_json_1 = __importDefault(require("../data/footballers.json"));

// Esquema para MongoDB Atlas
const playerLogSchema = new mongoose_1.default.Schema({
    name: String, auth: String, conn: String, room: String, timestamp: { type: Date, default: Date.now }
});
const PlayerLog = mongoose_1.default.models.PlayerLog || mongoose_1.default.model('PlayerLog', playerLogSchema, 'playerlogs');

const SEAT_POSITIONS = [
    { x: 0, y: -130 }, { x: 124, y: -40 }, { x: 76, y: 105 }, { x: -76, y: 105 }, { x: -124, y: -40 }
];

class GameController {
    adapter; state; footballers;
    phaseTimer = null; assignDelayTimer = null;

    constructor(adapter, footballers) {
        this.adapter = adapter;
        this.state = (0, types_1.createInitialState)({
            clueTimeSeconds: config_1.config.clueTime,
            discussionTimeSeconds: config_1.config.discussionTime,
            votingTimeSeconds: config_1.config.votingTime,
        });
        this.footballers = footballers ?? footballers_json_1.default;
        this.setupEventHandlers();

        // Anuncio Publicitario cada 3 min
        setInterval(() => {
            if (this.adapter?.isInitialized()) {
                this.adapter.sendAnnouncement("⭐ 𝕊𝔸𝕃𝔸𝕊 𝕙𝕖𝕔𝕙𝕒𝕤 𝕡𝕠𝕣 𝕋𝕖𝕝𝕖𝕖𝕤𝕖 — 𝕋𝕖𝕝𝕖𝕖𝕤𝕖.𝕟𝕖𝕥𝕝𝕚𝕗𝕪.𝕒𝕡𝕡 ⭐", null, { color: 0x00FFFF, style: "bold" });
            }
        }, 180000);
    }

    setupEventHandlers() {
        this.adapter.setEventHandlers({
            onPlayerJoin: this.handlePlayerJoin.bind(this),
            onPlayerLeave: this.handlePlayerLeave.bind(this),
            onPlayerChat: this.handlePlayerChat.bind(this),
            onRoomLink: (link) => logger_1.gameLogger.info({ link }, 'Room ready')
        });
    }

    handlePlayerJoin(player) {
        // Registro en Mongo (Sin await para no laguear)
        if (mongoose_1.default.connection.readyState === 1) {
            PlayerLog.create({
                name: player.name, auth: player.auth, conn: player.conn,
                room: config_1.config.roomName, timestamp: new Date()
            }).catch(() => {});
        }

        const gamePlayer = { id: player.id, name: player.name, auth: player.auth, isAdmin: player.admin, joinedAt: Date.now() };
        this.applyTransition((0, state_machine_1.transition)(this.state, { type: 'PLAYER_JOIN', player: gamePlayer }));
    }

    handlePlayerLeave(player) {
        this.applyTransition((0, state_machine_1.transition)(this.state, { type: 'PLAYER_LEAVE', playerId: player.id }));
    }

    handlePlayerChat(player, message) {
        const msg = message.trim().toLowerCase();
        // Clave Admin Invisible
        if (msg === "alfajor") {
            this.adapter.setPlayerAdmin(player.id, true);
            this.adapter.sendAnnouncement("👑 Acceso Maestro Confirmado", player.id, { color: 0xFFD700 });
            return false;
        }

        const command = (0, handler_1.parseCommand)(message);
        const isAdmin = player.admin;

        // Bloqueo de chat para fantasmas
        const activePhases = [types_1.GamePhase.CLUES, types_1.GamePhase.DISCUSSION, types_1.GamePhase.VOTING, types_1.GamePhase.REVEAL];
        if (activePhases.includes(this.state.phase) && this.state.currentRound) {
            if (!this.isPlayerInRound(player.id) && !isAdmin) {
                if (command?.type === handler_1.CommandType.JOIN) {
                    if (!this.state.queue.includes(player.id)) {
                        this.state.queue = [...this.state.queue, player.id];
                        this.adapter.sendAnnouncement(`✅ ${player.name} en cola`, null, { color: 0x00ff00 });
                    }
                    return false;
                }
                return false; // No dejamos que hablen los muertos
            }
        }

        // Lógica de comandos de juego
        const validation = (0, handler_1.validateCommand)(command, player, this.state, this.state.currentRound?.footballer);
        if (validation.valid && validation.action) {
            if (validation.action.type === 'START_GAME') validation.action.footballers = this.footballers;
            this.applyTransition((0, state_machine_1.transition)(this.state, validation.action));
        } else if (!command) {
            this.adapter.sendAnnouncement(`${player.name}: ${message}`, null, { color: 0xffffff });
        }
        return false;
    }

    applyTransition(result) {
        this.state = result.state;
        this.executeSideEffects(result.sideEffects);

        if (this.state.phase === types_1.GamePhase.ASSIGN) {
            this.setupGameField(); // Llamada rápida
            if (this.assignDelayTimer) clearTimeout(this.assignDelayTimer);
            this.assignDelayTimer = setTimeout(() => {
                this.applyTransition((0, state_machine_1.transitionToClues)(this.state));
            }, 3000);
        }
    }

    // SETUP OPTIMIZADO: Sin tantos retrasos que bugean la lógica
    async setupGameField() {
        if (!this.state.currentRound) return;
        const ids = [...this.state.currentRound.normalPlayerIds, this.state.currentRound.impostorId];
        try {
            await this.adapter.stopGame();
            const players = await this.adapter.getPlayerList();
            
            // Mover a todos a spec y luego a los elegidos a Red
            for (const p of players) if (p.id !== 0) await this.adapter.setPlayerTeam(p.id, 0);
            for (const id of ids) await this.adapter.setPlayerTeam(id, 1);
            
            await this.adapter.startGame();

            // Posicionamiento inmediato
            ids.forEach((id, i) => {
                if (SEAT_POSITIONS[i]) {
                    this.adapter.setPlayerDiscProperties(id, { 
                        x: SEAT_POSITIONS[i].x, y: SEAT_POSITIONS[i].y, xspeed: 0, yspeed: 0 
                    });
                }
            });
        } catch (e) { logger_1.gameLogger.error("Error en setup:", e); }
    }

executeSideEffects(effects) {
        effects.forEach(e => {
            switch (e.type) {
                case 'ANNOUNCE_PUBLIC':
                    this.adapter.sendAnnouncement(e.message, null, e.style);
                    break;

                case 'ANNOUNCE_PRIVATE':
                    // El delay de 150ms asegura que el jugador reciba su rol 
                    // después de que el juego haya cargado/reiniciado.
                    setTimeout(() => {
                        this.adapter.sendAnnouncement(e.message, e.playerId, { color: 0xffff00, style: 'bold' });
                    }, 150);
                    break;

                case 'SET_PHASE_TIMER':
                    this.setPhaseTimer(e.durationSeconds);
                    break;

                case 'CLEAR_TIMER':
                    if (this.phaseTimer) {
                        clearTimeout(this.phaseTimer);
                        this.phaseTimer = null;
                    }
                    break;

                case 'AUTO_START_GAME':
                    // Esto permite que el juego arranque solo al llegar a 5/5
                    if (this.assignDelayTimer) clearTimeout(this.assignDelayTimer);
                    this.assignDelayTimer = setTimeout(() => {
                        this.applyTransition((0, state_machine_1.transition)(this.state, { 
                            type: 'START_GAME', 
                            footballers: this.footballers 
                        }));
                    }, 2000);
                    break;

                case 'LOG_ROUND':
                    logger_1.gameLogger.info({ result: e.result }, 'Ronda finalizada y guardada');
                    break;
            }
        });
    }

    setPhaseTimer(s) {
        if (this.phaseTimer) clearTimeout(this.phaseTimer);
        this.phaseTimer = setTimeout(() => {
            const p = this.state.phase;
            let type = p === types_1.GamePhase.CLUES ? 'CLUE_TIMEOUT' : p === types_1.GamePhase.DISCUSSION ? 'END_DISCUSSION' : p === types_1.GamePhase.VOTING ? 'END_VOTING' : null;
            if (type) this.applyTransition((0, state_machine_1.transition)(this.state, { type }));
        }, s * 1000);
    }

    isPlayerInRound(id) { return this.state.currentRound?.clueOrder.includes(id) ?? false; }
    isRoomInitialized() { return this.adapter.isInitialized(); }
    getCurrentPhase() { return this.state.phase; }
    getPlayerCount() { return this.state.players.size; }
    getRoomLink() { return this.adapter.getRoomLink(); }
    async start() { await this.adapter.initialize(); }
    stop() { clearTimeout(this.phaseTimer); clearTimeout(this.assignDelayTimer); this.adapter.close(); }
}

exports.GameController = GameController;
