import clone from 'clone-deep'

export const LOADING_START = 'LOADING_START'
export const LOADING_SUCCESS = 'LOADING_SUCCESS'
export const LOADING_ERROR = 'LOADING_ERROR'
export const QUERY_HAS_BECOME_STALE = 'QUERY_HAS_BECOME_STALE'

export default class Query extends EventTarget {
  static STATE_CHANGE = 'STATE_CHANGE'
  static SUCCESS = 'SUCCESS'
  static ERROR = 'ERROR'
  static QUERY_IS_EXPIRED = 'QUERY_IS_EXPIRED'

  listenersCount = 0

  state = {
    isLoading: false,
    isRefreshing: false,
    data: null,
    error: null,
    isStale: false
  }

  constructor(key, { cacheTime, staleTime, manager } = {}) {
    super()
    if (!key) {
      throw new Error('No key provided.')
    }
    this.key = key
    this._cacheTime = cacheTime
    this._staleTime = staleTime
    this._manager = manager
  }

  _commit(action, payload) {
    switch (action) {
      case LOADING_START:
        if (!this.state.data) {
          this.state.isLoading = true
        }
        this.state.isRefreshing = true
        break
      case LOADING_SUCCESS:
        this.state.data = payload
        this.state.error = null
        this.state.isLoading = false
        this.state.isRefreshing = false
        this.state.isStale = false
        break
      case LOADING_ERROR:
        this.state.data = null
        this.state.error = payload
        this.state.isLoading = false
        this.state.isRefreshing = false
        break
      case QUERY_HAS_BECOME_STALE:
        this.state.isStale = true
        break
      default:
        throw new Error('unknown query action :', action)
    }

    this.emit(Query.STATE_CHANGE, clone(this.state))
  }

  _startStaleTimeout() {
    if (this._staleTime) {
      this._staleTimeout = setTimeout(() => {
        this._commit(QUERY_HAS_BECOME_STALE)
      }, this._staleTime)
    }
  }

  _startCacheTimeout() {
    if (this._cacheTime) {
      this._cacheTimeout = setTimeout(() => {
        this.emit(Query.QUERY_HAS_EXPIRED)
      }, this._cacheTime)
    }
  }

  setData(data) {
    this._state.data = data
    this.emit(Query.STATE_CHANGE)
    this.clearTimeout(this._staleTimeout)
    this._startStaleTimeout()
  }

  on(...args) {
    this.listenersCount++
    if (this._cacheTimeout) clearTimeout(this._cacheTimeout)

    return this.addEventListener(...args)
  }

  off(...args) {
    this.listenersCount--
    if (!this.listenersCount) {
      this._startCacheTimeout()
    }

    return this.removeEventListener(...args)
  }

  emit(eventName, payload) {
    const event = new CustomEvent(eventName, { detail: payload })

    return this.dispatchEvent(event)
  }

  get isFetching() {
    return this.state.isLoading || this.state.isRefreshing
  }

  async load(fetcher, { force = false } = {}) {
    const isFresh = !this.state.isStale && this.state.data
    if (!force && isFresh) return
    if (this.isFetching) return

    this._commit(LOADING_START)

    if (this._staleTimeout) clearTimeout(this._staleTimeout)

    try {
      const data = await fetcher(this.key)
      this._commit(LOADING_SUCCESS, data)
      this.emit(Query.SUCCESS)

      this._startStaleTimeout()

      return data
    } catch (err) {
      this._commit(LOADING_ERROR, err)
      this.emit(Query.ERROR)
    }
  }
}
