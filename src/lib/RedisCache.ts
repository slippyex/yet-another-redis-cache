import { createClient, RedisClientType } from 'redis';
import { CacheValueType, ICacheSetOptions, IRedisConnection, IRedisConnectionOptions } from '../@types/cache';

export class RedisCache {
    private readonly client: RedisClientType;
    private readonly ttl: number;
    private readonly groupKeyPrefix: string;
    private readonly url: string;
    private readonly isLRU: boolean;
    private readonly maxLRU: number;
    constructor(url: string);
    constructor(options: IRedisConnectionOptions);
    constructor(url: string, options: IRedisConnectionOptions);
    constructor(...arr: (string | IRedisConnectionOptions)[]) {
        const { url, options } = RedisCache.extractSignature(...arr);
        this.url = url || RedisCache.buildUrl(options.connection);
        this.client = (options || {}).poolOptions
            ? createClient({ url: this.url, isolationPoolOptions: options.poolOptions })
            : createClient({ url: this.url });
        this.groupKeyPrefix = (options || {}).groupKeyPrefix || null;
        this.ttl = (options || {}).ttl || -1;
        this.isLRU = (options || {}).lru && (options || {}).lru.max > 0;
        this.maxLRU = (options || {}).lru ? (options || {}).lru.max : 0;
    }

    private static extractSignature(...arr: (string | IRedisConnectionOptions)[]): {
        url: string;
        options: IRedisConnectionOptions;
    } {
        let options: IRedisConnectionOptions;
        let url: string;
        if (arr.length === 2) {
            url = arr[0] as string;
            options = arr[1] as IRedisConnectionOptions;
        } else if (arr.length === 1 && typeof arr[0] === 'string') {
            url = arr[0];
        } else {
            options = arr[0] as IRedisConnectionOptions;
        }
        if (!url && !(options || {}).connection)
            throw new Error('RedisCache: url or options.connection must be provided');
        if (url && (options || {}).connection)
            throw new Error('RedisCache: url and options.connection cannot be provided together');

        return {
            url: url || RedisCache.buildUrl(options.connection),
            options: options || {}
        };
    }
    private static buildUrl(connection: IRedisConnection): string {
        const { host, port, password, db, username } = connection;
        const url = `redis://${username || ''}${password ? `:${password}` : ''}${username ? '@' : ''}${host}:${port}`;
        return db ? `${url}/${db}` : url;
    }

    isOpen(): boolean {
        return this.client.isOpen;
    }

    /**
     * disconnect from Redis server
     */
    async connect(): Promise<void> {
        if (!this.isOpen()) await this.client.connect();
    }

    async disconnect(): Promise<void> {
        if (this.isOpen()) await this.client.disconnect();
    }

    /**
     * quit from Redis server
     *
     */
    async quit(): Promise<void> {
        if (this.isOpen()) {
            await this.client.quit();
        }
    }

    /**
     * returns a list of keys with a given pattern (optional)
     *
     * @param pattern
     */
    @assureOpenConnection()
    async keys(pattern = '*'): Promise<string[]> {
        return this.client.keys(pattern);
    }

    /**
     * tries to retrieve a list of keys from cache and
     * associates them as a hash map. Keys which could not be found
     * will have a null value
     *
     * @param keys
     * @param subGroupPrefix
     */
    @assureOpenConnection()
    async getBulk(keys: string[], subGroupPrefix?: string): Promise<Record<string, CacheValueType>> {
        const results = (await this.client.mGet(
            keys.map(key => this.wrapKey(key, subGroupPrefix))
        )) as unknown as string[];
        const associated: Record<string, CacheValueType> = {};
        keys.forEach((key, idx) => (associated[key] = this.unwrapValue(results[idx])));
        return associated;
    }

    /**
     * tries to get a single value from the cache
     * if not found, null will be returned
     *
     * @param key
     * @param subGroupPrefix
     */
    @assureOpenConnection()
    async get(key: string, subGroupPrefix?: string): Promise<CacheValueType> {
        return this.unwrapValue(await this.client.get(this.wrapKey(key, subGroupPrefix)));
    }

