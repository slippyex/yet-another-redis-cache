export type CacheValueType = string | string[] | number | number[] | boolean | boolean[] | object | object[];

export interface ICacheSetOptions {
    expiryInSeconds?: number;
    subGroupPrefix?: string;
}
