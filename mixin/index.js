export default function (entity, {computed=null, expose=false, collection=false, suffix='_', prefix=''} = {}) {

  const entity_ = prefix + entity + suffix
  const mixin = {
    data() {
      return {
        [entity_]: null
      }
    }
  }

  if (computed) {
    mixin.api = {
      [entity_]: computed
    }

    if (expose) {
      if (collection) {
        mixin.computed = {
          [entity]() {
            return this[entity_] ? this[entity_]['hydra:member'] : []
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
        type: [Object, String],
        required: true
      }
    }
    mixin.api = {
      [entity_]() {
        return this[entity]
      }
    }
  }

  return mixin
}
