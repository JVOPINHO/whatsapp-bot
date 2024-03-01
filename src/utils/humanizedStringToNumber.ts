interface Result {
    value: number;
    type: 'VOLUME' | 'UNIT' | 'ABS'
}

export function humanizedStringToNumber(input: string): Result | number {
	const cleanedInput = input.replace(/\s/g, '').replace(/,/g, '.');

	const regex = /(\d+(\.\d+)?)\s*(kg|g|un|unidade(s?))?/;

	const match = regex.exec(cleanedInput);

	if(!match) {
		return NaN;
	}

	const [, valueStr, , unit] = match;
	const value = parseFloat(valueStr);

	const result: Result = {
		value,
		type: 'ABS',
	};

	switch (unit) {
		case 'kg': {
			result.type = 'VOLUME';
			break;
		}
			
		case 'g': {
			result.value = value / 1000;
			result.type = 'VOLUME';
			break;
		}

		case 'un':
		case 'unidade':
		case 'unidades': {
			result.type = 'UNIT';
			break;
		}
	}

	return result;
}