import Category from 'discourse/models/category';
import { ajax } from 'discourse/lib/ajax';

export default {
  name: 'grandparent-category-edits',
  initialize() {

    Category.reopenClass({
      findBySlug(slug, parentSlug, grandparentSlug) {
        const categories = Category.list();

        if (grandparentSlug) {
          const grandparentCategory = Category.findSingleBySlug(grandparentSlug);

          if (grandparentCategory) {
            const parentCategory = Category.findSingleBySlug(grandparentSlug + '/' + parentSlug);

            if (parentCategory) {
              if (slug === 'none') { return grandparentCategory; }

              return categories.find(item => {
                return item && item.get('parentCategory') === parentCategory &&
                       parentCategory.get('parentCategory') === grandparentCategory &&
                       Category.slugFor(item) === (grandparentSlug + "/" + parentSlug + "/" + slug);
              });
            }
          }
        } else  {
          return this._super(...arguments);
        }
      },

      reloadBySlug(slug, parentSlug, grandparentSlug) {
        if (grandparentSlug && parentSlug) return ajax(`/c/${grandparentSlug}/${parentSlug}/${slug}/find_by_slug.json`);
        return parentSlug ? ajax(`/c/${parentSlug}/${slug}/find_by_slug.json`) : ajax(`/c/${slug}/find_by_slug.json`);
      }
    });
  }
};
