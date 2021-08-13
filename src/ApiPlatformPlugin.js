export default class ApiPlatformPlugin {
  _isCollection(data) {
    return 'hydra:member' in data
  }

  transformQuery(state) {
    if (!state.data) return state

    data.uri = data['@id']
    data.resourceType = data['@type']
    data.resourceContext = data['@context']

    if (this._isCollection(state.data)) {
      data.totalItems = data['hydra:totalItems']
      data.collection = data['hydra:member'].map(entity => {
        const { '@id': uri, ...rest } = entity

        return { uri, ...rest }
      })
    }
  }

  onQuerySuccess(query, { queryManager }) {
    queryManager.forEach((entry, key) => {
      if (key === query.key) return
      if (entry.isFetching) return

      if (this._isCollection(query.state.data)) {
        query.state.data.forEach(entity => this.syncEntity(entity))
      } else {
        this.syncEntity(query.state.data)
      }
    })
  }

  syncEntity(entity, queryManager) {
    queryManager.forEach((query, key) => {
      let updatedData

      if (this._isCollection(query.state.data)) {
        updatedData = query.state.data['hydra:member'].map(member => {
          if (entity['@id'] === member['@id']) {
            return { ...member, ...entity }
          }

          return member
        })
      } else if (entity['@id'] === query.state.data['@id']) {
        updatedData = { ...query.state.data, entity }
      }

      if (updatedData) query.setData(updatedData)
    })
  }
}
