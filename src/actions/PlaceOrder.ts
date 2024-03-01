import { Client, Message, MessageTypes } from 'whatsapp-web.js';

import { MessageCollector } from 'utils/Collectors';
import { StringUtils } from 'utils/StringUtils';

import Items from '../../items.json';
import MenuAction from './MenuAction';
import Collection from 'utils/Collection';
import { Cart } from '@types';
import { humanizedStringToNumber } from 'utils/humanizedStringToNumber';
import CartAction from './CartAction';
import FinishPlaceOrderAction from './FinishPlaceOrderAction';

const menuKeys = ['menu', 'catalogo', 'cardapio'];

const CartCollection = new Collection<Cart>();

const CreateCart = (userID: string, saveOnCollection: boolean = true) => {
	const data: Cart = {
		items: [],
	};
	CartCollection.set(userID, data);

	return data;
};

export default {
	execute: async(client: Client, message: Message, isFirstAction: boolean = true) => {
		client.sendMessage(message.from, `🗒️ Envie o *NÚMERO ou NOME do item* que deseja adicionar ao carrinho* (Exemplo: "2" ou "Banana")\n${isFirstAction ? '_📒 Se quiser consultar o catálogo de items basta enviar "CATÁLOGO"_' : ''}\n_🗑️ Se quiser parar com o pedido basta enviar "SAIR"_`);

		const collector = new MessageCollector(client, {
			user: message.from,
			time: 3 * 1000 * 60,
			filter: (message: Message) => message.type === MessageTypes.TEXT,
		});

		let action: 'ITEM' | 'AMOUNT' | 'FINISHING' = 'ITEM';
		let item: (typeof Items[0] & { id: number }) | undefined;

		collector.on('collect', async(message: Message) => {
			collector.resetTimer();

			const stringRemovedAccents = StringUtils.removeAccents(message.body.toLowerCase());

			if(menuKeys.includes(stringRemovedAccents) && isFirstAction) {
				return MenuAction.execute(client, message, false);
			}

			if(stringRemovedAccents === 'carrinho') {
				const cart = CartCollection.get(message.from) || CreateCart(message.from, false);

				return CartAction.execute(client, message, cart);
			}

			if(['sair', 'tchau', 'bye'].includes(stringRemovedAccents)) {
				client.sendMessage(message.from, '*👋 Tchauzinho*\n_🗨️ Lembrando, se caso quiser fazer um encomenda basta me enviar um "Olá"_');
				return collector.stop();
			}

			if(['finalizar', 'pronto'].includes(stringRemovedAccents)) {
				const cart = CartCollection.get(message.from) || CreateCart(message.from, false);

				action = 'FINISHING';

				const result = await FinishPlaceOrderAction.execute(client, message, cart);

				if(result) {
					collector.stop();
				} else {
					action = 'ITEM';
				}

				return;
			}

			if(action === 'ITEM') {
				const itemID = Number(message.body);

				if(!isNaN(itemID)) {
					item = Items[itemID - 1] as typeof item;
				} else {
					item = Items.find(item => 
						StringUtils.checkSimilarityStrings(
							StringUtils.removeAccents(item.description.toLowerCase()), 
							stringRemovedAccents
						) > 0.8
					) as typeof item;
				}

				if(item !== undefined) {
					if(!isNaN(itemID)) {
						item.id = itemID - 1;
					} else {
						item.id = Items.findIndex(_item => _item.description === item?.description);
					}

					action = 'AMOUNT';

					return client.sendMessage(message.from, `🔢 Informe a *QUANTIDADE* desejada!\n_Exemplo: ${item.sale_type  === 'VOLUME' ? '1kg, 400g ou 2.3kg' : '1un, 4 unidades, 8'}_`);
				} else {
					return client.sendMessage(message.from, `🔎 *Não encontrei nenhum item referente ${!isNaN(itemID) ? 'ao código' : 'a'} [* ${message.body} *]!* Tente novamente!\n_🗨️ Lembrando, se quiser consultar o catálogo basta enviar "CATÁLOGO"_`);
				}
			}

			if(action === 'AMOUNT' && item) {
				const amount = humanizedStringToNumber(message.body);

				if(typeof amount === 'number' || amount.value <= 0) {
					return client.sendMessage(message.from, `*🛑 A quantidade informada ("${message.body}") é invalida!* Tente novamente.\n_🗨️ Lembrando, ${item.sale_type === 'VOLUME' ? 'o peso' : 'a quantidade'} precisa ser um NÚMERO, e precisa ser maior que 0_`);
				}

				if(amount.type !== item.sale_type && amount.type !== 'ABS') {
					return client.sendMessage(message.from, `*⁉️ O Item ${item.description} não é vendido por ${amount.type === 'VOLUME' ? 'kilos' : 'unidades'}, e sim por ${item.sale_type === 'VOLUME' ? 'kilos' : 'unidades'}!* Tente novamente!\n_💡 Tente algo como ${item.sale_type  === 'VOLUME' ? '1kg, 400g ou 2.3kg' : '1un, 4 unidades, 8'}_`);
				}

				const cart = CartCollection.get(message.from) || CreateCart(message.from);

				const itemOnCart = cart.items.find((_, i) => i === item?.id);

				const amountToAdd = item.sale_type === 'UNIT' ? Math.floor(amount.value) : amount.value;

				if(!itemOnCart) {
					cart.items.push({
						...(item as typeof Items[0]),
						amount: amountToAdd,
					});
				} else {
					itemOnCart.amount += amountToAdd;
				}

				await client.sendMessage(message.from, `*🛒 ${amountToAdd} ${item.sale_type === 'VOLUME' ? 'kg' : `unidade${amountToAdd > 1 ? 's' : ''}`} ${amountToAdd > 1 ? 'foram' : 'foi'} adicionad${item.sale_type === 'VOLUME' ? 'o' : 'a'}${amountToAdd > 1 ? 's' : ''} ao carrinho*\n_❕ Para consultar todos os itens do seu carrinho basta enviar "CARRINHO"_\n\n_*🗨️ Quando quiser finalizar o pedido basta enviar "FINALIZAR"*_`);
			
				action = 'ITEM';
				item = undefined;

				return;
			}
		});

		collector.on('end', () => {
			debounce.delete(message.from);
			CartCollection.delete(message.from);
		});
	},
};