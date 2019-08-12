export default {
  computed: {
    apiIsLoading() {
      return this.$data.$apiBindings.reduce((nb, apiBinding) => nb + apiBinding.isLoading, 0) > 0
    }
  }
}
