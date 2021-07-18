/**
 * Solaires system for FVTT. Read more on https://solaires.feerie.net/
 * Authors: JDW (Coding), Greewi (System rules, Lore, Coding)
 * Software License: CC BY-NC-SA 4.0
 */

// Import Modules
import { SolairesActor } from "./actor.js";
import { SolairesActorSheet } from "./actor-sheet.js";
import { SolairesItem } from "./item.js";
import { SolairesItemSheet } from "./item-sheet.js";
import { SolairesDialog } from "./dialog.js";
import { SolairesAction } from "./action.js";


/* -------------------------------------------- */
/*  Foundry VTT Initialization and Hooks        */
/* -------------------------------------------- */

Hooks.once("init", async function () {
	console.log(`Initializing Solaires System`);

	// Define custom Entity classes
	CONFIG.Actor.documentClass = SolairesActor;
	CONFIG.Item.documentClass = SolairesItem;

	// Register sheet application classes
	Actors.unregisterSheet("core", ActorSheet);
	Actors.registerSheet("solaires", SolairesActorSheet, { makeDefault: true });
	Items.unregisterSheet("core", ItemSheet);
	Items.registerSheet("solaires", SolairesItemSheet, { makeDefault: true });

	// Register system settings
	game.settings.register("solaires", "macroShorthand", {
		name: "Shortened Macro Syntax",
		hint: "Enable a shortened macro syntax which allows referencing attributes directly, for example @str instead of @attributes.str.value. Disable this setting if you need the ability to reference the full attribute model, for example @attributes.str.label.",
		scope: "world",
		type: Boolean,
		default: true,
		config: true
	});
});

Hooks.once("ready", async function () {
	//register custom helper for multiselect
	Handlebars.registerHelper('selectmulti', function(value, options) {

		var select = document.createElement('select');
		select.innerHTML = options.fn(this);
	
		[].forEach.call(select.options, function(option) {
			if (value.indexOf(option.value) > -1) {
				option.setAttribute('selected', 'selected');
			}
		});
	
		return select.innerHTML;
	});

	CONFIG.TinyMCE.content_css[0] = "./systems/solaires/styles/mce.css";

	game.solaires = new Solaires();

	game.socket.on("system.solaires", data => {
		switch (data.type) {
			case "setItem":
				if (game.user.isGM && game.solaires.pendingAction) {
					let item = game.actors.get(data.payload.idActor).items.get(data.payload.idItem);
					game.solaires.pendingAction.setItem(item);
				}
				break;
			case "removeItem":
				if (game.user.isGM && game.solaires.pendingAction) {
					game.solaires.pendingAction.removeItem(data.payload.slot);
				}
				break;
			case "updateGMAck":
				if (!game.user.isGM) {
					SolairesAction.updateGMAck(data.payload.ack);
				}
				break;
			case "cleanAction":
				if (game.user.isGM && game.solaires.pendingAction) {
					game.solaires.pendingAction.cleanAction();
				}
		}
	});
});

Hooks.on("renderChatMessage", async (app, html, msg) => {
	if (!game.user.isGM)
		html.find(".approveSkills").remove();
});

Hooks.on('renderChatLog', (log, html, data) => {
	html.on("click", '.skill-remove', async ev => {
		let itemSlot = $(ev.currentTarget).parents(".action-skill").hasClass("action-skill-1") ? 1 : 2;
		if (game.user.isGM && game.solaires.pendingAction)
			game.solaires.pendingAction.removeItem(itemSlot);
		else {
			game.socket.emit("system.solaires", {
				type: "removeItem",
				payload: {
					slot: itemSlot
				}
			});
		}
	});


	html.on("click", '.approveSkills', async ev => {
		SolairesAction.updateGMAck(true);
	});

	html.on("click", ".startAction", async ev => {
		let actionScore = parseInt($(ev.currentTarget).data("actionscore"), 10);
		SolairesAction.resolveAction(actionScore);
	});

	html.on("click", ".action-skill", async ev => {
		game.actors.get(game.user.character?.id)?.sheet.render(true);
	});
});

