export default {
  created() {
    Object.keys(this.$queries).forEach(key => {
      this.$watch(value.url.bind(this), newVal => this.$bindQuery(key, newVal))
    })
  },

  destroyed() {
    Object.values(this.$queries).forEach(value => {
      if (value.unsubscribe) value.unsubscribe()
    })
  },

  methods: {
    $bindQuery(key, queryKey) {
      if (this.$queries[key].unsubscribe) {
        this.$queries[key].unsubscribe()
      }

      if (!queryKey) this[key] = null

      this.$queries[key].unsubscribe = this.$queryManager.observe(
        queryKey,
        state => {
          this[key] = state
        },
        this.$queries[key]
      )

      this.$queryManager.load(queryKey, this.$http.get, {})
    }
  }
}
