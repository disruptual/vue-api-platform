const api = {
  requestOptions: {
    headers: new Headers()
  }
}

export default {
  install(Vue, {baseURL, cacheTime = 30} = {}) {
    Vue.prototype.$api = api

    let bindings = []

    const generateUrl = (target) => {
      if (target) {
        if (typeof target === 'object' && target.hasOwnProperty('@id')) {
          return baseURL + target['@id']
        }
        if (typeof target === 'string') {
          return baseURL + target
        }
      }
    }

    const getHubUrlFromResponse = response => {
      if (response
        && response.headers
        && response.headers.get
        && response.headers.get('Link')
      ) {
        const matches = response.headers.get('Link')
          .match(/<([^>]+)>;\s+rel=(?:mercure|"[^"]*mercure[^"]*")/)
        if (matches) {
          return matches[1]
        }
      }
    }

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
      const dataUrl = generateUrl(target)
      if (!dataUrl) {
        this[key] = null
        return
      }
      let binding = bindings.find(binding => binding.targets.includes(dataUrl))

      if (!binding) {
        binding = {
          targets: [dataUrl],
          eventSource: null,
          data: null,
          update: 0,
          components: [
            {
              vm: this,
              key
            }
          ]
        }
        bindings.push(binding)
      }

      if (binding.update < (new Date()).getTime() - cacheTime * 1000 && binding.eventSource === null) {
        binding.update = (new Date()).getTime()
        return fetch(dataUrl, api.requestOptions).then(response => {

          return response.json().then(data => {

            if (!binding.eventSource) {
              const hubUrl = getHubUrlFromResponse(response)

              if (hubUrl) {
                const url = new URL(hubUrl)
                url.searchParams.append('topic', data['@id'])

                const eventSource = new EventSource(url.toString())
                eventSource.onmessage = e => {
                  binding.data = e.data
                  binding.components.forEach(component => {
                    component.vm[component.key] = e.data
                  })
                }

                binding.eventSource = eventSource

              }
            }

            binding.data = data
            binding.components.forEach(component => {
              component.vm[component.key] = data
            })

            return data
          })
        })

      } else {
        if (!binding.components.find(component => component.vm === this && component.key === key)) {
          binding.components.push({
            vm: this,
            key
          })
        }

        this[key] = binding.data

        return Promise.resolve(binding.data)
      }
    }

    Vue.prototype.$unbindApi = function (key) {
      bindings = bindings.reduce((bindings, binding) => {
        binding.components = binding.components.filter(component => !(component.vm === this && component.key === key))
        if (binding.components.length > 0) {
          bindings.push(binding)
        } else {
          if (binding.eventSource) {
            binding.eventSource.close()
          }
        }
        return bindings
      }, [])
    }
  }
}
