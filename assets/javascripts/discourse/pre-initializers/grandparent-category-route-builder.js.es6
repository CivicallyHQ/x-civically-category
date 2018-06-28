import buildCategoryRoute from 'discourse/routes/build-category-route';
import DiscoverySortableController from 'discourse/controllers/discovery-sortable';
import TagsShowRoute from 'discourse/routes/tags-show';

export default {
  after: 'inject-discourse-objects',
  name: 'grandparent-category-route-builder',

  initialize(registry, app) {
    app.DiscoveryCategoryWithGrandparentController = DiscoverySortableController.extend();
    app.DiscoveryCategoryWithGrandparentRoute = buildCategoryRoute('default');

    const site = Discourse.Site.current();
    site.get('filters').forEach(filter => {
      const filterCapitalized = filter.capitalize();
      app[`Discovery${filterCapitalized}CategoryWithGrandparentController`] = DiscoverySortableController.extend();
      app[`Discovery${filterCapitalized}CategoryWithGrandparentRoute`] = buildCategoryRoute(filter);
    });

    Discourse.DiscoveryTopCategoryWithGrandparentController = DiscoverySortableController.extend();
    Discourse.DiscoveryTopCategoryWithGrandparentRoute = buildCategoryRoute('top');

    site.get('periods').forEach(period => {
      const periodCapitalized = period.capitalize();
      app[`DiscoveryTop${periodCapitalized}CategoryWithGrandparentController`] = DiscoverySortableController.extend();
      app[`DiscoveryTop${periodCapitalized}CategoryWithGrandparentRoute`] = buildCategoryRoute('top/' + period);
    });

    app["TagsShowCategoryWithGrandparentRoute"] = TagsShowRoute.extend();

    site.get('filters').forEach(function(filter) {
      app["TagsShowCategoryWithGrandparent" + filter.capitalize() + "Route"] = TagsShowRoute.extend({ navMode: filter });
    });
  }
};
