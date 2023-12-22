
export default class TimeoutCollection {
    public duration: number;
    public timestamps: any = {};
    public values: any = {};

    constructor(duration: number) {
        this.duration = duration;

        setInterval(() => {
            const timestamps = Object.keys(this.timestamps); 
            for(let i = 0; i < timestamps.length; i++) {
                const timestamp = Number(timestamps[i]); 
                if(Date.now() - this.duration >= timestamp) {
                    this.timestamps[timestamp].forEach((key: string) => {
                        delete this.values[key]; 
                    })
                    delete this.timestamps[timestamp]; 
                }
            }
        }, 1000);
    }

    public add(key: string, value: any, timestamp: number) {
        this.values[key] = value;
        if(!this.timestamps[timestamp])
            this.timestamps[timestamp] = [];
        this.timestamps[timestamp].push(key); 
    }

    public all(): any[] {
        return Object.values(this.values); 
    }
}