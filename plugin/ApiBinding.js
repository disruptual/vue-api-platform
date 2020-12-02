import { ApiCache } from "./ApiCache";
import debounce from "lodash/debounce";
import datas from "./state";

export class ApiBinding {
  constructor(targets, vm, key, array = false, options = false) {
    this.vm = vm;
    this.key = key;
    this.targets = targets;
    this.caches = [];
    this.array = array;
    this.reloadTimeout = null;
    this.stopBindingTimeout = null;
    this.isLoading = false;
    this.vm.$data.$apiBindings = [...this.vm.$data.$apiBindings, this];
    this.options = options;
    this.update =
      this.options && this.options.debounce
        ? debounce(this._update.bind(this), this.options.debounceTimeout, {
            leading: true,
          })
        : this._update;

    this.startBinding = this.startBinding.bind(this);
    this.stopBinding = this.stopBinding.bind(this);
  }

  startBinding() {
    if (this.stopBindingTimeout) {
      clearTimeout(this.stopBindingTimeout);
    }
    this.isLoading = true;
  }

  stopBinding() {
    if (this.stopBindingTimeout) {
      clearTimeout(this.stopBindingTimeout);
    }
    this.stopBindingTimeout = setTimeout(() => {
      this.isLoading = false;
    }, 50);
  }

  static create(targets, vm, key, array = false, options = {}) {
    const binding = new ApiBinding(targets, vm, key, array, options);
    datas.bindings.push(binding);
    binding.bind();
    return binding;
  }

  _update(targets, array = false, options = this.options) {
    this.targets = targets;
    this.array = array;
    this.options = options;
    this.bind();
  }

  delete() {
    this.caches.forEach((cache) => {
      cache.removeBinding(this);
    });
    this.caches = [];
  }

  bind() {
    this.startBinding();
    let pages = null;
    if (this.options.pages) {
      pages = this.options.pages;
    }
    const targets = this.targets.reduce((targets, target) => {
      if (pages) {
        pages.forEach((page) => {
          targets.push(
            target + (target.includes("?") ? "&" : "?") + `page=${page}`
          );
        });
      } else {
        targets.push(target);
      }
      return targets;
    }, []);

    const promises = targets.map((target) => {
      this.startBinding();
      let cache;

      cache = this.caches.find((cache) => cache.urls.includes(target));
      if (cache && !cache.isLoading && !this.options.force) {
        return Promise.resolve(cache.data);
      }
      cache = datas.caches.find((cache) => cache.urls.includes(target));

      if (cache && !cache.isLoading && !this.options.force) {
        cache.addBinding(this);
        this.caches.push(cache);
        return Promise.resolve(cache.data);
      }

      if (!cache) {
        cache = new ApiCache(target, this, null, null, {
          freezeUri: this.options.freezeUri,
        });
      }
      datas.caches.push(cache);
      this.caches.push(cache);

      return cache.load();
    });

    Promise.all(promises).then((dataList) => {
      this.stopBinding();
      if (this.array || pages) {
        this.vm[this.key] = dataList.filter((data) => data);
      } else {
        this.vm[this.key] = dataList[0];
      }
    });
  }

  reload() {
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout);
    }
    this.reloadTimeout = setTimeout(() => {
      this.reloadTimeout = null;
      this.bind();
    }, 200);
  }
}
