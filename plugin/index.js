import uniq from 'lodash.uniq'

let bindings = []
let caches = []

//
// let mercureHubs = {}
//
// class MercureHub {
//   constructor(hubUrl, ...topics) {
//     this.topics = topics
//
//     const url = new URL(hubUrl)
//     topics.forEach(topic => {
//       url.searchParams.append('topic', topic)
//     })
//
//     this.eventSource = new EventSource(url.toString())
//     this.eventSource.onmessage = e => {
//       binding.data = e.data
//       binding.components.forEach(component => {
//         component.vm[component.key] = e.data
//       })
//     }
//   }
//
//   static bind(hubUrl, ...topics) {
//     let hub = mercureHubs[hubUrl]
//     if (hub) {
//       const oldHub = hub
//
//       hub = new MercureHub(hubUrl, ...[...oldHub.topics, ...topics])
//       mercureHubs[hubUrl] = hub
//
//       oldHub.eventSource.close()
//
//       return hub
//     } else {
//       hub = new MercureHub(hubUrl, ...topics)
//       mercureHubs[hubUrl] = hub
//       return hub
//     }
//   }
//
//   static unbind(hubUrl, ...topics) {
//     let hub = mercureHubs[hubUrl]
//
//     if (hub) {
//       const oldHub = hub
//
//       hub = new MercureHub(hubUrl, ...hub.topics.filter(topic => !topics.includes(topic)))
//       mercureHubs[hubUrl] = hub
//
//       oldHub.eventSource.close()
//
//       return hub
//     }
//   }
// }
//
// const getHubUrlFromResponse = response => {
//   return null
//   if (response
//     && response.headers
//     && response.headers.get
//     && response.headers.get('Link')
//   ) {
//     const matches = response.headers.get('Link')
//       .match(/<([^>]+)>;\s+rel=(?:mercure|"[^"]*mercure[^"]*")/)
//     if (matches) {
//       return matches[1]
//     }
//   }
// }

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
    this.uri = data ? data['@id'] : null
    this.data_ = data
    this.urls = [url]
    this.update = (new Date()).getTime()
    this.parents = parent ? [parent] : []
    this.bindings = binding ? [binding] : []
    this.timemout = null
  }

  get data() {
    if (
      this.data_ &&
      typeof this.data_ === 'object' &&
      this.data_.hasOwnProperty('@type') &&
      this.data_['@type'] === 'hydra:Collection'
    ) {
      return {
        ...this.data_,
        'hydra:member': this.data_['hydra:member'].map(member => {
          const cache = caches.find(cache => cache.urls.includes(member['@id']))
          return cache ? cache.data : member
        })
      }
    } else {
      return this.data_
    }
  }

  set data(value) {
    this.data_ = value
    if(value) {
      this.uri = value['@id']
    }

    if (value['@type'] === 'hydra:Collection') {
      value['hydra:member'].forEach(member => {

        let cache = caches.find(cache => cache.uri === member['@id'] || cache.urls.includes(member['@id']))
        if (cache) {
          cache.data = member
          cache.parents = uniq([...cache.parents, this])
        } else {
          cache = new ApiCache(member['@id'], null, member, this)
          caches.push(cache)
        }
      })
    }

    this.refreshBindings()
  }

  refreshBindings() {
    this.bindings.forEach(binding => {
      binding.bind()
    })
    this.parents.forEach(parent => {
      parent.refreshBindings()
    })
  }

  getDelay() {
    return 30 * 1000 - ((new Date()).getTime() - this.update)
  }

  addBinding(binding) {
    if (this.timemout) {
      clearTimeout(this.timemout)
      this.timemout = null
    }

    this.bindings.push(binding)
  }

  removeBinding(binding) {
    this.bindings = this.bindings.filter(b => b !== binding)

    caches.forEach(cache => {
      if (cache.parents.includes(this)) {
        cache.removeBinding(null)
      }
    })

    if (this.bindings.length === 0) {
      const delay = this.getDelay()
      if (delay <= 0) {
        caches = caches.filter(cache => cache !== this)
      } else {
        this.timemout = setTimeout(() => {
          caches = caches.filter(cache => cache !== this)
        }, delay)
      }
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
    this.bindings = 0
  }

  startBinding() {
    if (this.bindings === 0) {
      if (this.vm.$options.hasOwnProperty('apiBinding')) {
        this.vm.$options.apiBinding()
      }
    }
    this.bindings++
  }

  stopBinding() {
    this.bindings--
    if (this.bindings === 0) {
      if (this.vm.$options.hasOwnProperty('apiBound')) {
        this.vm.$options.apiBound()
      }
    }
  }

  static create(targets, vm, key, array=false) {
    const binding = new ApiBinding(targets, vm, key, array)
    bindings.push(binding)
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

      this.startBinding()

      let cache = this.caches.find(cache => cache.urls.includes(target))
      if (cache) {
        return new Promise(resolve => {
          resolve(cache.data)
          this.stopBinding()
        })
      }

      cache = caches.find(cache => cache.urls.includes(target))
      if (cache) {
        cache.addBinding(this)
        this.caches.push(cache)
        if (cache.getDelay() > 0) {
          return new Promise(resolve => {
            resolve(cache.data)
            this.stopBinding()
          })
        }
      }

      if (!cache) {
        cache = new ApiCache(target, this)
        caches.push(cache)
        this.caches.push(cache)
      }
      return fetch(target).then(response => {
        if (response.ok) {
          return response.json().then(data => {
            cache.data = data
            this.stopBinding()
            return data
          })
        } else {
          if (this.vm.$options.hasOwnProperty('apiBindError')) {
            this.vm.$options.apiBindError(this.key, response)
          }
          this.stopBinding()
        }
      }).catch(error => {
        if (this.vm.$options.hasOwnProperty('apiBindError')) {
          this.vm.$options.apiBindError(this.key, error)
        }
        this.stopBinding()
      })
    })

    Promise.all(promises).then(datas => {
      if (this.array) {
        this.vm[this.key] = datas.filter(data => data)
      } else {
        this.vm[this.key] = datas[0]
      }
    })
  }

}

export default {
  install(Vue) {
    Vue.config.optionMergeStrategies.api = Vue.config.optionMergeStrategies.methods

    Vue.mixin({
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

      let binding = bindings.find(binding => binding.vm === this && binding.key === key)
      if (binding) {
        binding.update(dataUrls, Array.isArray(target))
      } else {
        ApiBinding.create(dataUrls, this, key, Array.isArray(target))
      }

    }

    Vue.prototype.$unbindApi = function (key) {
      bindings = bindings.reduce((bindings, binding) => {
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
