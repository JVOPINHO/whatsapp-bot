import { Client, Message } from 'whatsapp-web.js';

import { numberToEmoji } from 'utils/numberToEmoji';

import Items from '../../items.json';
import { MessageCollector } from 'utils/Collectors';
import PlaceOrder from './PlaceOrder';

const formatter = new Intl.NumberFormat('pt-BR', {
	style: 'currency',
	currency: 'BRS',
});

export default {
	execute: async(client: Client, message: Message, isFirstAction: boolean = true) => {
		let content = '*📒  CATÁLOGO  📒*\n\n';

		let greaterLength = 0;

		const itemsString = [] as string[];

		Items.map((item, i) => {
			const x = `${numberToEmoji(i + 1, Items.length)} - ${item.description} *[${formatter.format(item.price).replace('BRS', 'R$')}/${item.sale_type === 'VOLUME' ? 'Kg' : 'Un'}]*`;

			if(greaterLength < x.length) {
				greaterLength = x.length;
			}

			itemsString.push(x);
		});

		content += itemsString.join(`\n${'-'.repeat(greaterLength)}\n`);
		content += `\n${'-'.repeat(greaterLength)}\n`;

		if(!isFirstAction) {
			content += '*_🔢 Lembrando, para adicionar um item no carrinho basta enviar o NÚMERO referente do item desejado._*';
		} else {
			content += '*_🔤 Se quiser realizar um pedido apenas envie "PEDIDO"_*';
		}

		await client.sendMessage(message.from, content);

		if(isFirstAction) {
			const collector = new MessageCollector(client, { 
				user: message.from, 
				time: 3 * 1000 * 60,
				filter: (message) => message.body.toLowerCase() === 'pedido',
			});

			collector.on('collect', async(message: Message) => {
				PlaceOrder.execute(client, message, false);
			});

			collector.on('end', () => debounce.delete(message.from));
		}
	},
};