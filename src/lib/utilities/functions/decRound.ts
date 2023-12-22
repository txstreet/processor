export default (number: number) => {
    if(number > 10) return Math.round(number).toLocaleString();
    for(let i = 2; i < 10; i++) {
        const pow = Math.pow(10, i);
        let rounded = Math.round((number + Number.EPSILON) * pow) / pow; 
        if(rounded > 0) return rounded; 
    }
    return number; 
}