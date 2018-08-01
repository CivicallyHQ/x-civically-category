import { withPluginApi } from 'discourse/lib/plugin-api';
import { findTopicList } from 'discourse/routes/build-topic-route';
import Category from 'discourse/models/category';
import PermissionType from 'discourse/models/permission-type';

export default {
  name: 'grandparent-category-route-edits',
  initialize(container) {
    const site = container.lookup('site:main');

    let discoveryCategoryRoutes = [
      'CategoryWithGrandparent',
    ];

    let filters = site.get('filters');
    filters.push('top');
    filters.forEach(filter => {
      discoveryCategoryRoutes.push(...[
        `${filter.capitalize()}CategoryWithGrandparent`
      ]);
    });

    site.get('periods').forEach(period => {
      discoveryCategoryRoutes.push(...[
        `Top${period.capitalize()}CategoryWithGrandparent`
      ]);
    });

    discoveryCategoryRoutes.forEach(function(route){
      var route = container.lookup(`route:discovery.${route}`);
      route.reopen({
        model(modelParams) {
          const category = Category.findBySlug(modelParams.slug, modelParams.parentSlug, modelParams.grandparentSlug);
          if (!category) {
            return Category.reloadBySlug(modelParams.slug, modelParams.parentSlug, modelParams.grandparentSlug).then((atts) => {

              if (modelParams.parentSlug) {
                atts.category.parentCategory = Category.findBySlug(modelParams.parentSlug);
              }

              if (modelParams.grandparentSlug) {
                atts.category.grandparentCategory = Category.findBySlug(modelParams.grandparentSlug);
              }

              const record = this.store.createRecord('category', atts.category);

              record.setupGroupsAndPermissions();
              this.site.updateCategory(record);

              return { category: Category.findBySlug(modelParams.slug, modelParams.parentSlug, modelParams.grandparentSlug) };
            });
          };

          return { category };
        },
      });
    });

    withPluginApi('0.8.12', api => {
      api.modifyClass(`route:tags-show`, {
        model(params) {
          var tag = this.store.createRecord("tag", { id: Handlebars.Utils.escapeExpression(params.tag_id) }),
              f = '';

          if (params.additional_tags) {
            this.set("additionalTags", params.additional_tags.split('/').map((t) => {
              return this.store.createRecord("tag", { id: Handlebars.Utils.escapeExpression(t) }).id;
            }));
          } else {
            this.set('additionalTags', null);
          }

          if (params.category) {
            f = 'c/';
            if (params.grandparent_category) { f += params.grandparent_category + '/'; }
            if (params.parent_category) { f += params.parent_category + '/'; }
            f += params.category + '/l/';
          }
          f += this.get('navMode');
          this.set('filterMode', f);

          if (params.category) { this.set('categorySlug', params.category); }
          if (params.parent_category) { this.set('parentCategorySlug', params.parent_category); }
          if (params.grandparent_category) { this.set('grandparentCategorySlug', params.grandparent_category); }

          if (tag && tag.get("id") !== "none" && this.get("currentUser")) {
            // If logged in, we should get the tag's user settings
            return this.store.find("tagNotification", tag.get("id")).then(tn => {
              this.set("tagNotification", tn);
              return tag;
            });
          }

          return tag;
        },

        afterModel(tag) {
          const controller = this.controllerFor('tags.show');
          controller.set('loading', true);

          const params = controller.getProperties('order', 'ascending');

          const categorySlug = this.get('categorySlug');
          const parentCategorySlug = this.get('parentCategorySlug');
          const grandparentCategorySlug = this.get('grandparentCategorySlug');
          const filter = this.get('navMode');
          const tag_id = (tag ? tag.id : 'none');

          if (categorySlug) {
            var category = Discourse.Category.findBySlug(categorySlug, parentCategorySlug, grandparentCategorySlug);
            if (grandparentCategorySlug) {
              params.filter = `tags/c/${grandparentCategorySlug}/${parentCategorySlug}/${categorySlug}/${tag_id}/l/${filter}`;
            } else if (parentCategorySlug) {
              params.filter = `tags/c/${parentCategorySlug}/${categorySlug}/${tag_id}/l/${filter}`;
            } else {
              params.filter = `tags/c/${categorySlug}/${tag_id}/l/${filter}`;
            }
            if (category) {
              category.setupGroupsAndPermissions();
              this.set('category', category);
            }
          } else if (this.get("additionalTags")) {
            params.filter = `tags/intersection/${tag_id}/${this.get('additionalTags').join('/')}`;
            this.set('category', null);
          } else {
            params.filter = `tags/${tag_id}/l/${filter}`;
            this.set('category', null);
          }

          return findTopicList(this.store, this.topicTrackingState, params.filter, params, {}).then((list) => {
            controller.setProperties({
              list: list,
              canCreateTopic: list.get('can_create_topic'),
              loading: false,
              canCreateTopicOnCategory: this.get('category.permission') === PermissionType.FULL
            });
          });
        }
      });
    });
  }
};
