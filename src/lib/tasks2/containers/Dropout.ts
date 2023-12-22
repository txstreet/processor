import EventEmitter3 from 'eventemitter3'; 
import fs from 'fs';
import path from 'path';
import avro from 'avsc';
import OverlapProtectedInterval, { setInterval } from '../utils/OverlapProtectedInterval';

/**
 * The purpose of this collection is to contain a containerized array that automatically drops objects
 * that are older than a given age. It inherits from eventemitter3 to allow for subscribing to when
 * items are added or removed from the collection. 
 */
export default class TimeoutCollection<T> extends EventEmitter3 {
    // An object that maps timestamps to an array containing the keys of all items that were added to the 
    // collection at that time. 
    _timestamps: { [key: number]: string[] } = {}; 
    // An object that maps items by their key-identifier. 
    _items: { [key: string]: T } = {}; 
    // The amount of time an object can stay in collection before being dropped. 
    _duration: number; 
    // The string that identifies the 'key' of type T for adding and removing from _items. 
    _key: string;
    // The scheduled task that keeps the collection up to date. 
    _dropoutTaskInstance: OverlapProtectedInterval;
    // The scheduled task that writes the collection to disk. 
    _writeTaskInstance: OverlapProtectedInterval;
    // A field for objects that have a self-contained timestamp to be used, instead of using the current timestamp.
    _timestampField?: string | null = null; 
    // Rather or not the value of _timestampField is in milliseconds, default: true
    _timestampFieldInMilliseconds: boolean = true; 
    // KISS: Use a JSON File to share data between processes. 
    _filePath: string;
    // The internal schema used to serialize data using avro.
    _schema: avro.Type;
    // A simple dirty-flag used to determine if data needs to be written to disk. 
    _dirtyFlag: boolean = false;
    // A simple flag used to determine if the collection is ready to write data. 
    _ready: boolean = false;
    // A minimum capacity, the minimum amount of items the list can contain before dropping items. 
    _minimumCapacity?: number | null = null;

    /**
     * Creates a new instance of TimeoutCollection<T>
     * 
     * @param filename The filename used for KISS data-sharing between processes.
     * @param key The object-key that identifies the T object.
     * @param schema The avro schema. 
     * @param duration The amount of time objects stay in the collection.
     * @param timestampField An object-specific timestamp that replaces Date.now on insert if present.
     * @param timestampFieldInMilliseconds Rather or not the timestampField value is in milliseconds. 
     */
    constructor(filename: string, schema: avro.Type, key: string, duration: number, timestampField?: string | null, timestampFieldInMilliseconds?: boolean, minimumCapacity?: number | null) {
        super(); 
        this._filePath = path.join(__dirname, '..', '..', '..', 'data', filename);
        this._key = key; 
        this._schema = schema;
        this._duration = duration;
        if(timestampField) this._timestampField = timestampField;
        if(timestampFieldInMilliseconds) this._timestampFieldInMilliseconds = timestampFieldInMilliseconds;
        if(minimumCapacity) this._minimumCapacity = minimumCapacity; 
        this._dropoutTaskInstance = setInterval(this._dropoutTask, 500).start(false);
        this._writeTaskInstance = setInterval(this._writeTask, 500).start(false);
    }

    /**
     * Sets the ready state on this collection. 
     * 
     * @param value The value
     */
    public setReady(value: boolean) {
        this._ready = value;
    }

