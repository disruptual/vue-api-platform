import uniq from 'lodash.uniq'
import fetchIntercept from '@neorel/fetch-intercept'

const datas = {
  bindings: [],
  caches: [],
  eventSource: null,
  mercure: null
}

const startMercure = response => {
  try {
    if (datas.mercure.topics.length && !datas.eventSource && response.headers.has('Link')) {
      const matches = response.headers.get('Link').match(/<([^>]+)>;\s+rel=(?:mercure|"[^"]*mercure[^"]*")/)
      if (matches) {
        const hubUrl = matches[1]
        const url = new URL(hubUrl)
        datas.mercure.topics.forEach(topic => {
          url.searchParams.append('topic', topic);
        })
        datas.eventSource = new EventSource(url.toString(), {withCredentials: datas.mercure.withCredentials})
        datas.eventSource.onmessage = e => {
          const data = JSON.parse(e.data)
          const target = data['@id']

          let cache = datas.caches.find(cache => cache.urls.includes(target))
          if (Object.keys(data).length <= 1) {
            if (cache) {
              cache.data = null
            }
          } else {
            if (cache) {
              cache.data = data
            } else {
              cache = new ApiCache(target, null, data)
              datas.caches.push(cache)
            }

            if (data.hasOwnProperty('mercure:related')) {
              data['mercure:related'].forEach(related => {
                datas.caches
                  .filter(cache => cache.urls.includes(related))
                  .forEach(cache => {
                    cache.load()
                  })
              })
            }
          }
        }
      }
    }
  } catch (e) {
    console.error(e)
  }
}

const generateUrls = (targets) => {
  if (targets) {
    if (!Array.isArray(targets)) {
      targets = [targets]
    }
    return targets.reduce((targets, target) => {
      if (typeof target === 'object' && target.hasOwnProperty('@id')) {
        targets.push(target['@id'])
      } else if (typeof target === 'string') {
        targets.push(target)
      }
      return targets
    }, [])
  }
}

class ApiCache {
  constructor(url, binding = null, data = null, parent = null) {
    this.uri = data ? data['@id'] : url
    this.data_ = null
    this.urls = [url]
    this.update = (new Date()).getTime()
    this.parents = parent ? [parent] : []
    this.bindings = binding ? [binding] : []
    this.deleteTimeout = null
    this.abortController = null

    if (data && data instanceof Object) this.data = data
  }

  get data() {
    const delay = this.getDelay()
    if (delay < 0 && !this.abortController) {
      const parentsLoading = this.parents.reduce((loading, parent) => {
        return loading || (parent.abortController !== null && parent.getDelay() <= delay)
      }, false)
      if (!parentsLoading) {
        this.load()
      }
    }
    if (
      this.data_ &&
      typeof this.data_ === 'object' &&
      this.data_.hasOwnProperty('@type') &&
      this.data_['@type'] === 'hydra:Collection'
    ) {
      return {
        ...this.data_,
        'hydra:member': this.data_['hydra:member'].reduce((members, member) => {
          const cache = datas.caches.find(cache => cache.urls.includes(member['@id']))
          const data = cache ? cache.data : member
          if (data) {
            members.push(data)
          }
          return members
        }, [])
      }
    } else {
      return this.data_
    }
  }

  set data(value) {
    this.data_ = value
    this.update = (new Date()).getTime()

    if(value) {
      if (value.hasOwnProperty('@id')) {
        this.uri = value['@id']
      }

      if (value.hasOwnProperty('@type') && value['@type'] === 'hydra:Collection') {
        value['hydra:member'].forEach(member => {
          if (member.hasOwnProperty('@id')) {
            let cache = datas.caches.find(cache => cache.uri === member['@id'] || cache.urls.includes(member['@id']))
            if (cache) {
              cache.data = member
              cache.parents = uniq([...cache.parents, this])
            } else {
              cache = new ApiCache(member['@id'], null, member, this)
              datas.caches.push(cache)
            }
          }
        })
      }
    }

    this.refreshBindings()
  }

  load() {
    if (this.abortController)
      this.abortController.abort()
    this.abortController = new AbortController()
    return fetch(this.uri, {signal: this.abortController.signal}).then(response => {
      if (response.ok) {
        startMercure(response)

        return response.json().then(data => {
          this.abortController = null
          this.data = data
          return data
        })
      } else {
        this.propagateError(response)
        throw response
      }
    }).catch(error => {
      this.abortController = null
      this.propagateError(error)
      throw error
    })
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
    return 30 * 1000 - ((new Date()).getTime() - this.update)
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

    datas.caches.forEach(cache => {
      if (cache.parents.includes(this)) {
        cache.removeBinding(null)
      }
    })

    if (this.bindings.length === 0) {
      const delay = this.getDelay()
      if (this.abortController) {
        this.abortController.abort()
        this.update = 0
      }
      this.deleteTimeout = setTimeout(() => {
        datas.caches = datas.caches.filter(cache => cache !== this)
      }, delay <= 0 ? 50 : delay + 50)
    }
  }
}

class ApiBinding {

