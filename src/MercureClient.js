import { NativeEventSource, EventSourcePolyfill } from 'event-source-polyfill'

window.EventSource = NativeEventSource || EventSourcePolyfill

const LINK_REGEXP = /<([^>]+)>;\s+rel=(?:mercure|"[^"]*mercure[^"]*")/

export default class MercureClient extends EventTarget {
  static MESSAGE = 'message'

  _eventSource = null
  _hubUrl = null
  _topics = []

  constructor(topics) {
    super()
    this.start = this.start.bind(this)
    this.connect = this.connect.bind(this)
    this.onMessage = this.onMessage.bind(this)
    this._topics = topics
  }

  start(link) {
    const matches = link.match(LINK_REGEXP)

    if (matches) {
      this._hubUrl = new URL(matches[1])

      this._topics.forEach(topic => {
        this._hubUrl.searchParams.append('topic', topic)
      })

      this.connect()
    }
  }

  onMessage(e) {
    this.dispatchEvent(MercureClient.MESSAGE, e)
  }

  connect() {
    const oldEventSource = this._eventSource
    this._eventSource = new window.EventSource(url.toString(), {
      withCredentials: false
    })
    this._eventSource.onmessage = this.onMessage
    oldEventSource?.close?.()
  }
}
