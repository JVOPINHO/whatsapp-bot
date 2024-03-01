import crypto from 'node:crypto';
import fs from 'node:fs';

import { Client, Message, MessageMedia, MessageTypes } from 'whatsapp-web.js';
import parsePhoneNumber, { findPhoneNumbersInText } from 'libphonenumber-js';
import cepPromise from 'cep-promise';
import QRCode from 'qrcode';

import { Cart, ItemOnCart } from '@types';
import CartAction from './CartAction';
import { MessageCollector } from 'utils/Collectors';
import { StringUtils } from 'utils/StringUtils';

enum Stages {
    'CONFIRMATION', 
    'PHONE_NUMBER',
    'REQUESTER_NAME',
    'EMAIL',
    'CPF',
    'CEP',
    'ADDRESS_NUMBER'
}
interface OrderData {
    name: string;
    number_phone: string;
    email: string;
    cpf: string;
    address: {
        cep: string;
        state: string;
        city: string;
        street: string;
        neighborhood: string;
        number: string;
    }
    items: ItemOnCart[];
    id: string;
}

const formatter = new Intl.NumberFormat('pt-BR', {
	style: 'currency',
	currency: 'BRS',
});

const paymentLink = 'https://www.youtube.com/watch?v=oavMtUWDBTM';

const formatNumber = (number:string) => {
	const cleaned = number.replace(/\D/g, '');
	const match = cleaned.match(/^(\d{2})(\d{2})(\d{4}|\d{5})(\d{4})$/);
	if(match) {
		return ['+55 ', match[2], ' ', match[3], '-', match[4]].join('');
	}
	return '';
};

