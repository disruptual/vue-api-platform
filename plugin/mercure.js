import { ApiCache } from './ApiCache'
import datas from './state'

export const connectMercure = url => {
  const oldEventSource = datas.eventSource
  datas.eventSource = new EventSource(url.toString(), {
    withCredentials: datas.mercure.withCredentials
  })
  datas.eventSource.onmessage = e => {
    const data = JSON.parse(e.data)
    const target = data['@id']

    let cache = datas.caches.find(cache => cache.urls.includes(target))
    // a mercure update always have at least thie '@id' property
    if (Object.keys(data).length <= 1) return

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

    datas.mercure.listeners.forEach(listener => {
      listener(data)
    })
  }
  if (oldEventSource) {
    oldEventSource.close()
  }
}

export const startMercure = response => {
  try {
    if (
      datas.mercure.topics.length &&
      !datas.eventSource &&
      response.headers.has('Link')
    ) {
      const matches = response.headers
        .get('Link')
        .match(/<([^>]+)>;\s+rel=(?:mercure|"[^"]*mercure[^"]*")/)
      if (matches) {
        const hubUrl = matches[1]
        const url = new URL(hubUrl)
        datas.mercure.topics.forEach(topic => {
          url.searchParams.append('topic', topic)
        })
        connectMercure(url)
      }
    }
  } catch (e) {
    console.error(e)
  }
}
