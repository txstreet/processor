export default (d: any) => {
    let num = "";
    for (let i = 0; i < d.length; i++) {
        num = String(d[i]) + num;
    }
    return Number(num);
}