export default {
	execute: async(client: Client, message: Message, cart: Cart) => {
		await CartAction.execute(client, message, cart);
		await client.sendMessage(message.from, '*❓ Deseja mesmo finalizar o a encomenda acima?* Digite:\n*✅ Sim*, para finalizar\n🚫 Não, para incluir mais itens');
        
		return new Promise<boolean>((resolve) => {
			const collector = new MessageCollector(client, {
				user: message.from,
				time: 3 * 1000 * 60,
				filter: (message) => message.type === MessageTypes.TEXT,
			});

			let stage: Stages = Stages.CONFIRMATION;

			const orderData = {
				items: cart.items,
				id: crypto.randomUUID(),
			} as OrderData;

			console.log(message.from, message.from.replace(/^(\d*)@.*$/, '$1'));

			collector.on('collect', async(message: Message) => {
				const messageRemovedAccents = StringUtils.removeAccents(message.body.toLowerCase());

				if(stage === Stages.CONFIRMATION) {
					collector.resetTimer();

					if(messageRemovedAccents === 'nao') {
						collector.stop();
						return resolve(false);
					}

					if(messageRemovedAccents === 'sim') {
						stage = Stages.REQUESTER_NAME;

						return client.sendMessage(message.from, '👤 Para continuamos com sua encomenda, por favor informe seu *NOME*.');
					}
				}
                
				if(stage === Stages.REQUESTER_NAME) {
					collector.resetTimer();

					const name = StringUtils.toTitleCase(message.body);

					stage = Stages.CPF;

					orderData.name = name;

					await client.sendMessage(message.from, `*📝 Anotado, Senhor(a) ${name}.*`);
					await client.sendMessage(message.from, '🪪 Agora eu vou precisar do *seu CPF*.');
                    
					return;
				}

				if(stage === Stages.CPF) {
					collector.resetTimer();

					const cpf = message.body.toLowerCase();

					stage = Stages.PHONE_NUMBER;

					orderData.cpf = cpf;

					await client.sendMessage(message.from, '*📝 Anotei*.');
					await client.sendMessage(message.from, `*️⃣ Para continuarmos agora, preciso do seu número de telefone, posso utilizar este número o senhor(a) está entrando em contato comigo (${message.from.replace(/^(\d*)@.*$/, '$1')})?\n*✅ Sim*, para usar esse número\nCaso contrário, *DIGITE O NÚMERO DESEJADO*.`);
				
					return;
				}

				if(stage === Stages.PHONE_NUMBER) {
					collector.resetTimer();

					const numbersInMessage = findPhoneNumbersInText(messageRemovedAccents === 'sim' ? formatNumber(message.from.replace(/^(\d*)@.*$/, '$1')) : message.body);

					if(!numbersInMessage[0]) {
						return client.sendMessage(message.from, '❌ Não encontrei nenhum número que eu possa utilizar. *Tente de novo*!');
					}

					orderData.number_phone = numbersInMessage[0].number.number.toString();

					stage = Stages.EMAIL;
                    
					await client.sendMessage(message.from, `*📝 Ótimo*, Senhor(a) ${orderData.name}. Qualquer novidades eu entrei em contato pelo número *${parsePhoneNumber(orderData.number_phone)?.nationalNumber}*!`);
					await client.sendMessage(message.from, '📧 Agora eu vou precisar do seu endereço de email.');

					return;
				}

				if(stage === Stages.EMAIL) {
					collector.resetTimer();
                    
					let email = message.body.toLowerCase();

					if(!email.includes('@')) {
						email += '@gmail.com';
					}

					stage = Stages.CEP;

					orderData.email = email;

					await client.sendMessage(message.from, `*📝 Ok*, lhe enviarei a nota fiscal pelo email *${email}*.`);
					await client.sendMessage(message.from, '🗺️ Qual o *CEP* que destinado a entrega da encomenda?');

					return;
				}

				if(stage === Stages.CEP) {
					collector.resetTimer();

					const cep = message.body.match(/\d/g)?.join('');

					if(!cep) {
						return;
					}

					await client.sendMessage(message.from, '*🗺️🔍 Aguarde*, estou procurando aqui no mapa');

					const cepResult = await cepPromise(cep).catch(() => undefined);

					if(!cepResult) {
						return client.sendMessage(message.from, '*❌ Não encontrei seu CEP!* Tente novamente!');
					}

					stage = Stages.ADDRESS_NUMBER;
                    
					orderData.address = { ...cepResult, number: undefined as any };

					await client.sendMessage(message.from, `*📍 Encontrado*\n*-* ${cepResult.street}, ${cepResult.city} (${cepResult.state})`);
					await client.sendMessage(message.from, '#️⃣ Agora me informe o *número do local da entrega*.');

					return;
				}

				if(stage === Stages.ADDRESS_NUMBER) {
					collector.resetTimer();
                    
					const content = message.body.toLowerCase();

					stage = Stages.PHONE_NUMBER;

					orderData.address.number = content;

					const cartListString = orderData.items.map(item => `▶️ *[${item.price}] ${item.description}*\n${formatter.format(item.price).replace('BRS', 'R$')}/${item.sale_type === 'VOLUME' ? 'Kg' : 'Un'}          ${item.amount} ${item.sale_type === 'VOLUME' ? 'Kg' : 'Un'}          ${formatter.format(item.price * item.amount).replace('BRS', 'R$')}`).join('\n----------------------------\n');


					await client.sendMessage(message.from, '*📝 Perfeito*.');
					await client.sendMessage(message.from, `*📝 Tudo anotado!*\n👤 ${orderData.name}\n- ${orderData.cpf}\n----------------------------\n🗺️ ${orderData.address.street}, ${orderData.address.number} [ CEP: ${orderData.address.cep} ]\n- ${orderData.address.neighborhood} -> ${orderData.address.city} (${orderData.address.state})\n----------------------------\n*🛒 Items do carrinho*\n${cartListString}\n----------------------------\n*TOTAL:            ${formatter.format(orderData.items.reduce((previous, current) => previous + (current.amount * current.price), 0)).replace('BRS', 'R$')}*\n----------------------------\nID: ${orderData.id}`);
					
					const filePath = `${process.cwd()}/${orderData.id}-PaymentQRCode.png`;
					await QRCode.toFile(filePath, paymentLink);

					const media = MessageMedia.fromFilePath(filePath);
					
					await client.sendMessage(message.from, media, { caption: `*${paymentLink}*\n💳 Agora você só precisa *realizar o pagamento* que lhe enviarei sua encomenda.\n_🗨️ Lembrando, se caso quiser fazer outra encomenda basta me enviar um "Olá"_` });
					
					fs.rm(filePath, () => {});
					collector.stop();
					return resolve(true);
				}
			});
		});
	},
};