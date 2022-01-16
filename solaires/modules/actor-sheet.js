import { SOLAIRES_CFG } from "./config.js";
/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class SolairesActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["solaires", "sheet", "actor"],
      template: "systems/solaires/templates/actor-sheet.html",
      width: 600,
      height: 650,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = this.actor.data;
    data.actor = this.actor;
    data.items = this.actor.items;
    data.dtypes = ["String", "Number", "Boolean"];
    data.Roles = SOLAIRES_CFG.ROLES;
    data.SpiritNatureTypes = SOLAIRES_CFG.SPIRITNATURETYPES;
    data.Sheaths = SOLAIRES_CFG.SHEATHS;
    data.RolesValue = data.data.identity ? data.data.identity.roles.split(","):"";
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    //Activate "Chosen" plugin for selectbox
    $(".select-role").chosen({ max_selected_options: 3, width: "100%" });

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Update Inventory Item
    html.find('.item-edit').click(ev => {
      const li = ev.currentTarget.tagName=="LI" ? $(ev.currentTarget) : $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
      ev.stopPropagation();
    });

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteEmbeddedDocuments("Item",[li.data("itemId")]);
      li.slideUp(200, () => this.render(false));
      ev.stopPropagation();
    });

    // Create Inventory Item
    html.find('.item-add').click(ev => {
      ev.preventDefault();
      let header = ev.currentTarget,
        data = duplicate(header.dataset);

      data["img"] = `systems/solaires/images/icons/icon_${data.type}.png`;
      data["name"] = `${game.i18n.localize("SOLAIRES.Item.New")} ${data.type.capitalize()}`;
      ev.stopPropagation();
      return Item.create(data, {parent: this.actor, renderSheet:true});
    });

    // Increase item value
    html.find('.item-value').mousedown(ev => {
      const li = $(ev.currentTarget).parents(".item");
      let item = this.actor.items.get(li.data("itemId"));
      switch (ev.button) {
        case 0:
            item.data.data.value++;
            if(item.data.data.value>3)
              item.data.data.value = 3;

          break;
        case 2:
            item.data.data.value--;
            if (item.data.data.value < 0)
              item.data.data.value = 0;
          break;
      }
      item.update({"data.value":item.data.data.value});
      ev.stopPropagation();
    });

    // Delete Inventory Item
    html.find('.item-post').click(ev => {
      let itemId = $(ev.currentTarget).parents(".item").data("itemId");
      const item = this.actor.items.find(i => i.data._id == itemId);
      item.postItem();
      ev.stopPropagation();
    });

    // Delete Plot
    html.find('.plot-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".plot");
      this.actor.deleteEmbeddedDocuments("Item",[li.data("itemId")]);
      li.slideUp(200, () => this.render(false));
      ev.stopPropagation();
    });

    html.find('.item-name').click(ev => {
      let itemId = $(ev.currentTarget).parents(".item").data("itemId");
      let item = this.actor.items.find(i => i.data._id == itemId);
      if (game.user.isGM && game.solaires.pendingAction)
        game.solaires.pendingAction.setItem(item);
      else {
        game.socket.emit("system.solaires", {
          type: "setItem",
          payload: {
            idItem: itemId,
            idActor: this.actor.id
          }
        })
      }
      ev.stopPropagation();
    });

    // change charpoints value
    html.find('.header-charpoints-point').mousedown(ev => {
      let val = this.actor.data.data.status.charPoints.value;
      let max = this.actor.data.data.status.charPoints.max;
      let target = "data.status.charPoints.value";
      if($(ev.currentTarget).hasClass("header-charpoints-max"))
      {
        val = this.actor.data.data.status.charPoints.max;
        max = 10;
        target = "data.status.charPoints.max";
      }

      switch (ev.button) {
        case 0:
            val++;
            if (val > max)
              val = max;
          break;
        case 2:
            val--;
          if (val < 0)
            val = 0;
          break;
      }

      this.actor.update({[target]: val});
    });
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(options = {}) {
    const position = super.setPosition(options);
    const sheetBody = this.element.find(".sheet-body");
    const bodyHeight = position.height - 205;
    sheetBody.css("height", bodyHeight);
    return position;
  }

  /** @override */
  _onChangeInput(event) {
    if(event.currentTarget.hasAttribute("multiple")){
      let val = $(event.currentTarget).val();
      val = val.join(',');
      let fakeEvent = new Event('change',{ bubbles: true });
      $(event.currentTarget).siblings('input[type="hidden"]').val(val)[0].dispatchEvent(fakeEvent);
    }
    else
      super._onChangeInput(event);
  }

  /** @override */
  _createEditor(target, editorOptions, initialContent) {
    editorOptions.content_css = "systems/solaires/styles/mce.css";
    return super._createEditor(target, editorOptions, initialContent);
  }
}
