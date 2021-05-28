import QueryManager from './QueryManager'
import MercureClient from './MercureClient'

const THREE_MINUTES = 1000 * 60 * 3
const FIFTEEN_SECONDS = 1000 * 15

export default {
  install(
    Vue,
    { cacheTime = THREE_MINUTES, staleTime = FIFTEEN_SECONDS, topics = [] } = {}
  ) {
    const queryManager = new QueryManager({ cacheTime, staleTime })
    const mercureClient = new MercureClient()
  }
}
