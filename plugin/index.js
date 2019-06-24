const api = {
  requestOptions: {
    headers: new Headers()
  }
}

let bindings = []

let mercureHubs = {}

class MercureHub {
  constructor(hubUrl, ...topics) {
    this.topics = topics

    const url = new URL(hubUrl)
    topics.forEach(topic => {
      url.searchParams.append('topic', topic)
    })

    this.eventSource = new EventSource(url.toString())
    this.eventSource.onmessage = e => {
      binding.data = e.data
      binding.components.forEach(component => {
        component.vm[component.key] = e.data
      })
    }
  }

  static bind(hubUrl, ...topics) {
    let hub = mercureHubs[hubUrl]
    if (hub) {
      const oldHub = hub

      hub = new MercureHub(hubUrl, ...[...oldHub.topics, ...topics])
      mercureHubs[hubUrl] = hub

      oldHub.eventSource.close()

      return hub
    } else {
      hub = new MercureHub(hubUrl, ...topics)
      mercureHubs[hubUrl] = hub
      return hub
    }
  }

  static unbind(hubUrl, ...topics) {
    let hub = mercureHubs[hubUrl]

    if (hub) {
      const oldHub = hub

      hub = new MercureHub(hubUrl, ...hub.topics.filter(topic => !topics.includes(topic)))
      mercureHubs[hubUrl] = hub

      oldHub.eventSource.close()

      return hub
    }
  }
}



const generateUrl = (target) => {
  if (target) {
    if (typeof target === 'object' && target.hasOwnProperty('@id')) {
      return target['@id']
    }
    if (typeof target === 'string') {
      return target
    }
  }
}

const getHubUrlFromResponse = response => {
  return null
  // if (response
  //   && response.headers
  //   && response.headers.get
  //   && response.headers.get('Link')
  // ) {
  //   const matches = response.headers.get('Link')
  //     .match(/<([^>]+)>;\s+rel=(?:mercure|"[^"]*mercure[^"]*")/)
  //   if (matches) {
  //     return matches[1]
  //   }
  // }
}

class Binding {

  constructor(dataUrl, vm, key, data = null, hubUrl = null) {
    this.targets = [dataUrl]
    this.related = []
    this.data_ = data
    this.update = data ? (new Date()).getTime() : 0
    this.hubUrl = hubUrl
    this.components = [
      {
        vm,
        key
      }
    ]
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
          return bindings.find(binding => binding.targets.includes(member['@id'])).data || member
        })
      }
    } else {
      return this.data_
    }
  }

  set data(value) {
    this.data_ = value
  }
}

export default {
  install(Vue, {baseURL = '', cacheTime = 30} = {}) {
    Vue.prototype.$api = api

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
        binding = new Binding(dataUrl, this, key)
        bindings.push(binding)
      } else if (!binding.components.find(component => component.vm === this && component.key === key)) {
        binding.components.push({
          vm: this,
          key
        })
      }

      if (binding.update < (new Date()).getTime() - cacheTime * 1000) {

        binding.update = (new Date()).getTime()

        return fetch(baseURL + dataUrl, api.requestOptions).then(response => {

          return response.json().then(data => {

            const hubUrl = getHubUrlFromResponse(response)

            if (data['@type'] === 'hydra:Collection') {
              data['hydra:member'].forEach(member => {
                let memberBinding = bindings.find(memberBinding => memberBinding.targets.includes(member['@id']))

                if (memberBinding) {
                  memberBinding.components.forEach(component => {
                    component.vm[component.key] = member
                  })
                  memberBinding.data = member
                } else {
                  memberBinding = new Binding(member['@id'], this, key, member)
                  bindings.push(memberBinding)
                }

                memberBinding.related.push(...binding.targets)
              })
              if (hubUrl) {
                let topic = dataUrl.split('?')[0]
                if (!/\/$/.test(topic)) {
                  topic += '/'
                }
                MercureHub.bind(hubUrl, baseURL + topic + '{id}')
              }
            } else {
              if (hubUrl) {
                MercureHub.bind(hubUrl, baseURL + dataUrl)
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

        this[key] = binding.data

        return Promise.resolve(binding.data)
      }
    }

    Vue.prototype.$unbindApi = function (key) {
      bindings = bindings.reduce((bindings, binding) => {
        binding.components = binding.components.filter(component => !(component.vm === this && component.key === key))
        binding.related = binding.related.filter(related => bindings.find(binding => binding.targets.includes(related)))
        if (binding.components.length > 0 || binding.related.length > 0) {
          bindings.push(binding)
        } else if (binding.hubUrl) {
          MercureHub.unbind(binding.hubUrl, ...binding.targets)
        }
        return bindings
      }, [])
    }
  }
}
