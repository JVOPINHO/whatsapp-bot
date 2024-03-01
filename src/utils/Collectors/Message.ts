import { Client, Message } from 'whatsapp-web.js';
import Collection from '../Collection';

import Base, { Options } from './Base';

interface CollectorMessageOptions extends Options {
    messageID?: string;
    message?: Message;
    user?: string;
    filter?: (message: Message) => any;
}

class MessageCollector extends Base {
	declare options: CollectorMessageOptions;
	public message?: Message;
	public total: number;
	public users: Collection<string>;

	constructor(client: Client, options: CollectorMessageOptions = {} as CollectorMessageOptions) {
		super(client, options);

		this.message = options.message;
		this.total = 0;
		this.users = new Collection();

		const handleCollect = this.handleCollect.bind(this);

		client.on('message', handleCollect);

		this.once('end', () => {
			client.removeListener('message', handleCollect);
		});

		this.on('collect', (message: Message) => {
			this.total++;
            // @ts-ignore
			this.users.set(message.from);
		});
	}
    
	private collect(message: Message) {
		if(this.options.user && message.from != this.options.user) return;

		return message.id;
	};

	public endReason() {
		if(this.options.max && this.total >= this.options.max) return 'limit';

		return false;
	}
}

export { MessageCollector };