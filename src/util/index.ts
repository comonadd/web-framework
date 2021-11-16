export class DefaultMap<K, V> extends Map<K, V> {
  default_constructor: () => V;
  constructor(default_constructor: () => V, ...args: any[]) {
    super(...args);
    this.default_constructor = default_constructor;
  }
  get(key: K): V {
    if (this.has(key)) return super.get(key);
    const v = this.default_constructor();
    this.set(key, v);
    return v;
  }
}
