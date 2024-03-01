import type Items from '../../items.json';

export type ItemOnCart = (typeof Items[0]) & {
    amount: number;
}
export interface Cart {
    items: ItemOnCart[];
}