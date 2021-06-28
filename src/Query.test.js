import Query from './Query'
import QueryManager from './QueryManager'

describe('query', () => {
  let query
  let manager

  beforeEach(() => {
    manager = new QueryManager()
    query = new Query('my key', { cacheTime: 1000, staleTime: 1000, manager })
  })

  test('should initialize without throwing', () => {
    expect(() => new Query('myKey')).not.toThrow()
  })

  test('should throw if no key is provided', () => {
    expect(() => new Query()).toThrow()
  })

  test('should run listeners twice on succesful load', async () => {
    const callback = jest.fn()

    query.on(Query.STATE_CHANGE, callback)
    await query.load(() => 'foo')

    expect(callback).toHaveBeenCalledTimes(2)
  })

  test('should emit the query state when loading starts', async () => {
    const callback = jest.fn()
    const result = 123
    query.on(Query.STATE_CHANGE, callback)
    await query.load(() => Promise.resolve(result))

    const [loadingEvent] = callback.mock.calls
    expect(loadingEvent[0]).toBeInstanceOf(CustomEvent)
    expect(loadingEvent[0].detail).toBeObject()
    expect(loadingEvent[0].detail.isLoading).toBe(true)
    expect(loadingEvent[0].detail.isRefreshing).toBe(true)
  })

  test('should emit the query state on load success', async () => {
    const callback = jest.fn()
    const result = 123
    query.on(Query.STATE_CHANGE, callback)
    await query.load(() => Promise.resolve(result))

    const [, successEvent] = callback.mock.calls

    expect(successEvent[0]).toBeInstanceOf(CustomEvent)
    expect(successEvent[0].detail).toBeObject()
    expect(successEvent[0].detail.isLoading).toBe(false)
    expect(successEvent[0].detail.isRefreshing).toBe(false)
    expect(successEvent[0].detail.error).toBe(null)
    expect(successEvent[0].detail.data).toBe(result)
  })

  test('should emit the query state on load error', async () => {
    const callback = jest.fn()
    const error = 'my error'
    query.on(Query.STATE_CHANGE, callback)
    await query.load(() => Promise.reject(error))

    const [, errorEvent] = callback.mock.calls

    expect(errorEvent[0]).toBeInstanceOf(CustomEvent)
    expect(errorEvent[0].detail).toBeObject()
    expect(errorEvent[0].detail.isLoading).toBe(false)
    expect(errorEvent[0].detail.isRefreshing).toBe(false)
    expect(errorEvent[0].detail.error).toBe(error)
    expect(errorEvent[0].detail.data).toBe(null)
  })

  test('should emit the query state when query becomes stale', async () => {
    jest.useFakeTimers()
    const callback = jest.fn()
    query.on(Query.STATE_CHANGE, callback)

    await query.load(() => Promise.resolve(true))

    jest.runAllTimers()

    const [, , staleEvent] = callback.mock.calls

    expect(staleEvent[0]).toBeInstanceOf(CustomEvent)
    expect(staleEvent[0].detail).toBeObject()
    expect(staleEvent[0].detail.isStale).toBe(true)
    jest.useRealTimers()
  })
})
