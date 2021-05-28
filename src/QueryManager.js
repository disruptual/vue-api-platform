import Query from './Query'

export default class QueryManager {
  _cache = new Map()

  constructor({ cacheTime, staleTime }) {
    this.defaultQueryOpts = { cacheTime, staleTime }
  }

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
    if (typeof key !== 'string') {
      throw new Error('key argument required.')
    }

    if (this._cache.has(key)) {
      throw new Error(`query with key ${key} already exists.`)
    }
    this._cache.set(
      key,
      new Query(key, { ...this.defaultQueryOpts, ...options })
    )
  }

  load(key) {
    return this.get(key).load()
  }
}
