import Query from './Query'

const DEFAULT_STALE_TIME = 5000
const DEFAULT_CACHE_TIME = 10000

export default class QueryManager {
  _cache = new Map()
  _plugins = []

  constructor({
    cacheTime = DEFAULT_CACHE_TIME,
    staleTime = DEFAULT_STALE_TIME
  } = {}) {
    this.defaultQueryOpts = { cacheTime, staleTime }
  }

  _processNewState(newState) {
    return this._plugins.reduce((state, plugin) => {
      if (!plugin.transformQuery) return state

      return plugin.transformQuery(state)
    }, newState)
  }

  async _processAsyncMiddleware(data, ...middleWares) {
    for (let middleware of middleware) {
      data = await middleware(data, { queryManager: this })
    }
    return data
  }

  _onQuerySuccess(newState, observerCallback) {
    return this._processAsyncMiddleware([
      ...this._plugins.map(p => p.onQuerySuccess).filter(Boolean),
      observerCallback
    ])
  }

  _onQueryError(newState, observerCallback) {
    return this._processAsyncMiddleware([
      ...this._plugins.map(p => p.onQueryError).filter(Boolean),
      observerCallback
    ])
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

  forEach(cb) {
    this._cache.forEach(cb)
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

    return this.get(key)
  }

  delete(key) {
    return this._cache.delete(key)
  }

  load(key, fetcher, options) {
    if (!fetcher || typeof fetcher !== 'function') {
      throw new Error('a fetcher function must be provided.')
    }

    return this.get(key).load(fetcher, options)
  }

  observe(key, cb, { onSuccess, onError, queryOptions }) {
    const listener = newState => {
      return cb(this._processNewState(newState))
    }

    const cleanup = () => {
      this.delete(key)
    }

    const successCallback = newstate => {
      return this._onQuerySuccess(newState, onSuccess)
    }

    const errorCallback = newState => {
      return this._onQueryError(newState, onError)
    }

    const query = this.get(key) || this.create(key, queryOptions)
    query.on(Query.STATE_CHANGE, listener)
    query.on(Query.STATE_SUCCESS, successCallback)
    query.on(Query.STATE_SUCCESS, errorCallback)
    query.on(Query.QUERY_HAS_EXPIRED, cleanup)

    return () => {
      query.off(Query.STATE_CHANGE, listener)
      query.off(Query.STATE_SUCCESS, successCallback)
      query.off(Query.STATE_SUCCESS, errorCallback)
      query.off(Query.QUERY_HAS_EXPIRED, cleaner)
    }
  }

  setQueryData(key, data) {
    this.get(key).setData(data)
  }

  plugin(plugin) {
    if (typeof plugin !== 'object') {
      throw new Error('A QueryManager plugin must be an object')
    }

    this._plugins.push(plugin)
  }
}
