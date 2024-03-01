import MenuAction from 'actions/MenuAction';
import PlaceOrder from 'actions/PlaceOrder';
import qrcode from 'qrcode-terminal';
import Collection from 'utils/Collection';
import { MessageCollector } from 'utils/Collectors';
import { Buttons, Client, List, Message, MessageTypes } from 'whatsapp-web.js';

import QRCode from 'qrcode';
import { StringUtils } from 'utils/StringUtils';

const debounce = new Collection<boolean>();

Object.defineProperty(global, 'debounce', {
	value: debounce,
});

const client = new Client({});

client.on('qr', (qr) => {
	qrcode.generate(qr, { small: true });
});

client.on('message', async(message) => {
	if(message.type !== MessageTypes.TEXT) {
		return;
	}

	if(debounce.get(message.from)) {
		return;
	}

	const stringRemovedAccents = StringUtils.removeAccents(message.body.toLowerCase());
	
	if(['oi', 'ola'].includes(stringRemovedAccents)) {
		debounce.set(message.from, true);

		client.sendMessage(message.from, '*👋 Olá, como vai?*\nEu sou João, o *assistente virtual* do Mercadinho do Zé.\nNo que posso te ajudar? 🙋‍♂️\n-----------------------------------\n1️⃣ - Gostaria de ver o cardápio\n2️⃣ - Gostaria de realizar um pedido\n-----------------------------------\n_🔢 Digite o NÚMERO referente a opção desejada._');

		const collector = new MessageCollector(client, {
			user: message.from,
			max: 1,
			filter: (message) => {
				const number = Number(message.body);

				return !isNaN(number) && number > 0 && number < 3;
			},
		});

		collector.on('collect', (message: Message) => {
			const value = Number(message.body);
			
			if(value === 1) MenuAction.execute(client, message);
			else if(value === 2) PlaceOrder.execute(client, message);
		});
	}
});

client.on('ready', () => {
	console.log('Client is ready!');
});

client.initialize();