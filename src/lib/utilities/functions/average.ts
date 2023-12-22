/**
 * Takes an array of numbers and returns the average.
 * 
 * @param array The array of numbers
 * @param toFixed Rather or not this should be truncated to 2 decimal points. 
 */
export default (array: number[], toFixed: boolean): number => {
    if(array.length === 0) return 0;
    if(array.length === 1) return array[0]; 
    var value = 0; 
    array.forEach((n: number) => value += n);
    const result = value / array.length;

    if(toFixed) {
        let returnValue = Number(result.toFixed(2));
        if(returnValue > 0) return returnValue; 
        returnValue = Number(result.toFixed(3))
        if(returnValue > 0) return returnValue;
        return Number(result.toFixed(4));
    } else {
        return result;
    }
}