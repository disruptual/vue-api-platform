import QueryManager from './QueryManager'
import MercureClient from './MercureClient'

export default {
  install(Vue, { cacheTime, staleTime, topics = [] } = {}) {
    Vue.prototype.$queryManager = new QueryManager({ cacheTime, staleTime })
    Vue.prototype.$mercureClient = new MercureClient()
  }
}
