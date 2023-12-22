import htmlEntities from "./htmlEntities";
export default (hex: string) => {
    var newHex = "";
    for (var i = 0; i < hex.length; i+=2) {
        newHex = hex.substring(i, i+2) + newHex;
    }
    newHex = htmlEntities(newHex);
    return newHex;
}
