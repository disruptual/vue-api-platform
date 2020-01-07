export default function (entity, {computed=null, expose=false, collection=false, suffix='_', prefix='', array=false, required=true, pages=null, options={}} = {}) {

  if(pages) {
    options.pages = pages
  }
  const entity_ = prefix + entity + suffix
  const mixin = {
    data() {
      return {
        [entity_]: array ? [] : null
      }
    }
  }

  if (computed) {
    mixin.api = {
      [entity_]: options ? {...options, func: computed} : computed
    }

    if (expose) {
      if (collection) {
        mixin.computed = {
          [entity]() {
            if (!this[entity_]) {
              return []
            }
            if (Array.isArray(this[entity_])) {
              return this[entity_].reduce((entities, page) => {
                return [...entities, ...page['hydra:member']]
              }, [])
            }
            return this[entity_]['hydra:member']
          }
        }
      } else {
        mixin.computed = {
          [entity]() {
            return this[entity_]
          }
        }
      }
    }
  } else {
    mixin.props = {
      [entity]: {
        required
      }
    }
    const func = function() {
      return this[entity]
    }
    mixin.api = {
      [entity_]: options ? {...options, func} : func
    }
  }

  return mixin
}
