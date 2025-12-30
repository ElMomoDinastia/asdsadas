export interface Config {
    haxballToken: string | undefined;
    roomName: string;
    maxPlayers: number;
    noPlayer: boolean;
    port: number;
    logLevel: string;
    clueTime: number;
    discussionTime: number;
    votingTime: number;
    isProduction: boolean;
    hasToken: boolean;
}
export declare const config: Config;
export declare function getPublicConfig(): Omit<Config, 'haxballToken'> & {
    haxballToken: string;
};
//# sourceMappingURL=index.d.ts.map