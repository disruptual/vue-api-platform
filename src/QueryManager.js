import Query from './Query'

const DEFAULT_STALE_TIME = 5000
const DEFAULT_CACHE_TIME = 10000

export default class QueryManager {
  _cache = new Map()

  constructor({
    cacheTime = DEFAULT_CACHE_TIME,
    staleTime = DEFAULT_STALE_TIME
  } = {}) {
    this.defaultQueryOpts = { cacheTime, staleTime }
  }

  _normalize() {}

  _unwrapQuery(queryData) {}

  get size() {
    return this._cache.size
  }

  has(key) {
    return this._cache.has(key)
  }

  get(key) {
    return this._cache.get(key)
  }

  create(key, options) {
    if (key === undefined) {
      throw new Error('key argument required.')
    }

    if (this._cache.has(key)) {
      throw new Error(`query with key ${key} already exists.`)
    }

    this._cache.set(
      key,
      new Query(key, { ...this.defaultQueryOpts, ...options, manager: this })
    )
  }

  load(key, fetcher, options) {
    if (!fetcher || typeof fetcher !== 'function') {
      throw new Error('a fetcher function must be provided.')
    }

    return this.get(key).load(fetcher, options)
  }
}
