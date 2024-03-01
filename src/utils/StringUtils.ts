export class StringUtils {
	static removeAccents(string: string) {
		return string.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	};

	static toTitleCase(string: string) {
		return string.replace(/\w\S*/g, (string) => string.charAt(0).toUpperCase() + string.substr(1).toLowerCase());
	};

	static checkSimilarityStrings(stringUno: string, stringTwo: string): number {
		if(stringUno.toString() === stringTwo) return 1.0;
      
		const len1 = stringUno.toString().length;
		const len2 = stringTwo.length;
      
		const maxDist = ~~(Math.max(len1, len2)/2)-1;
		let matches = 0;
      
		const hash1 = [];
		const hash2 = [];
      
		for(let i=0; i<len1; i++) {
			for(let j=Math.max(0, i-maxDist); j<Math.min(len2, i+maxDist+1); j++) {
				if(stringUno.toString().charAt(i) === stringTwo.charAt(j) && !hash2[j]) {
					hash1[i] = 1;
					hash2[j] = 1;
					matches++;
					break;
				}
			}
		}
      
		if(!matches) return 0.0;
      
		let t = 0;
		let point = 0;
      
		for(let k = 0; k < len1; k++)
			if(hash1[k]) {
				while(!hash2[point]) {
					point++;
				}
        
				if(stringUno.toString().charAt(k) !== stringTwo.charAt(point++)) { t++; }
			}
      
		t/=2;
      
		return ((matches / len1) + (matches / len2) + ((matches - t) / matches)) / 3.0;
	};
}