    /**
     * Inserts n items into the collection.
     * 
     * @param items The items to add. 
     */
    public insert(items: T | T[]): void {
        // Since we rebuild the cache at the end of this function, this is a sanity check to prevent unecessary rebuilding.
        if(!items || Array.isArray(items) && !items.length) return;
        // If the items fiels is not an array value, wrap it in an array to prevent having multiple code blocks.
        if(!Array.isArray(items)) 
            items = [items]; 

        // Iterate over the items that we're inserting and assign them.
        for(let i = 0; i < items.length; i++) {
            const entry: any = items[i]; 
            
            // Cache the current timestamp so it's the same across accessors. 
            let now = this._timestampField ? entry[this._timestampField] * (this._timestampFieldInMilliseconds ? 1 : 1000) : Date.now() 

            // If there are no items inserted for this timestamp, create an array to hold inserted keys. 
            if(!this._timestamps[now])
                this._timestamps[now] = []; 

            this._timestamps[now].push(entry[this._key]);
            this._items[entry[this._key]] = entry; 
        }

        // Inform the internal mechanism that we need to write to disk.
        this._dirtyFlag = true; 

        // Broadcast the inserted items using the spead operator to not pass an array through eventemitter3. 
        this.emit('inserted', items); 
    }

    /**
     * Removes n items from the collection.
     * 
     * @param keys The items to remove (by key). 
     * 
     * XXX: It's very likely more efficient to not do an array-search in the _timestamps map and just let it 
     *      skip the operation whenever the time comes for the deleted object to fall out of memory. 
     */
    public remove(keys: string | string[]): void {
        // Since we rebuild the cache at the end of this function, this is a sanity check to prevent unecessary rebuilding.
        if(!keys || Array.isArray(keys) && !keys.length) return;
        // If the items fiels is not an array value, wrap it in an array to prevent having multiple code blocks.
        if(!Array.isArray(keys))
            keys = [keys];

        for(let i = 0; i < keys.length; i++) {
            const key = keys[i]; 
            const exists = this._items[key] != null; 
            if(!exists) continue;
            delete this._items[key]; 
            this.emit('removed', key); 
        }
        
        // Inform the internal mechanism that we need to write to disk.
        this._dirtyFlag = true; 
    }

    /**
     * An internal task that is executed every 100ms
     */
    _writeTask = async (): Promise<void> => {
        if(!this._ready) return; 
        if(!this._dirtyFlag) 
            return;

        try { 
            const collection = Object.values(this._items)
            for (let i = 0; i < collection.length; i++) {
                const entry = collection[i];

                //@ts-ignore
                Object.keys(entry).forEach((k) => (!entry[k] || entry[k] == null || entry[k] == "null") && delete entry[k]);
            }
            
            const contents = this._schema.toBuffer({ timestamp: Date.now(), collection });
            const writingFilePath = this._filePath.replace(/\.bin$/, '-writing.bin');
            fs.writeFileSync(writingFilePath, contents);
            fs.rename(writingFilePath, this._filePath, (err) => {
                this._dirtyFlag = false; 
                if (err) throw err
            });
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * An internal task that is executed every 100ms. 
     */
    _dropoutTask = async (): Promise<void> => {
        // If there's a minimum capacity, make sure that we've reached it.
        if(this._minimumCapacity && Object.keys(this._items).length < this._minimumCapacity) 
            return; 
        // Create a cached unix timestamp for the current time so it's the same between accessors. 
        const now = Math.floor(Date.now() / 1000); 
        // Obtain an array of all timestamps that contain item insertions. 
        const timestamps = Object.keys(this._timestamps); 
        // Iterate over the timestamps and compare them to the current time to see if they are "expired" based on the value of the duration property.
        timestamps.forEach((timestamp: string | number) => {
            // Convert the timestamp back into numerical format since Object.keys returns it as a string. 
            timestamp = Number(timestamp); 
            // Get the difference between the timestamp and the current time. 
            let difference = now - timestamp; 
            // If the difference is greater than the duration property, remove the item(s). 
            if(difference > this._duration) {
                // If there's a minimum capacity, make sure that we adhere to it. 
                if(this._minimumCapacity && Object.keys(this._items).length - this._timestamps[timestamp].length < this._minimumCapacity) 
                    return; 
                // Iterate over each entry and delete the item if it still exists. 
                this.remove(this._timestamps[timestamp]);
                // Remove the timestamp=>array map from memory.
                delete this._timestamps[timestamp]; 
            }
        }); 
    }
}
