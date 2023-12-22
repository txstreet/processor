export const _implementations: { [key: string]: ChainImplementation[] } = {};

export default abstract class ChainImplementation {
    public chain: string;
    constructor(chain: string) {
        this.chain = chain; 
        if(!_implementations[this.chain]) _implementations[this.chain] = []; 
        _implementations[this.chain].push(this);
    }
    public abstract init(): Promise<ChainImplementation>; 
    public abstract validate(transaction: any): Promise<boolean>;
    public abstract execute(transaction: any): Promise<boolean>; 
}