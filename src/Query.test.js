import Query from './Query'

test('should initialize without throwing', () => {
  expect(() => new Query('myKey')).not.toThrow()
})

test('should throw if no key is provided', () => {
  expect(() => new Query()).toThrow()
})
