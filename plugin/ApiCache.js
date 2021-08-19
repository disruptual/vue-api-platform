import uniq from 'lodash.uniq'
import datas from './state'
import { getDataId, isCollection } from './utils'
import debounce from 'lodash.debounce'

const CACHE_TIMEOUT = 1 * 1000 * 30 // 30 seconds

let cacheEntriesToRemove = {}
let cacheIdsToCleanup = []

const batchRemovebinding = () => {
  datas.caches.forEach(cache => {
    const shouldCleanup = cache.parents.some(
      parent => cacheEntriesToRemove[parent.uri]
    )
    if (!shouldCleanup) return

    cache.cleanup()
  })

  cacheEntriesToRemove = {}
}

const batchCleanup = () => {
  datas.caches = datas.caches.filter(
    cache => !cacheIdsToCleanup.includes(cache.id)
  )
  datas.bindings.forEach(binding => {
    binding.caches = binding.caches.filter(
      cache => !cacheIdsToCleanup.includes(cache.id)
    )
  })
  cacheIdsToCleanup = []
}

const debouncedBatchRemovebinding = debounce(batchRemovebinding, 500)
const debouncedBatchCleanup = debounce(batchCleanup, 500)

export class ApiCache {
  constructor(url, binding = null, data = null, parent = null, options = {}) {
    this.uri = data ? getDataId(data) : url
    this.id = Math.random()
    this.data_ = null
    this.urls = [url]
    this.update = new Date().getTime()
    this.parents = parent ? [parent] : []
    this.bindings = binding ? [binding] : []
    this.deleteTimeout = null
    this.abortController = null
    this.isLoading = false
    this._isStatic = false
    this.options = options

    if (data && data instanceof Object) this.data = data
  }

  get isStatic() {
    return (
      this._isStatic ||
      (this.parents.length > 0 && this.parents.every(parent => parent.isStatic))
    )
  }

  set isStatic(value) {
    this._isStatic = value
  }

  get data() {
    const delay = this.getDelay()
    if (delay < 0 && !this.abortController) {
      const parentsLoading = this.parents.some(
        parent => parent.abortController !== null && parent.getDelay() <= delay
      )

      if (!parentsLoading) {
        return this.load()
      }
    }

    if (isCollection(this.data_)) {
      return {
        ...this.data_,
        'hydra:member': this.data_['hydra:member'].map(entity => {
          const cache = datas.caches.find(cache =>
            cache.urls.includes(getDataId(entity))
          )
          if (!cache) return entity
          const isCacheExpired = cache.getDelay() < 0
          if (isCacheExpired) return entity

          return cache.data
        })
      }
    } else {
      return this.data_
    }
  }

  set data(value) {
    this.data_ = value
    this.update = new Date().getTime()
    if (value === undefined || value === null) {
      return this.refreshBindings()
    }
    const id = getDataId(value)
    if (id && !this.options.freezeUri && id !== this.uri) {
      this.uri = id
    }
    if (isCollection(value)) {
      value['hydra:member'].forEach(member => {
        const id = getDataId(member)
        if (!id) return
        let cache = datas.caches.find(
          cache => cache.uri === id || cache.urls.includes(id)
        )

        if (cache) {
          cache.data = member
          cache.parents = uniq([...cache.parents, this])
        } else {
          cache = new ApiCache(id, null, member, this)
          datas.caches.push(cache)
        }
      })
    }

    this.refreshBindings()
  }

  load({ force = false } = {}) {
    if (this.isLoading) return this._fetchPromise
    if (this.isStatic && this.data_ && !force)
      return Promise.resolve(this.data_)

    this.isLoading = true
    if (this.abortController) this.abortController.abort()
    this.abortController = new AbortController()

    this._fetchPromise = fetch(this.uri, {
      signal: this.abortController.signal
    })
      .then(response => {
        if (response.ok) {
          return response.json().then(data => {
            this.isStatic = datas.staticContexts.includes(data['@context'])
            this.abortController = null
            this.data = data
            return data
          })
        } else {
          this.propagateError(response)
          throw response
        }
      })
      .catch(error => {
        this.abortController = null
        this.propagateError(error)
        if (this.options.refreshOnError) {
          this.data = null
        }
        throw error
      })
      .finally(() => {
        this.isLoading = false
      })

    return this._fetchPromise
  }

  propagateError(error) {
    this.bindings.forEach(binding => {
      if (binding.vm.$options.apiBindError) {
        binding.vm.$options.apiBindError.bind(binding.vm)(binding.key, error)
      }
    })
  }

  refreshBindings() {
    this.bindings.forEach(binding => {
      binding.reload()
    })
    this.parents.forEach(parent => {
      parent.refreshBindings()
    })
  }

  getDelay() {
    return CACHE_TIMEOUT - (new Date().getTime() - this.update)
  }

  addBinding(binding) {
    if (this.deleteTimeout) {
      clearTimeout(this.deleteTimeout)
      this.deleteTimeout = null
    }

    this.bindings.push(binding)
  }

  removeBinding(binding) {
    this.bindings = this.bindings.filter(b => b !== binding)

    if (!cacheEntriesToRemove[this.uri]) {
      cacheEntriesToRemove[this.uri] = this
      debouncedBatchRemovebinding()
    }

    this.cleanup()
  }

  cleanup() {
    if (this.bindings.length > 0) return

    const delay = this.getDelay()
    this.update = 0

    if (this.isStatic) return
    this.deleteTimeout = setTimeout(() => {
      cacheIdsToCleanup.push(this.id)
      debouncedBatchCleanup()
    }, Math.max(delay + 50, 50))
  }
}