/**
 * Drag and drop of characters, items and journals entry on the hot bar
 */
Hooks.on('hotbarDrop', async (bar, data, slot) => {

	const elementsTypes = {
		'Actor' : {
			'collection' : 'actors',
			'defaultImg' : "systems/solaires/images/icons/icon_actor.png"
		},
		'Item' : {
			'collection' : 'items',
			'defaultImg' : "systems/solaires/images/icons/icon_item.png"
		},
		'JournalEntry' : {
			'collection' : 'journal',
			'defaultImg' : "systems/solaires/images/icons/icon_journal.png"
		}
	};

	// With the workaround, some elements dont have their type set
	if(!elementsTypes[data.type]) {
		for(let type in elementsTypes)
			if(game[elementsTypes[type].collection].get(data.id))
				data.type = type;
		if(!elementsTypes[data.type])
			return;
	}

	const collection = elementsTypes[data.type].collection;
	const defaultImg = elementsTypes[data.type].defaultImg;

	const command = `
		(function () {
			const element = game.${collection}.get('${data.id}');
			if (element?.sheet.rendered) {
				element.sheet.close();
			} else {
				element.sheet.render(true);
			}
		})();
	`;
	const element = game[collection].get(data.id);
	const name = element.name;
	const img = element.img ? element.img : defaultImg;

	let macro = game.macros.entities.find(macro => macro.name === name && macro.data.command === command);

	if (!macro) {
		macro = await Macro.create({
			name: name,
			type: 'script',
			img: img,
			command: command
		}, {renderSheet: false});
	}

	game.user.assignHotbarMacro(macro, slot);
	return false;
});

/**
 * Work around to enable drag&drop of the journal entries for the non GM/Assistant player
 */
Hooks.on('renderJournalDirectory', async (journalDirectory, html, data) => {
	const role = game.users.get(game.userId).role
	if(role == CONST.USER_ROLES.ASSISTANT || role == CONST.USER_ROLES.GAMEMASTER)
		return;

	const journalElements = html.find('li.journal.flexrow');
	journalElements.each((index, element) => {
		const journalId = element.dataset.entityId;
		if(!journalId)
			return;
		element.draggable = true;
		element.ondragstart = journalDirectory._onDragStart;
	});
});

/* -------------------------------------------- */
/*  Solaires main class                         */
/* -------------------------------------------- */
class Solaires {
	constructor() {
		this.pendingAction = null;

		if (game.user.isGM && localStorage.getItem("pendingAction"))
			this.pendingAction = SolairesAction.fromJSON(localStorage.getItem("pendingAction"));
	}

	/**
	 * Open a dialog to begin a Solaires action. Let the GM specify a difficulty
	 */
	dialogStartAction() {
		if (!game.user.isGM)
			return;
		renderTemplate("systems/solaires/templates/dialog-action.html").then(html => {
			let d = new SolairesDialog({
				title: game.i18n.localize("SOLAIRES.Dialog.StartAction"),
				content: html,
				buttons: {
					ok: {
						icon: '<i class="fas fa-play"></i>',
						label: game.i18n.localize("SOLAIRES.Dialog.StartActionNow"),
						callback: () => {
							let difficulty = d._element.find(".dialog-sum-difficulty-value").val();
							let significance = d._element.find(".dialog-sum-significance-value").val();
							this.beginAction(parseInt(difficulty, 10), parseInt(significance, 10));
						}
					}
				},
				default: "intricate"
			}, { width: 650, classes: ["solaires"] });
			d.render(true);
		});
	}

	/**
	 * Start a new Solaires action. Sends a special interactive message in the chat to request the skills to use
	 */
	beginAction(difficulty, significance) {
		if (!game.user.isGM)
			return;

		this.pendingAction = new SolairesAction(difficulty, significance);
		this.pendingAction.createChatCard();
	}
}
