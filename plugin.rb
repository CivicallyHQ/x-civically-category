# name: civically-category-extension
# about: Extends the Discourse category functionality
# version: 0.1
# authors: Angus McLeod
# url: https://github.com/civicallyhq/x-civically-category

after_initialize do
  Discourse::Application.routes.append do
    get "c/:grandparent_category_slug/:parent_category_slug/:category_slug/find_by_slug" => "categories#find_by_slug"
    get "c/:grandparent_category/:parent_category/:category.rss" => "list#category_feed", format: :rss
    get "c/:grandparent_category/:parent_category/:category/(:id)" => "list#grandparent_category_parent_category_category_latest", constraints: { id: /\d+/ }
    get "c/:grandparent_category/:parent_category/:category/l/top" => "list#grandparent_category_parent_category_category_top", as: "grandparent_category_parent_category_category_top"

    TopTopic.periods.each do |period|
      get "c/:grandparent_category/:parent_category/:category/l/top/#{period}" => "list#grandparent_category_parent_category_category_top_#{period}", as: "grandparent_category_parent_category_category_top_#{period}"
    end

    Discourse.filters.each do |filter|
      get "c/:grandparent_category/:parent_category/:category/l/#{filter}" => "list#grandparent_category_parent_category_category_#{filter}", as: "grandparent_category_parent_category_category_#{filter}"
    end

    scope "/tags" do
      constraints(tag_id: /[^\/]+?/, format: /json|rss/) do
        get '/c/:grandparent_category/:parent_category/:category/:tag_id' => 'tags#show', as: 'tag_grandparent_category_parent_category_category_show'

        Discourse.filters.each do |filter|
          get "/c/:grandparent_category/:parent_category/:category/:tag_id/l/#{filter}" => "tags#show_#{filter}", as: "tag_grandparent_category_parent_category_category_show_#{filter}"
        end
      end
    end
  end

  module CivicallyCategoryModelExtension
    def query_category(slug_or_id, parent_category_id, grandparent_category_id = nil)
      if grandparent_category_id
        self.where("slug = ? AND parent_category_id = ? AND parent_category_id in (
                      SELECT id FROM categories WHERE parent_category_id = ?
                    )", slug_or_id, parent_category_id, grandparent_category_id).first ||
        self.where("id = ? AND parent_category_id = ? AND parent_category_id in (
                      SELECT id FROM categories WHERE parent_category_id = ?
                    )", slug_or_id.to_i, parent_category_id, grandparent_category_id).first
      else
        super(slug_or_id, parent_category_id)
      end
    end
  end

  require_dependency 'category'
  class ::Category
    def url
      url = @@url_cache[self.id]
      unless url
        url = "#{Discourse.base_uri}/c"
        url << "/#{grandparent_category.slug}" if grandparent_category
        url << "/#{parent_category.slug}" if parent_category_id
        url << "/#{slug}"
        url.freeze

        @@url_cache[self.id] = url
      end

      url
    end

    def grandparent_category
      @grandparent_category ||= begin
        if self.parent_category_id.present?
          Category.where(id: self.parent_category.parent_category_id).first
        else
          nil
        end
      end
    end

    def self.query_grandparent_category(grandparent_slug)
      self.where(slug: grandparent_slug, parent_category_id: nil).pluck(:id).first ||
      self.where(id: grandparent_slug.to_i).pluck(:id).first
    end

    def self.query_parent_category(parent_slug)
      self.where(slug: parent_slug).pluck(:id).first ||
      self.where(id: parent_slug.to_i).pluck(:id).first
    end

    def self.find_by_slug(category_slug, parent_category_slug = nil, grandparent_category_slug = nil)
      if parent_category_slug
        parent_category_id = self.where(slug: parent_category_slug).pluck(:id).first

        if grandparent_category_slug
          grandparent_category_id = self.where(slug: grandparent_category_slug).pluck(:id).first

          self.where("slug = ? AND parent_category_id = ? AND parent_category_id in (
                        SELECT id FROM categories WHERE parent_category_id = ?
                      )", category_slug, parent_category_id, grandparent_category_id).first
        else
          self.where(slug: category_slug, parent_category_id: parent_category_id).first
        end
      else
        self.where(slug: category_slug, parent_category_id: nil).first
      end
    end

    class << self
      prepend CivicallyCategoryModelExtension
    end
  end

  module CivicallyCategoryListControllerExtension
    private def page_params(opts = nil)
      if @category && @category.grandparent_category
        grandparent_category = @category.grandparent_category.slug_for_url
        super.merge(grandparent_category: grandparent_category)
      else
        super
      end
    end

    private def also_set_category
      set_category
    end

    private def set_category
      slug_or_id = params.fetch(:category)
      parent_slug_or_id = params[:parent_category]
      grandparent_slug_or_id = params[:grandparent_category]
      id = params[:id].to_i

      parent_category_id = nil
      grandparent_category_id = nil

      if parent_slug_or_id.present?
        parent_category_id = Category.query_parent_category(parent_slug_or_id)
        permalink_redirect_or_not_found && (return) if parent_category_id.blank? && !id
      end

      if grandparent_slug_or_id.present?
        grandparent_category_id = Category.query_grandparent_category(grandparent_slug_or_id)
      end

      @category = Category.query_category(slug_or_id, parent_category_id, grandparent_category_id)

      # Redirect if we have `/c/:parent_category/:category/:id`
      if id
        category = Category.find_by_id(id)
        (redirect_to category.url, status: 301) && return if category
      end

      permalink_redirect_or_not_found && (return) if !@category

      @description_meta = @category.description_text
      raise Discourse::NotFound unless guardian.can_see?(@category)

      if use_crawler_layout?
        @subcategories = @category.subcategories.select { |c| guardian.can_see?(c) }
      end
    end
  end

  require_dependency 'list_controller'
  class ::ListController
    before_action :also_set_category, only: [
      Discourse.filters.map { |f| :"grandparent_category_parent_category_category_#{f}" },
      :grandparent_category_parent_category_category_top,
      TopTopic.periods.map { |p| :"grandparent_category_parent_category_category_top_#{p}" },
    ].flatten

    Discourse.filters.each do |filter|
      define_method("grandparent_category_parent_category_category_#{filter}") do
        canonical_url "#{Discourse.base_url_no_prefix}#{@category.url}"
        self.send(filter, category: @category.id)
      end

      define_method("grandparent_category_parent_category_category_none_#{filter}") do
        self.send(filter, category: @category.id)
      end
    end

    def grandparent_category_parent_category_category_top
      top(category: @category.id)
    end

    TopTopic.periods.each do |period|
      define_method("grandparent_category_parent_category_category_top_#{period}") do
        self.send("top_#{period}", category: @category.id)
      end
    end

    prepend CivicallyCategoryListControllerExtension
  end

  require_dependency 'categories_controller'
  class ::CategoriesController
    def find_by_slug
      params.require(:category_slug)
      @category = Category.find_by_slug(params[:category_slug], params[:parent_category_slug], params[:grandparent_category_slug])
      guardian.ensure_can_see!(@category)

      @category.permission = CategoryGroup.permission_types[:full] if Category.topic_create_allowed(guardian).where(id: @category.id).exists?
      render_serialized(@category, CategorySerializer)
    end
  end
end
