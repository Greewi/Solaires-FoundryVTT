/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class SolairesItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["solaires", "sheet", "item"],
      template: "systems/solaires/templates/item-sheet.html",
      width: 520,
      height: 200,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = super.getData();
    if(this.item.data.type == "plot") {
      data.incomplet = this.item.data.data.stepNumber > this.item.data.data.steps.length;
    }
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  get template() {
    if(this.item.data.type == "plot")
      return "systems/solaires/templates/plot-sheet.html"
    return "systems/solaires/templates/item-sheet.html"
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Update Inventory Item
    if(this.item.data.type == "plot") {
      html.find('.plot-finish').click(ev => {
        this.item.data.data.steps.push(this.item.data.data.currentStep);
        this.item.data.data.currentStep = "";
        this.item.update();
        this.item.sheet.render();
        ev.stopPropagation();
      });
    }
    
  }

  /* -------------------------------------------- */

  /** @override */
  _createEditor(target, editorOptions, initialContent) {
    editorOptions.content_css = "systems/solaires/styles/mce.css";
    return super._createEditor(target, editorOptions, initialContent);
  }
}
