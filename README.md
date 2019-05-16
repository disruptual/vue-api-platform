# vue-api-platform

Get started:

How to install:

```shell
npm i -s vue-api-platform
```

Use in your project 
```vuejs
import ApiPlugin from 'vue-api-platform/plugin'

Vue.use(ApiPlugin, {
  baseURL: process.env.VUE_APP_API
})
```

Use in a component
```vuejs
export default {
  data() {
    return {
      user_: null
    }
  },
  props: [
    'user'
  ],
  api: {
    user_: {
      computed() {
        return this.user
      }
    }
  }
}
```

Use with the mixin with props

```vuejs
import ApiMixin from 'vue-api-platform/mixin'

export default {
  mixins: [
    ApiMixin('user')
  ]
}

//Is the same than this
export default {
  data() {
    return {
      user_: null
    }
  },
  props: {
    user: {
      type: [Object, String],
      required: true
    }
  },
  api: {
    user_: {
      computed() {
        return this.user
      }
    }
  }
}
```

With parameters

```vuejs
import ApiMixin from 'vue-api-platform/mixin'

export default {
  data() {
    return {
      itemUrl: null,
    }
  },
  mixins: [
    ApiMixin('item', function () {
      return this.itemUrl
    })
  ]
}

//Is the same than this
export default {
  data() {
    return {
      itemUrl: null,
      item_: null
    }
  },
  api: {
    item_: {
      computed () {
        return this.itemUrl
      }
    }
  }
}
```
