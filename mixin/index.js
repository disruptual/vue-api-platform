export default function (entity, computed=null) {

  const mixin = {
    data() {
      return {
        [entity + '_']: null
      }
    }
  }

  if (computed) {
    return {
      ...mixin,
      api: {
        [entity + '_']: computed
      }
    }
  } else {
    return {
      ...mixin,
      props: {
        [entity]: {
          type: [Object, String],
          required: true
        }
      },
      api: {
        [entity + '_']() {
          return this[entity]
        }
      }
    }
  }
}
