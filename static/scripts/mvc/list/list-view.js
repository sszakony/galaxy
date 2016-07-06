define(["mvc/list/list-item","ui/loading-indicator","mvc/base-mvc","utils/localization","ui/search-input"],function(a,b,c,d){"use strict";var e="list",f=Backbone.View.extend(c.LoggableMixin).extend({_logNamespace:e,viewClass:a.ListItemView,collectionClass:Backbone.Collection,tagName:"div",className:"list-panel",fxSpeed:"fast",emptyMsg:d("This list is empty"),noneFoundMsg:d("No matching items found"),searchPlaceholder:d("search"),initialize:function(a){a=a||{},a.logger&&(this.logger=a.logger),this.log(this+".initialize:",a),this.fxSpeed=_.has(a,"fxSpeed")?a.fxSpeed:this.fxSpeed,this.filters=[],this.searchFor=a.searchFor||"",this.selecting=void 0!==a.selecting?a.selecting:!0,this.selected=a.selected||[],this.lastSelected=null,this.dragItems=a.dragItems||!1,this.viewClass=a.viewClass||this.viewClass,this.views=[],this.collection=a.collection||this._createDefaultCollection(),this.filters=a.filters||[],this.$scrollContainer=a.$scrollContainer||this.$scrollContainer,this.title=a.title||"",this.subtitle=a.subtitle||"",this._setUpListeners()},_setUpListeners:function(){return this.off(),this.on({error:function(a,b,c,d,e){console.error(a,b,c,d,e)},loading:function(){this._showLoadingIndicator("loading...",40)},"loading-done":function(){this._hideLoadingIndicator(40)}}),this.once("rendered",function(){this.trigger("rendered:initial",this)}),this._setUpCollectionListeners(),this._setUpViewListeners(),this},_createDefaultCollection:function(){return new this.collectionClass([])},_setUpCollectionListeners:function(){return this.log(this+"._setUpCollectionListeners",this.collection),this.stopListening(this.collection),this.listenTo(this.collection,{error:function(a,b,c,d,e){this.trigger("error",a,b,c,d,e)},update:function(a,b){this.info("update:",a,b,"\n",b.changes);var c=b.changes;return 1===c.added.length?this.addItemView(_.first(c.added),a,b):1===c.removed.length?this.removeItemView(_.first(c.removed),a,b):c.added.length+c.removed.length>1?this.renderItems():void 0}}),this},_setUpViewListeners:function(){this.log(this+"._setUpViewListeners"),this.on({"view:selected":function(a,b){if(b&&b.shiftKey&&this.lastSelected){var c=this.viewFromModelId(this.lastSelected);c&&this.selectRange(a,c)}else b&&b.altKey&&!this.selecting&&this.showSelectors();this.selected.push(a.model.id),this.lastSelected=a.model.id},"view:de-selected":function(a){this.selected=_.without(this.selected,a.model.id)}})},render:function(a){this.log(this+".render",a);var b=this._buildNewRender();return this._setUpBehaviors(b),this._queueNewRender(b,a),this},_buildNewRender:function(){this.debug(this+"(ListPanel)._buildNewRender");var a=$(this.templates.el({},this));return this._renderControls(a),this._renderTitle(a),this._renderSubtitle(a),this._renderSearch(a),this.renderItems(a),a},_renderControls:function(a){this.debug(this+"(ListPanel)._renderControls");var b=$(this.templates.controls({},this));return a.find(".controls").replaceWith(b),b},_renderTitle:function(){},_renderSubtitle:function(){},_queueNewRender:function(a,b){b=void 0===b?this.fxSpeed:b;var c=this;c.log("_queueNewRender:",a,b),$(c).queue("fx",[function(a){c.$el.fadeOut(b,a)},function(b){c._swapNewRender(a),b()},function(a){c.$el.fadeIn(b,a)},function(a){c.trigger("rendered",c),a()}])},_swapNewRender:function(a){return this.$el.empty().attr("class",this.className).append(a.children()),this.selecting&&this.showSelectors(0),this},_setUpBehaviors:function(a){return a=a||this.$el,this.$controls(a).find("[title]").tooltip({placement:"bottom"}),this._renderMultiselectActionMenu(a),this},_renderMultiselectActionMenu:function(a){a=a||this.$el;var b=a.find(".list-action-menu"),c=this.multiselectActions();if(!c.length)return b.empty();var e=$(['<div class="list-action-menu btn-group">','<button class="list-action-menu-btn btn btn-default dropdown-toggle" data-toggle="dropdown">',d("For all selected"),"...","</button>",'<ul class="dropdown-menu pull-right" role="menu">',"</ul>","</div>"].join("")),f=c.map(function(a){var b=['<li><a href="javascript:void(0);">',a.html,"</a></li>"].join("");return $(b).click(function(b){return b.preventDefault(),a.func(b)})});return e.find("ul").append(f),b.replaceWith(e),e},multiselectActions:function(){return[]},$scrollContainer:function(a){return(a||this.$el).parent().parent()},$controls:function(a){return(a||this.$el).find("> .controls")},$list:function(a){return(a||this.$el).find("> .list-items")},$messages:function(a){return(a||this.$el).find("> .controls .messages")},$emptyMessage:function(a){return(a||this.$el).find("> .empty-message")},renderItems:function(a){a=a||this.$el;var b=this;b.log(this+".renderItems",a);var c=b.$list(a);b.freeViews();var d=b._filterCollection();return b.views=d.map(function(a){var c=b._createItemView(a);return c}),c.empty(),b.views.length&&b._attachItems(a),b._renderEmptyMessage(a).toggle(!b.views.length),b.trigger("views:ready",b.views),b.views},_filterCollection:function(){var a=this;return a.collection.filter(_.bind(a._filterItem,a))},_filterItem:function(a){var b=this;return _.every(b.filters.map(function(b){return b.call(a)}))&&(!b.searchFor||a.matchesAll(b.searchFor))},_createItemView:function(a){var b=this._getItemViewClass(a),c=_.extend(this._getItemViewOptions(a),{model:a}),d=new b(c);return this._setUpItemViewListeners(d),d},_destroyItemView:function(a){this.stopListening(a),this.views=_.without(this.views,a)},_destroyItemViews:function(){var a=this;return a.views.forEach(function(b){a.stopListening(b)}),a.views=[],a},freeViews:function(){return this._destroyItemViews()},_getItemViewClass:function(){return this.viewClass},_getItemViewOptions:function(a){return{fxSpeed:this.fxSpeed,expanded:!1,selectable:this.selecting,selected:_.contains(this.selected,a.id),draggable:this.dragItems}},_setUpItemViewListeners:function(a){var b=this;return this.listenTo(a,"all",function(){var a=Array.prototype.slice.call(arguments,0);a[0]="view:"+a[0],b.trigger.apply(b,a)}),this.listenTo(a,"draggable:dragstart",function(a,b){var c={},d=this.getSelectedModels();c=d.length?d.toJSON():[b.model.toJSON()],a.dataTransfer.setData("text",JSON.stringify(c))},this),b},_attachItems:function(a){var b=this;return this.$list(a).append(this.views.map(function(a){return b._renderItemView$el(a)})),this},_renderItemView$el:function(a){return a.render(0).$el},_renderEmptyMessage:function(a){this.debug("_renderEmptyMessage",a,this.searchFor);var b=this.searchFor?this.noneFoundMsg:this.emptyMsg;return this.$emptyMessage(a).text(b)},expandAll:function(){_.each(this.views,function(a){a.expand()})},collapseAll:function(){_.each(this.views,function(a){a.collapse()})},addItemView:function(a){var b=this,c=b._filterCollection().indexOf(a);if(-1===c)return void 0;var d=b._createItemView(a);return $(d).queue("fx",[function(a){b.$emptyMessage().is(":visible")?b.$emptyMessage().fadeOut(b.fxSpeed,a):a()},function(a){b._attachView(d,c),a()}]),d},_attachView:function(a,b,c){c=_.isUndefined(c)?!0:c,b=b||0;var d=this;return d.views.splice(b,0,a),d._insertIntoListAt(b,d._renderItemView$el(a).hide()),d.trigger("view:attached",a),c?a.$el.slideDown(d.fxSpeed,function(){d.trigger("view:attached:rendered")}):(a.$el.show(),d.trigger("view:attached:rendered")),a},_insertIntoListAt:function(a,b){var c=this.$list();return 0===a?c.prepend(b):c.children().eq(a-1).after(b),b},removeItemView:function(a){var b=this,c=_.find(b.views,function(b){return b.model===a});return c?(b.views=_.without(b.views,c),b.trigger("view:removed",c),$({}).queue("fx",[function(a){c.$el.fadeOut(b.fxSpeed,a)},function(a){c.remove(),b.trigger("view:removed:rendered"),b.views.length?a():b._renderEmptyMessage().fadeIn(b.fxSpeed,a)}]),c):void 0},viewFromModelId:function(a){return _.find(this.views,function(b){return b.model.id===a})},viewFromModel:function(a){return a?this.viewFromModelId(a.id):void 0},viewsWhereModel:function(a){return this.views.filter(function(b){return _.isMatch(b.model.attributes,a)})},viewRange:function(a,b){if(a===b)return a?[a]:[];var c=this.views.indexOf(a),d=this.views.indexOf(b);return-1===c||-1===d?c===d?[]:-1===c?[b]:[a]:d>c?this.views.slice(c,d+1):this.views.slice(d,c+1)},_renderSearch:function(a){return a.find(".controls .search-input").searchInput({placeholder:this.searchPlaceholder,initialVal:this.searchFor,onfirstsearch:_.bind(this._firstSearch,this),onsearch:_.bind(this.searchItems,this),onclear:_.bind(this.clearSearch,this)}),a},_firstSearch:function(a){return this.log("onFirstSearch",a),this.searchItems(a)},searchItems:function(a,b){if(this.log("searchItems",a,this.searchFor,b),!b&&this.searchFor===a)return this;this.searchFor=a,this.renderItems(),this.trigger("search:searching",a,this);var c=this.$("> .controls .search-query");return c.val()!==a&&c.val(a),this},clearSearch:function(){return this.searchFor="",this.trigger("search:clear",this),this.$("> .controls .search-query").val(""),this.renderItems(),this},THROTTLE_SELECTOR_FX_AT:20,showSelectors:function(a){a=void 0!==a?a:this.fxSpeed,this.selecting=!0,this.$(".list-actions").slideDown(a),a=this.views.length>=this.THROTTLE_SELECTOR_FX_AT?0:a,_.each(this.views,function(b){b.showSelector(a)})},hideSelectors:function(a){a=void 0!==a?a:this.fxSpeed,this.selecting=!1,this.$(".list-actions").slideUp(a),a=this.views.length>=this.THROTTLE_SELECTOR_FX_AT?0:a,_.each(this.views,function(b){b.hideSelector(a)}),this.selected=[],this.lastSelected=null},toggleSelectors:function(){this.selecting?this.hideSelectors():this.showSelectors()},selectAll:function(a){_.each(this.views,function(b){b.select(a)})},deselectAll:function(a){this.lastSelected=null,_.each(this.views,function(b){b.deselect(a)})},selectRange:function(a,b){var c=this.viewRange(a,b);return _.each(c,function(a){a.select()}),c},getSelectedViews:function(){return _.filter(this.views,function(a){return a.selected})},getSelectedModels:function(){return new this.collection.constructor(_.map(this.getSelectedViews(),function(a){return a.model}))},_showLoadingIndicator:function(a,c,d){this.debug("_showLoadingIndicator",this.indicator,a,c,d),c=void 0!==c?c:this.fxSpeed,this.indicator||(this.indicator=new b(this.$el),this.debug("	 created",this.indicator)),this.$el.is(":visible")?(this.$el.fadeOut(c),this.indicator.show(a,c,d)):this.indicator.show(0,d)},_hideLoadingIndicator:function(a,b){this.debug("_hideLoadingIndicator",this.indicator,a,b),a=void 0!==a?a:this.fxSpeed,this.indicator&&this.indicator.hide(a,b)},scrollPosition:function(){return this.$scrollContainer().scrollTop()},scrollTo:function(a,b){return b=b||0,this.$scrollContainer().animate({scrollTop:a},b),this},scrollToTop:function(a){return this.scrollTo(0,a)},scrollToItem:function(a){return a?this:this},scrollToId:function(a,b){return this.scrollToItem(this.viewFromModelId(a),b)},events:{"click .select-all":"selectAll","click .deselect-all":"deselectAll"},toString:function(){return"ListPanel("+this.collection+")"}});f.prototype.templates=function(){var a=c.wrapTemplate(["<div>",'<div class="controls"></div>','<div class="list-items"></div>','<div class="empty-message infomessagesmall"></div>',"</div>"]),b=c.wrapTemplate(['<div class="controls">','<div class="title">','<div class="name"><%- view.title %></div>',"</div>",'<div class="subtitle"><%- view.subtitle %></div>','<div class="actions"></div>','<div class="messages"></div>','<div class="search">','<div class="search-input"></div>',"</div>",'<div class="list-actions">','<div class="btn-group">','<button class="select-all btn btn-default"','data-mode="select">',d("All"),"</button>",'<button class="deselect-all btn btn-default"','data-mode="select">',d("None"),"</button>","</div>",'<div class="list-action-menu btn-group">',"</div>","</div>","</div>"]);return{el:a,controls:b}}();var g=f.extend({modelCollectionKey:"contents",initialize:function(a){f.prototype.initialize.call(this,a),this.selecting=void 0!==a.selecting?a.selecting:!1,this.setModel(this.model,a)},setModel:function(a,b){if(b=b||{},this.debug(this+".setModel:",a,b),this.freeModel(),this.freeViews(),a){var c=this.model?this.model.get("id"):null;this.model=a,this.logger&&(this.model.logger=this.logger),this._setUpModelListeners(),this.stopListening(this.collection),this.collection=this.model[this.modelCollectionKey]||b.collection||this._createDefaultCollection(),this._setUpCollectionListeners(),c&&a.get("id")!==c&&this.trigger("new-model",this)}return this},freeModel:function(){return this.model&&this.stopListening(this.model),this},_setUpModelListeners:function(){return this.log(this+"._setUpModelListeners",this.model),this.listenTo(this.model,"error",function(){var a=Array.prototype.slice.call(arguments,0);a.unshift("error"),this.trigger.apply(this,a)},this),this.logger&&this.listenTo(this.model,"all",function(a){this.info(this+"(model)",a,arguments)}),this},_renderControls:function(a){this.debug(this+"(ModelListPanel)._renderControls");var b=this.model?this.model.toJSON():{},c=$(this.templates.controls(b,this));return a.find(".controls").replaceWith(c),c},toString:function(){return"ModelListPanel("+this.model+")"}});return g.prototype.templates=function(){var a=c.wrapTemplate(['<div class="controls">','<div class="title">','<div class="name"><%- model.name %></div>',"</div>",'<div class="subtitle"><%- view.subtitle %></div>','<div class="actions"></div>','<div class="messages"></div>','<div class="search">','<div class="search-input"></div>',"</div>",'<div class="list-actions">','<div class="btn-group">','<button class="select-all btn btn-default"','data-mode="select">',d("All"),"</button>",'<button class="deselect-all btn btn-default"','data-mode="select">',d("None"),"</button>","</div>",'<div class="list-action-menu btn-group">',"</div>","</div>","</div>"]);return _.extend(_.clone(f.prototype.templates),{controls:a})}(),{ListPanel:f,ModelListPanel:g}});
//# sourceMappingURL=../../../maps/mvc/list/list-view.js.map