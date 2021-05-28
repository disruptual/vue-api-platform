import QueryManager from './QueryManager'
import Query from './Query'

describe('queryManager', () => {
  let manager

  beforeEach(() => {
    manager = new QueryManager()
  })

  test('should initialize without throwing', () => {
    expect(QueryManager).toBeDefined()
    expect(() => new QueryManager()).not.toThrow()
  })

  test('should have an empty cache at initialization', () => {
    expect(manager.size).toBe(0)
  })

  test('should throw when creating a query without a correct key', () => {
    expect(() => manager.create()).toThrow()
    expect(() => manager.create(1)).toThrow()
  })

  test('should throw when creating a query with an existing key', () => {
    manager.create('myKey')
    expect(() => manager.create('myKey')).toThrow()
  })

  test('should increase cache size when creating queries', () => {
    manager.create('myKey')
    expect(manager.size).toBe(1)
    manager.create('myOtherKey')
    expect(manager.size).toBe(2)
  })

  test('should return true if the entry is present in the cache', () => {
    manager.create('myKey')

    expect(manager.has('myKey')).toBe(true)
  })

  test('should return false if the entry is not present in the cache', () => {
    expect(manager.has('myKey')).toBe(false)
  })

  test('should return a Query object with the correct key', () => {
    manager.create('myKey')

    expect(manager.get('myKey')).toBeInstanceOf(Query)
  })

  test('should load the query', () => {
    manager.create('myKey')
    const spy = jest.spyOn(manager.get('myKey'), 'load')

    manager.load('myKey')
    expect(spy).toHaveBeenCalled()
  })
})
