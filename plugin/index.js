import fetchIntercept from "@neorel/fetch-intercept";
import { ApiCache } from "./ApiCache";
import { ApiBinding } from "./ApiBinding";
import { connectMercure, startMercure } from "./mercure";
import datas from "./state";

const DEFAULT_DEBOUNCE_TIMEOUT = 200;

const generateUrls = (targets) => {
  if (targets) {
    if (!Array.isArray(targets)) {
      targets = [targets];
    }
    return targets.reduce((targets, target) => {
      if (typeof target === "object" && target.hasOwnProperty("@id")) {
        targets.push(target["@id"]);
      } else if (typeof target === "string") {
        targets.push(target);
      }
      return targets;
    }, []);
  }
};

const cacheDatas = function (data) {
  if (data["@id"]) {
    let cache = datas.caches.find((cache) => cache.urls.includes(data["@id"]));
    if (!cache) {
      cache = new ApiCache(data["@id"]);
      datas.caches.push(cache);
    }
    cache.data = data;

    datas.mercure.listeners.forEach((listener) => {
      listener(data);
    });
  }
};

export default {
  install(
    Vue,
    {
      debounce = false,
      debounceTimeout = DEFAULT_DEBOUNCE_TIMEOUT,
      staticContexts = [],
      mercure = {},
    }
  ) {
    Object.assign(datas.mercure, mercure);
    datas.staticContexts = staticContexts;

    if (window) {
      window.ApiDatas = datas;
    }

    fetchIntercept.register({
      request: (url, config) => {
        return [
          url,
          {
            ...config,
            credentials: datas.mercure.withCredentials ? "include" : "omit",
          },
        ];
      },
      requestError: (error) => Promise.reject(error),
      response: (response) => {
        if (!response.ok) return response;
        startMercure(response);
        const { request } = response;
        if (request && ["PUT", "POST", "PATCH"].includes(request.method)) {
          response
            .clone()
            .json()
            .then(cacheDatas)
            .catch((e) => {
              //nothing
            });
        }
        return response;
      },
      responseError: (error) => Promise.reject(error),
    });

    Vue.config.optionMergeStrategies.api =
      Vue.config.optionMergeStrategies.methods;

    Vue.mixin({
      data() {
        return {
          $apiBindings: [],
        };
      },
      created() {
        const apiOptions = this.$options.api;
        if (apiOptions) {
          Object.keys(apiOptions).forEach((key) => {
            let func = null;
            const options = {};
            if (apiOptions[key] instanceof Function) {
              func = apiOptions[key];
            } else if (apiOptions[key] instanceof Object) {
              if (
                apiOptions[key].hasOwnProperty("func") &&
                apiOptions[key].func instanceof Function
              ) {
                func = apiOptions[key].func;
              }
              if (
                apiOptions[key].hasOwnProperty("pages") &&
                apiOptions[key].pages instanceof Function
              ) {
                options.pages = apiOptions[key].pages.bind(this)();
              }
              if (apiOptions[key].hasOwnProperty("debounce")) {
                options.debounce = !!apiOptions[key].debounce;
              }
              if (
                apiOptions[key].hasOwnProperty("debounceTimeout") &&
                typeof apiOptions[key].debounceTimeout === "number"
              ) {
                options.debounceTimeout = apiOptions[key].debounceTimeout;
              }
              if (apiOptions[key].freezeUri) {
                options.freezeUri = apiOptions[key].freezeUri;
              }
              if (apiOptions[key].force) {
                options.force = apiOptions[key].force;
              }
            }
            if (func) {
              this.$watch(
                func.bind(this),
                (newVal) => {
                  this.$bindApi(key, newVal, options);
                },
                { immediate: true }
              );
            }
            if (apiOptions[key].pages) {
              this.$watch(apiOptions[key].pages.bind(this), (newVal) => {
                const binding = datas.bindings.find(
                  (binding) => binding.vm === this && binding.key === key
                );
                if (binding) {
                  options.pages = newVal;
                  binding.options = options;
                  binding.bind();
                }
              });
            }
          });
        }
      },
      beforeDestroy() {
        const apiOptions = this.$options.api;
        if (apiOptions) {
          Object.keys(apiOptions).forEach((key) => {
            this.$unbindApi(key);
          });
        }
      },
    });

    Vue.prototype.$bindApi = function (key, target, options = {}) {
      const defaultOptions = { debounce, debounceTimeout };
      const dataUrls = generateUrls(target);
      if (!dataUrls || dataUrls.length === 0) {
        this[key] = Array.isArray(target) ? [] : null;
        return;
      }

      let binding = datas.bindings.find(
        (binding) => binding.vm === this && binding.key === key
      );
      if (binding) {
        binding.update(dataUrls, Array.isArray(target), options);
      } else {
        ApiBinding.create(
          dataUrls,
          this,
          key,
          Array.isArray(target),
          Object.assign(defaultOptions, options)
        );
      }
    };

    Vue.prototype.$refreshApi = function (key) {
      const binding = datas.bindings.find(
        (binding) => binding.vm === this && binding.key === key
      );
      if (binding) {
        binding.caches.forEach((cache) => {
          cache.load();
        });
      }

      const cache = datas.caches.find((cache) => cache.urls.includes(key));
      if (cache) {
        cache.load();
      }
    };

    Vue.prototype.$cacheDataApi = cacheDatas;

    Vue.prototype.$unbindApi = function (key) {
      datas.bindings = datas.bindings.reduce((bindings, binding) => {
        if (binding.vm === this && binding.key === key) {
          binding.delete();
        } else {
          bindings.push(binding);
        }
        return bindings;
      }, []);
    };

    Vue.prototype.$restartMercure = function () {
      if (datas.eventSource) {
        connectMercure(datas.eventSource.url);
      }
    };

    Vue.prototype.$registerMercure = function (listener) {
      datas.mercure.listeners.push(listener);
    };

    Vue.prototype.$unregisterMercure = function (listener) {
      datas.mercure.listeners = datas.mercure.listeners.filter(
        (l) => l !== listener
      );
    };
  },
};
