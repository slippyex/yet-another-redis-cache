import { RedisCache } from '../src/';

async function waitMS(ms: number) {
    await new Promise(res => setTimeout(res, ms));
}

let redisCache: RedisCache;

describe('Redis Cache testing', () => {
    beforeEach(async () => {
        redisCache = new RedisCache(process.env.REDIS_URL, { groupKeyPrefix: 'tests', ttl: 5 });
    });

    afterEach(async () => {
        await redisCache.disconnect();
    });

    afterAll(async () => {
        await redisCache.quit();
    });


    test('checks that a value has been set and can be retrieved', async () => {
        await redisCache.set('key1', 'test1');
        const result = await redisCache.get('key1');
        expect(result).toBe('test1');
    });

    test('checks that deleting a key works', async () => {
        await redisCache.set('key1', 'test1');
        expect(await redisCache.get('key1')).toBe('test1');
        await redisCache.delete('key1');
        expect(await redisCache.get('key1')).toBeNull();
    });

    test('checks that deleting multiple keys works', async () => {
        const bulkSetObject = {
            'kserie-1': 10,
            'kserie-2': 20,
            'kserie-3': 30,
            'kserie-4': 40
        };
        await redisCache.setBulk(bulkSetObject);
        expect(await redisCache.getBulk(Object.keys(bulkSetObject))).toStrictEqual(bulkSetObject);
        await redisCache.deleteBulk(Object.keys(bulkSetObject));
        expect(await redisCache.getBulk(Object.keys(bulkSetObject))).toStrictEqual({
            'kserie-1': null,
            'kserie-2': null,
            'kserie-3': null,
            'kserie-4': null
        });
    });

    test('checks that a value with expiry has been set and can be retrieved', async () => {
        await redisCache.set('key1', 'test1', { expiryInSeconds: 1 });
        const result = await redisCache.get('key1');
        expect(result).toBe('test1');
        await waitMS(1000);
        expect(await redisCache.get('key1')).toBeNull();
    });

    test('checks subGroupPrefix on getter/setter', async () => {
        await redisCache.set('key1', 'test1', { expiryInSeconds: 1, subGroupPrefix: 'sub-1' });
        const result = await redisCache.get('key1', 'sub-1');
        expect(result).toBe('test1');
        const keys = await redisCache.keys('*:sub-1:*');
        expect(keys).toHaveLength(1);
        expect(keys).toStrictEqual(['tests:sub-1:key1']);
        await waitMS(1000);
        expect(await redisCache.get('key1', 'sub-1')).toBeNull();
    });

    test('checks that bulk setting values with expiry works', async () => {
        const bulkSetObject = {
            'kserie-1': 10,
            'kserie-2': 20,
            'kserie-3': 30,
            'kserie-4': 40
        };
        await redisCache.setBulk(bulkSetObject, { expiryInSeconds: 1 });
        expect(await redisCache.getBulk(Object.keys(bulkSetObject))).toStrictEqual(bulkSetObject);
        await waitMS(1000);
        expect(await redisCache.getBulk(Object.keys(bulkSetObject))).toStrictEqual({
            'kserie-1': null,
            'kserie-2': null,
            'kserie-3': null,
            'kserie-4': null
        });
    });

    test('check that data type wrapping/unwrapping works', async () => {
        await redisCache.set('string-test', 'apparently a string');
        await redisCache.set('number-test', 100);
        await redisCache.set('boolean-test', false);
        await redisCache.set('object-test', { test1: true });
        await redisCache.set('string-array-test', ['aa', 'bb']);
        await redisCache.set('number-array-test', [11, 22]);
        await redisCache.set('boolean-array-test', [true, false]);
        await redisCache.set('object-array-test', [{ test1: true }, { test2: false }]);

        expect(typeof (await redisCache.get('string-test'))).toBe('string');
        expect(await redisCache.get('string-test')).toBe('apparently a string');

        expect(typeof (await redisCache.get('number-test'))).toBe('number');
        expect(await redisCache.get('number-test')).toBe(100);

        expect(typeof (await redisCache.get('boolean-test'))).toBe('boolean');
        expect(await redisCache.get('boolean-test')).toBeFalsy();

        expect(typeof (await redisCache.get('object-test'))).toBe('object');
        expect(await redisCache.get('object-test')).toStrictEqual({ test1: true });

        const stringArray = await redisCache.get('string-array-test');
        expect(stringArray).toHaveLength(2);
        expect((stringArray as unknown as string[]).map(n => typeof n)).toStrictEqual(['string', 'string']);
        expect(stringArray).toStrictEqual(['aa', 'bb']);

        const numberArray = await redisCache.get('number-array-test');
        expect(numberArray).toHaveLength(2);
        expect((numberArray as unknown as number[]).map(n => typeof n)).toStrictEqual(['number', 'number']);
        expect(numberArray).toStrictEqual([11, 22]);

        const booleanArray = await redisCache.get('boolean-array-test');
        expect(booleanArray).toHaveLength(2);
        expect((booleanArray as unknown as boolean[]).map(n => typeof n)).toStrictEqual(['boolean', 'boolean']);
        expect(booleanArray).toStrictEqual([true, false]);

        const objectArray = await redisCache.get('object-array-test');
        expect(objectArray).toHaveLength(2);
        expect((objectArray as unknown as object[]).map(n => typeof n)).toStrictEqual(['object', 'object']);
        expect(objectArray).toStrictEqual([{ test1: true }, { test2: false }]);

        const keys = await redisCache.keys();
        expect(keys).toHaveLength(8);
    });
});
