import { NumberEmojis } from '../Constants';

export function numberToEmoji(number: number, lenght: number) {
	let chars = [ ...number.toString() ];

	const lenghtSlots = lenght.toString().length;

	if(number < Number('9'.repeat(lenghtSlots))) {
		chars = [ ...Array(lenghtSlots - chars.length).fill(0), ...chars ];
	}

	return chars.map(x => NumberEmojis[Number(x)]);
}