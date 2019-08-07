# vue-api-platform

Get started:

How to install:

```shell
npm i -s vue-api-platform
```

Use in your project 
```vuejs
import ApiPlugin from 'vue-api-platform/plugin'

Vue.use(ApiPlugin)
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
  },
  apiBinding() {
    // The datas are loading
  },
  apiBound() {
    // The datas are loaded
  },
  apiBindError(key, error) {
    // An error occurs during the binding
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

The mixin have got many parameters:

- expose (false) : create a mixin named like the property passed (only works with computed)
- collection (false) : set the data is an URI of a collection, so the return datas are in an array
- array (false) : set that the query is an array, so the return datas are in an array

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
    ApiMixin('item', {
      computed () {
        return this.itemUrl
      },
      expose: true
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
  },
  computed: {
    item() {
      return this.item_
    }  
  }
}
```
