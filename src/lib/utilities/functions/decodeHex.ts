import htmlEntities from "./htmlEntities";
export default (hexx: string , ent: boolean = true, to: string = "string") => {
    let buffer: Buffer | string = Buffer.from(hexx, 'hex');
    let result: boolean | string = false;
    if(to == "string") result = buffer.toString();
    // if(to == "int8") result = buffer.readInt8();
    if(ent) result = htmlEntities(result as string);
    return result;
}
