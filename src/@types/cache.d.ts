export type CacheValueType = string | string[] | number | number[] | boolean | boolean[] | object | object[];

export interface ICacheSetOptions {
    expiryInSeconds?: number;
    subGroupPrefix?: string;
}

interface IRedisConnection {
    host: string;
    port: number;
    password?: string;
    db?: number;
    username?: string;
}
export interface IRedisConnectionOptions {
    ttl?: number;
    lru?: {
        max: number;
    };
    groupKeyPrefix?: string;
    poolOptions?: IRedisPoolOptions;
    connection?: IRedisConnection;
}

export interface IRedisPoolOptions {
    max?: number;
    min?: number;
    maxWaitingClients?: number;
    testOnBorrow?: boolean;
    testOnReturn?: boolean;
    acquireTimeoutMillis?: number;
    fifo?: boolean;
    priorityRange?: number;
    autostart?: boolean;
    evictionRunIntervalMillis?: number;
    numTestsPerEvictionRun?: number;
    softIdleTimeoutMillis?: number;
    idleTimeoutMillis?: number;
}
