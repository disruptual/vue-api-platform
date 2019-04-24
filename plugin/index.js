export default {
  install(Vue, {baseURL, cacheTime = 30} = {}) {
    let bindings = []

    const generateUrl = ({target}) => {
      if (typeof target === 'object' && target.hasOwnProperty('@id')) {
        return baseURL + target['@id']
      }
      if (typeof target === 'string') {
        return baseURL + target
      }
    }

    const getHubUrlFromResponse = response => {
      return response
        && response.headers
        && response.headers.get
        && response.headers.get('Link')
          .match(/<([^>]+)>;\s+rel=(?:mercure|"[^"]*mercure[^"]*")/)[1]
    }

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

    Vue.prototype.$bindApi = function (key, data) {
      const dataUrl = generateUrl(data)
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
        return fetch(dataUrl).then(response => {
          const data = response.data
          binding.data = data
          binding.components.forEach(component => {
            component.vm[component.key] = data
          })

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

          }

          return data
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