    /**
     * keyVals are expected as a hash map and are persisted
     * in one Redis transaction
     *
     * @param keyVals
     * @param options
     */
    @assureOpenConnection()
    async setBulk(keyVals: Record<string, CacheValueType>, options?: ICacheSetOptions): Promise<void> {
        if (this.isLRU && Object.keys(keyVals).length > this.maxLRU) {
            throw new Error('RedisCache: amount of keys to set exceeds max LRU size');
        }
        await this.client.executeIsolated(async isolatedClient => {
            const multi = isolatedClient.multi();
            Object.keys(keyVals).map(key => {
                const { dataType, wrappedValue } = this.wrapValue(keyVals[key]);

                if ((options || {}).expiryInSeconds || this.ttl > 0) {
                    multi.set(this.wrapKey(key, (options || {}).subGroupPrefix), `${dataType}::${wrappedValue}`, {
                        EX: (options || {}).expiryInSeconds ? options.expiryInSeconds : this.ttl
                    });
                } else {
                    multi.set(this.wrapKey(key, (options || {}).subGroupPrefix), `${dataType}::${wrappedValue}`);
                }
            });
            return multi.exec();
        });
    }

    /**
     * persists a single key-value pair in Redis
     *
     * @param key
     * @param value
     * @param options
     */
    @assureOpenConnection()
    async set(key: string, value: CacheValueType, options?: ICacheSetOptions): Promise<void> {
        const { dataType, wrappedValue } = this.wrapValue(value);

        if ((options || {}).expiryInSeconds || this.ttl > 0) {
            await this.client.set(this.wrapKey(key, (options || {}).subGroupPrefix), `${dataType}::${wrappedValue}`, {
                EX: (options || {}).expiryInSeconds ? options.expiryInSeconds : this.ttl
            });
        } else {
            await this.client.set(this.wrapKey(key, (options || {}).subGroupPrefix), `${dataType}::${wrappedValue}`);
        }
    }

    /**
     * deletes a single cache key
     *
     * @param key
     * @param subGroupPrefix
     */
    @assureOpenConnection()
    async delete(key: string, subGroupPrefix?: string): Promise<void> {
        await this.client.del(this.wrapKey(key, subGroupPrefix));
    }

    /**
     * deletes a set of cache keys in one Redis transaction
     *
     * @param keys
     * @param subGroupPrefix
     */
    @assureOpenConnection()
    async deleteBulk(keys: string[], subGroupPrefix?: string): Promise<void> {
        await this.client.executeIsolated(async isolatedClient => {
            const multi = isolatedClient.multi();
            keys.map(key => {
                multi.del(this.wrapKey(key, subGroupPrefix));
            });
            return multi.exec();
        });
    }

    // private helper functions

    private determineDataType(value: string | string[] | number | number[] | boolean | object | object[]): string {
        if (typeof value === 'object') {
            return Array.isArray(value) ? typeof value[0] + '[]' : 'object';
        }
        return typeof value;
    }

    private unwrapValue(wrappedValue: string): CacheValueType {
        if (wrappedValue) {
            const [dataType, value] = wrappedValue.split('::');
            if (dataType.endsWith('[]') || dataType === 'object') {
                return JSON.parse(value);
            } else if (dataType === 'number') {
                return parseFloat(value);
            } else if (dataType === 'boolean') {
                return 'true' === value;
            }
            return value;
        }
        return wrappedValue;
    }

    private wrapKey(key: string, subGroupPrefix: string): string {
        return `${this.groupKeyPrefix ? this.groupKeyPrefix + ':' : ''}${
            subGroupPrefix ? subGroupPrefix + ':' : ''
        }${key}`;
    }

    private wrapValue(value: CacheValueType): { dataType: string; wrappedValue: string | number | boolean | object } {
        const dataType = this.determineDataType(value);
        const wrappedValue = dataType.endsWith('[]') || dataType === 'object' ? JSON.stringify(value) : value;
        return { dataType, wrappedValue };
    }
}

function assureOpenConnection() {
    return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
        const targetMethod = descriptor.value;
        descriptor.value = async function (...args: unknown[]) {
            await this.connect();
            return targetMethod.apply(this, args);
        };
        return descriptor;
    };
}
