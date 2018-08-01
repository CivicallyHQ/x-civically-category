export default {
  resource: 'tags',
  map() {
    this.route('showCategoryWithGrandparent', { path: '/c/:grandparent_category/:parent_category/:category/:tag_id' });

    Discourse.Site.currentProp('filters').forEach(filter => {
      this.route('showCategoryWithGrandparent' + filter.capitalize(), { path: '/c/:grandparent_category/:parent_category/:category/:tag_id/l/' + filter });
    });
  }
};
