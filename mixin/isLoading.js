export default {
  computed: {
    apiIsLoading() {
      return this.$data.$apiBindings.some((binding) => binding.isLoading);
    },
  },
};
