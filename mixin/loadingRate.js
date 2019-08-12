export default {
  computed: {
    apiLoadingRate() {
      const nbApis = this.$data.$apiBindings.length
      const nbLoadings = this.$data.$apiBindings.reduce((nb, apiBinding) => nb + apiBinding.isLoading, 0)
      const rate = nbApis ? Math.round(nbLoadings * 100 / nbApis) : 0
      return 100 - rate
    }
  }
}
