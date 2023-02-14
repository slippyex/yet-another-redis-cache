import { createClient, RedisClientType } from 'redis';
import { CacheValueType, ICacheSetOptions } from '../@types/cache';

export class RedisCache {
    private readonly client: RedisClientType;
    private readonly ttl: number;
    private readonly extendExpiryOnTouch: boolean;
    private readonly groupKeyPrefix: string;
    private readonly url: string;

    constructor(url: string, options?: { ttl?: number; extendExpiryOnTouch?: boolean; groupKeyPrefix?: string }) {
        this.client = createClient({ url });
        this.url = url;
        this.groupKeyPrefix = (options || {}).groupKeyPrefix || null;
        this.ttl = (options || {}).ttl || -1;
        this.extendExpiryOnTouch = (options || {}).extendExpiryOnTouch;
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
