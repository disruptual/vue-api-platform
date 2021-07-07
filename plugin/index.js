import fetchIntercept from '@neorel/fetch-intercept'
import { ApiCache } from './ApiCache'
import { ApiBinding } from './ApiBinding'
import { connectMercure, startMercure } from './mercure'
import datas from './state'

const DEFAULT_DEBOUNCE_TIMEOUT = 200

const generateUrls = targets => {
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

const cacheDatas = function (data) {
  if (data['@id']) {
    let cache = datas.caches.find(cache => cache.urls.includes(data['@id']))
    if (!cache) {
      cache = new ApiCache(data['@id'])
      datas.caches.push(cache)
    }
    cache.data = data

    datas.mercure.listeners.forEach(listener => {
      listener(data)
    })
  }
}

export default {
  install(
    Vue,
    {
      debounce = false,
      debounceTimeout = DEFAULT_DEBOUNCE_TIMEOUT,
      staticContexts = [],
      mercure = {}
    }
  ) {
    Object.assign(datas.mercure, mercure)
    const defaultOptions = { debounce, debounceTimeout }
    datas.staticContexts = staticContexts

    if (window) {
      window.ApiDatas = datas
    }

    fetchIntercept.register({
      request: (url, config) => {
        const { excludedUrls } = datas.mercure

        if (excludedUrls && excludedUrls.some(u => url.includes(u))) {
          return [url, config]
        }

        return [
          url,
          {
            ...config,
            credentials: datas.mercure.withCredentials ? 'include' : 'omit'
          }
        ]
      },
      requestError: error => Promise.reject(error),
      response: response => {
        if (!response.ok) return response
        startMercure(response)
        const { request } = response
        if (request && ['PUT', 'POST', 'PATCH'].includes(request.method)) {
          response
            .clone()
            .json()
            .then(cacheDatas)
            .catch(e => {
              //nothing
            })
        }
        return response
      },
      responseError: error => Promise.reject(error)
    })

    Vue.config.optionMergeStrategies.api =
      Vue.config.optionMergeStrategies.methods

    Vue.mixin({
      data() {
        return {
          $apiBindings: []
        }
      },
      created() {
        const apiOptions = this.$options.api
        if (apiOptions) {
          Object.entries(apiOptions).forEach(([key, bindingOptions]) => {
            let func = null
            const options = {}
            if (typeof bindingOptions === 'function') {
              func = bindingOptions
            } else {
              if (typeof bindingOptions.func === 'function') {
                func = bindingOptions.func
              }

              if (typeof bindingOptions.pages === 'function') {
                options.pages = bindingOptions.pages.bind(this)()
              }
              if (bindingOptions.debounce) {
                options.debounce = !!bindingOptions.debounce
              }
              if (bindingOptions.debounceTimeout) {
                options.debounceTimeout = bindingOptions.debounceTimeout
              }
              if (bindingOptions.freezeUri) {
                options.freezeUri = bindingOptions.freezeUri
              }
              if (bindingOptions.refreshOnError) {
                options.refreshOnError = bindingOptions.refreshOnError
              }
              if (bindingOptions.force) {
                options.force = bindingOptions.force
              }
              if (bindingOptions.model) {
                options.model = bindingOptions.model
              }
            }
            if (!func) return
            this.$watch(
              func.bind(this),
              newVal => {
                this.$bindApi(key, newVal, options)
              },
              { immediate: true }
            )
            // if (bindingOptions) {
            //   this.$watch(apiOptions[key].pages.bind(this), (newVal) => {
            //     const binding = datas.bindings.find(
            //       (binding) => binding.vm === this && binding.key === key
            //     );
            //     if (binding) {
            //       options.pages = newVal;
            //       binding.options = options;
            //       binding.bind();
            //     }
            //   });
            // }
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

    Vue.prototype.$bindApi = function (key, target, options = {}) {
      if (!target) return

      const dataUrls = generateUrls(target)
      if (!dataUrls || dataUrls.length === 0) {
        this.$unbindApi(key)
        this[key] = Array.isArray(target) ? [] : null
        return
      }

      let binding = datas.bindings.find(
        binding => binding.vm === this && binding.key === key
      )
      if (binding) {
        binding.update(dataUrls, Array.isArray(target), options)
      } else {
        ApiBinding.create(
          dataUrls,
          this,
          key,
          Array.isArray(target),
          Object.assign({}, defaultOptions, options)
        )
      }
    }

    Vue.prototype.$refreshApi = function (key) {
      const binding = datas.bindings.find(
        binding => binding.vm === this && binding.key === key
      )
      if (!binding) return
      binding.caches.forEach(cache => {
        cache.load({ force: true })
      })

      datas.caches
        .filter(cache => cache.urls.some(url => binding.targets.includes(url)))
        .forEach(cache => {
          cache.load({ force: true })
        })
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

    Vue.prototype.$restartMercure = function () {
      if (datas.eventSource) {
        connectMercure(datas.eventSource.url)
      }
    }

    Vue.prototype.$registerMercure = function (listener) {
      datas.mercure.listeners.push(listener)
    }

    Vue.prototype.$unregisterMercure = function (listener) {
      datas.mercure.listeners = datas.mercure.listeners.filter(
        l => l !== listener
      )
    }
  }
}
