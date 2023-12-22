

export default class FalloutCollection {
    // The [key] usad to store Key -> Index 
    public itemKey: string; 
    // The maximum size of the collection. 
    public capacity: number;
    // The key to sort data by.
    public sortByKey: string; 
    // Key -> Index 
    public mapByKey: { [key: string]: any } = {}; 
    // Index -> Value 
    public array: any[] = []; 

    constructor(itemKey: string, capacity: number, sortByKey: string) {
        this.itemKey = itemKey;
        this.capacity = capacity;
        this.sortByKey = sortByKey; 
    }

    public add(item: any) {
        let itemSortValue = item[this.sortByKey];

        // Check to see if the collection is at or over capacity. 
        if(this.array.length >= this.capacity) {
            console.log('array is at capacity'); 
            // If the inserted item's sort value is lower than the minimum entry level, cancel.
            if(itemSortValue <= this.array[this.array.length - 1][this.sortByKey])  
                return false; 
            else console.log('Skipping entry, value too low'); 
            // Otherwise, remove the first entry in the collection to make room for the new entry. 
            this.array.pop();
            console.log('Removed entry, values:', this.array);
        }
        
        let lastSortValue = -1; 

        // If the array is not empty, we need to find the best place to insert the new value. 
        if(this.array.length) {
            let itemEntered = false; 
            for(let i = 0; i < this.array.length; i++) {
                let entry = this.array[i];
                let sortValue = entry[this.sortByKey];
                if(itemSortValue >= lastSortValue && itemSortValue <= sortValue) {
                    this.array.splice(i, 0, item); 
                    itemEntered = true; 
                    break;
                }
            }    

            if(itemEntered == false) {
                // Append to the end of the array. 
                this.array.push(item); 
            }
        } else {
            // The array is empty, so simply append the item. 
            this.array.push(item);
        }

        // Rebuild mapByKey
        this.rebuildKeyMap(); 
    }

    public remove(item: any) {
        const key = item[this.itemKey];
        const index = this.mapByKey[key]; 
        delete this.array[index];
        this.rebuildKeyMap(); 
    }

    public find(key: string) {
        const index = this.mapByKey[key];
        const value = this.array[index];
        return value; 
    }

    public values() {
        return this.array; 
    }

    rebuildKeyMap() {
        // Empty the object.
        this.mapByKey = {};

        // Sort the array
        this.array = this.array.sort((a: any, b: any) => b[this.sortByKey] - a[this.sortByKey]); 

        // Iterate over all elements and assign the value. 
        for(let i = 0; i < this.array.length; i++) {
            let entry = this.array[i];
            let key = entry[this.itemKey]; 
            this.mapByKey[key] = i;
        }
    }
}