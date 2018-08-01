export default {
  resource: 'discovery',
  map() {
    this.route('topCategoryWithGrandparent', { path: '/c/:grandparentSlug/:parentSlug/:slug/l/top' });

    Discourse.Site.currentProp('periods').forEach(period => {
      const top = 'top' + period.capitalize();
      this.route(top + 'CategoryWithGrandparent', { path: '/c/:grandparentSlug/:parentSlug/:slug/l/top/' + period });
    });

    Discourse.Site.currentProp('filters').forEach(filter => {
      this.route(filter + 'CategoryWithGrandparent', { path: '/c/:grandparentSlug/:parentSlug/:slug/l/' + filter });
    });

    this.route('categoryWithGrandparent', { path: '/c/:grandparentSlug/:parentSlug/:slug' });
  }
};
