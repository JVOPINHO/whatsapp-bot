import { Client, Message } from 'whatsapp-web.js';

import { Cart } from '@types';

const formatter = new Intl.NumberFormat('pt-BR', {
	style: 'currency',
	currency: 'BRS',
});

export default {
	execute: async(client: Client, message: Message, cart: Cart) => {
		const cartListString = cart.items.map(item => `▶️ *[${item.price}] ${item.description}*\n${formatter.format(item.price).replace('BRS', 'R$')}/${item.sale_type === 'VOLUME' ? 'Kg' : 'Un'}          ${item.amount} ${item.sale_type === 'VOLUME' ? 'Kg' : 'Un'}          ${formatter.format(item.price * item.amount).replace('BRS', 'R$')}`).join('\n----------------------------\n');
		
		return client.sendMessage(message.from, `*🛒 Carrinho*\n${cartListString}`);
	},
};