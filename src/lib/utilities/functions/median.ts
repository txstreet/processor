/**
 * Takes an array of numbers and returns the median.
 * 
 * @param array The array of numbers
 * @param toFixed Rather or not this should be truncated to 2 decimal points. 
 */
export default (array: number[], toFixed: boolean): number => {
    var value = 0; 
    array.sort((a: any, b: any) => a - b); 
    if(array.length === 0) return 0;
    var half = Math.floor(array.length / 2);
    if(array.length % 2) value = array[half];
    else value = (array[half - 1] + array[half]) / 2; 
    if(!toFixed) return value;

    if(toFixed) { 
        let returnValue = Number(value.toFixed(2));
        if(returnValue > 0) return returnValue; 
        returnValue = Number(value.toFixed(3))
        if(returnValue > 0) return returnValue;
        return Number(value.toFixed(4));
    } else {
        return value;
    }
}