  constructor(targets, vm, key, array=false) {
    this.vm = vm
    this.key = key
    this.targets = targets
    this.caches = []
    this.array = array
    this.reloadTimeout = null
    this.stopBindingTimeout = null
    this.isLoading = false
    this.vm.$data.$apiBindings = [...this.vm.$data.$apiBindings, this]
  }

  startBinding() {
    if (this.stopBindingTimeout) {
      clearTimeout(this.stopBindingTimeout)
    }
    this.isLoading = true
  }

  stopBinding() {
    if (this.stopBindingTimeout) {
      clearTimeout(this.stopBindingTimeout)
    }
    this.stopBindingTimeout = setTimeout(() => {
      this.isLoading = false
    }, 50)
  }

  static create(targets, vm, key, array=false) {
    const binding = new ApiBinding(targets, vm, key, array)
    datas.bindings.push(binding)
    binding.bind()
    return binding
  }

  update(targets, array=false) {
    this.targets = targets
    this.array = array

    this.bind()
  }

  delete() {
    this.caches.forEach(cache => {
      cache.removeBinding(this)
    })
    this.caches = []
  }

  bind() {
    const promises = this.targets.map(target => {

      let cache = this.caches.find(cache => cache.urls.includes(target))
      if (cache) {
        return Promise.resolve(cache.data)
      }

      cache = datas.caches.find(cache => cache.urls.includes(target))
      if (cache) {
        cache.addBinding(this)
        this.caches.push(cache)
        return Promise.resolve(cache.data)
      }

      cache = new ApiCache(target, this)
      datas.caches.push(cache)
      this.caches.push(cache)

      this.startBinding()
      return cache.load().then(() => {
        this.stopBinding()
      }).catch(() => {
        this.stopBinding()
      })
    })

    Promise.all(promises).then(dataList => {
      if (this.array) {
        this.vm[this.key] = dataList.filter(data => data)
      } else {
        this.vm[this.key] = dataList[0]
      }
    })
  }

  reload() {
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout)
    }
    this.reloadTimeout = setTimeout(() => {
      this.reloadTimeout = null
      this.bind()
    }, 200)
  }

}

const cacheDatas = function (data) {
  if (data['@id']) {
    let cache = datas.caches.find(cache => cache.urls.includes(data['@id']))
    if (!cache) {
      cache = new ApiCache(data['@id'])
      datas.caches.push(cache)
    }
    cache.data = data
  }
}

export default {
  install(Vue, {mercure = {}}) {
    datas.mercure = {
      topics: [],
      withCredentials: true,
      ...mercure
    }
    if (window) {
      window.ApiDatas = datas
    }

    fetchIntercept.register({
      request: (url, config) => {
        return [
          url,
          {
            ...config,
            credentials: datas.mercure.withCredentials ? 'include' : 'omit'
          }
        ]
      },
      requestError: (error) => Promise.reject(error),
      response: (response) => {
        if (response.ok) {
          const request = response.request
          if (request && (request.method === 'PUT' || request.method === 'POST' || request.method === 'PATCH')) {
            response.clone().json().then(datas => {
              cacheDatas(datas)
            }).catch(e => {
              //nothing
            })
          }
        }
        return response
      },
      responseError: (error) => Promise.reject(error)
    });

    Vue.config.optionMergeStrategies.api = Vue.config.optionMergeStrategies.methods

    Vue.mixin({
      data() {
        return {
          $apiBindings: []
        }
      },
      created() {
        const apiOptions = this.$options.api
        if (apiOptions) {
          Object.keys(apiOptions).forEach(key => {
            this.$watch(apiOptions[key].bind(this), (newVal) => {
              this.$bindApi(key, newVal)
            }, {immediate: true})
          })
        }
      },
      beforeDestroy() {
        const apiOptions = this.$options.api
        if (apiOptions) {
          Object.keys(apiOptions).forEach(key => {
            this.$unbindApi(key)
          })
        }
      }
    })

    Vue.prototype.$bindApi = function (key, target) {
      const dataUrls = generateUrls(target)
      if (!dataUrls || dataUrls.length === 0) {
        this[key] = Array.isArray(target) ? [] : null
        return
      }

      let binding = datas.bindings.find(binding => binding.vm === this && binding.key === key)
      if (binding) {
        binding.update(dataUrls, Array.isArray(target))
      } else {
        ApiBinding.create(dataUrls, this, key, Array.isArray(target))
      }

    }

    Vue.prototype.$refreshApi = function (key) {
      const binding = datas.bindings.find(binding => binding.vm === this && binding.key === key)
      if (binding) {
        binding.caches.forEach(cache => {
          cache.load()
        })
      }

      const cache = datas.caches.find(cache => cache.urls.includes(key))
      if (cache) {
        cache.load()
      }
    }

    Vue.prototype.$cacheDataApi = cacheDatas

    Vue.prototype.$unbindApi = function (key) {
      datas.bindings = datas.bindings.reduce((bindings, binding) => {
        if (binding.vm === this && binding.key === key) {
          binding.delete()
        } else {
          bindings.push(binding)
        }
        return bindings
      }, [])
    }
  }
}
