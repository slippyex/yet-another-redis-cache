![GitHub package.json version](https://img.shields.io/github/package-json/v/slippyex/yet-another-redis-cache)
![CircleCI](https://img.shields.io/circleci/build/github/slippyex/yet-another-redis-cache?token=ba478c59b1d3cd57063d50260f1747f4a2961705)
![NPM](https://img.shields.io/npm/l/yet-another-redis-cache)
# YET ANOTHER REDIS CACHE

As the name implies, this is yet another (booooring) Redis-backed cache. However, this is not completely true.
In fact, it has some useful, not seen, functionality which I wanted to leverage for my own projects.
And since I didn't find the features, I decided to release this as another npm package, trying to 
give back to the OS community.

### Intro
So, long story short, the purpose of this package is ... guess what ... caching. Therefore, you will 
find the regular get/set methods plus some minimal options. Details to follow below.

The real interesting part comes, when you want to add (or get) more than just one value at once.

Let's say, I want to cache an arbitary amount of keys/vals at once. 

For that I can now use `getBulk` and `setBulk` which allow me to add or retrieve these in one Redis backend call.

### Getting started
```bash
yarn add yet-another-redis-cache
```

### Features
- Works out of the box
- provides regular cache functionality like get, set, delete
- provides bulk cache functionality getBulk, setBulk, deleteBulk (one Redis transaction)
- flexible expiration of keys by either setting them on the instantiation or per setter

### Usage
```typescript
  // create cache instance with a default of 5 seconds ttl per entry and a group prefix "example"
  const redisCache = new RedisCache(process.env.REDIS_URL, { groupKeyPrefix: 'example', ttl: 5 });
  const valuesToCache = {
      "identifier-1": "abdcef",
      "identifier-2": "bcdef1",
      "identifier-3": "cdef12",
      "identifier-4": "99aabb"
  };
  await redisCache.setBulk(valuesToCache);
```
The above code snippet will run in one Redis transaction. When a new request with a (sub-)set of the above keys 
comes in, we can create a single-transaction cache lookup with the following code
```typescript
  const cachedResults = await redisCache.getBulk(['identifier-2', 'identifier-3', 'identifier-10']);
```

The `cachedResults` will look like the following:
```json
  {
      "identifier-2": "bcdef1",
      "identifier-3": "cdef12",
      "identifier-10": null
  }
```
Allowing you to retrieve the result for `identifier-10`, cache and return the whole set

### Run tests
```bash
yarn test
```
