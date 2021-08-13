import axios from 'axios'

export const HTTP_VERBS = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete'
}

export default class HttpClient {
  constructor({ baseUrl }) {
    this.createInstance(baseUrl)
  }

  get client() {
    return this.axios
  }

  async makeRequest(url, { raw = false, ...config }) {
    const promise = this.axios(url, config)

    if (raw) return promise

    const response = await promise
    return response.data
  }

  createInstance(baseUrl) {
    this.axios = axios.create({
      baseURL: baseUrl,
      responseType: 'json',
      withCredentials: true
    })

    this.axios.defaults.headers.post['Content-Type'] = 'application/json'
    this.axios.defaults.headers.put['Content-Type'] = 'application/json'
    this.axios.defaults.headers.patch['Content-Type'] = 'application/json'
  }

  onRequest(cb) {
    this.axios.interceptors.request.use(cb)

    return this
  }

  onResponse(cb) {
    this.axios.interceptors.response.use(cb)

    return this
  }

  get(url, config = {}) {
    return this.makeRequest(url, { method: 'get', ...config })
  }

  post(url, config = {}) {
    return this.makeRequest(url, { method: 'post', ...config })
  }

  put(url, config = {}) {
    return this.makeRequest(url, { method: 'put', ...config })
  }

  delete(url, config = {}) {
    return this.makeRequest(url, { method: 'delete', ...config })
  }
}
