# vue-api-platform

## How to install:

```shell
npm i -s vue-api-platform
```

## Use in your project 
```js
import ApiPlugin from 'vue-api-platform/plugin'

Vue.use(ApiPlugin)
```

## Use in a component
```js
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
    user_() {
      return this.user
    }
  },
  apiBindError(key, error) {
    // An error occurs during the binding
  }
}
```

## Use with the mixin with props

```js
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
    user_() {
      return this.user
    }
  }
}
```

The mixin have got many parameters:

- expose (false) : create a mixin named like the property passed (only works with computed)
- collection (false) : set the data is an URI of a collection, so the return datas are in an array
- array (false) : set that the query is an array, so the return datas are in an array
- required (true) : set the props required or not

With parameters

```js
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
    item_() {
      return this.itemUrl
    }
  },
  computed: {
    item() {
      return this.item_
    }  
  }
}
```

## Other utils mixin

### isLoading

Create a computed `apiIsLoading` which return a boolean if the there's a resource which is actually downloading 

```js
import apiIsLoading from 'vue-api-platform/mixin/isLoading'

export default {
  mixins: [
    apiIsLoading
  ]
}
```

### loadingRate

Create a computed `apiLoadingRate` which return a percent that correspond to the number of variable which are actually downloading (0 => nothing downloaded, 100 => everything is downloaded)  

```js
import apiLoadingRate from 'vue-api-platform/mixin/loadingRate'

export default {
  mixins: [
    apiLoadingRate
  ]
}
```
