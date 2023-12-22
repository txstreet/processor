
/**
 * Wraps a setTimeout for the specified duration in a promise.
 */
export default (millis: number): Promise<void> => new Promise((resolve) => {
    setTimeout(() => resolve(), millis); 
});