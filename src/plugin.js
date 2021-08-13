import QueryManager from './QueryManager'
import MercureClient from './MercureClient'
import ApiPlatformPlugin from './ApiPlatformPlugin'
import HttpClient, { HTTP_VERBS } from './HttpClient'
import globalMixin from './globalMixin'

class VueApiPlatformPlugin {
  onHttpResponse(response) {
    if (response.headers.link) {
      this.mercureClient.start(response.headers.link)
    }

    const { config } = response

    const isMutation = [
      HTTP_VERBS.PUT,
      HTTP_VERBS.PATCH,
      HTTP_VERBS.POST
    ].includes(config.method.toUpperCase)

    if (isMutation) {
      const queryKey = response.data['@id']
      if (queryKey) {
        this.manager.setQueryData(response.data)
      }
    }

    return response
  }

  onMercureMessage(event) {
    const data = JSON.parse(event.data)
    const key = data['@id']
    const query = this.manager.has(key)
      ? this.manager.get(key)
      : this.manager.create(key)
    query.setData(data)

    if (!data['mercure:related']) return

    data['mercure:related'].forEach(relatedKey => {
      const relatedQuery = this.manager.has(relatedKey)
        ? this.manager.get(relatedKey)
        : this.manager.create(relatedKey)

      relatedQuery.load(this.httpClient.get.bind(this.httpClient), {
        force: true
      })
    })
  }

  install(
    Vue,
    { baseUrl, httpClient, cacheTime, staleTime, topics = [] } = {}
  ) {
    this.manager = new QueryManager({ cacheTime, staleTime })
    this.httpClient = httpClient || new HttpClient({ baseUrl })
    this.mercureClient = new MercureClient(topics)

    manager.plugin(new ApiPlatformPlugin())
    httpClient.onResponse(this.onHttpResponse.bind(this))
    mercureClient.onMessage(this.onMercureMessage.bind(this))

    Vue.prototype.$queryManager = manager
    Vue.prototype.$mercure = mercureClient
    Vue.prototype.$http = httpClient

    Vue.mixin(globalMixin)
  }
}

export default new VueApiPlatformPlugin()
