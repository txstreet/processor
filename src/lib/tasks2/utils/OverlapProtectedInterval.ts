/**
 * The purpose of this implementation is to create an interval system which is time-accurate without allowing for
 * overlap between executions. 
 */
export default class OverlapProtectedInterval {
    _lastExecutionStart: number = 0;
    _lastExecutionFinish: number = 0; 
    _prefferedInterval: number; 
    _task: (...args: any[]) => Promise<void>; 
    _timeout: NodeJS.Timeout; 
    _active: boolean = false;

    constructor(task: (...args: any[]) => Promise<void>, preferredInterval: number) {
        this._prefferedInterval = preferredInterval; 
        this._task = task; 
    }

    public async force() {
        if(this._timeout) {
            clearTimeout(this._timeout); 
            this._timeout = null; 
        }

        try {
            this._lastExecutionStart = Date.now();
            await this._task(); 
            this._lastExecutionFinish = Date.now(); 
        } catch (error) {
            console.error(error); 
        } finally {
            this._execute(); 
        }
    }

    async _execute(immediate: boolean = false): Promise<void> {
        if(this._timeout) return; 

        this._timeout = setTimeout(async () => {
            try {
                this._lastExecutionStart = Date.now();
                await this._task(); 
                this._lastExecutionFinish = Date.now(); 
                this._timeout = null; 
            } catch (error) {
                console.error(error);
                console.error(error); 
                if(this._timeout)   
                    clearTimeout(this._timeout);
                this._timeout = null; 
            } finally {
                this._execute(); 
            }
        }, immediate ? 0 : Math.max(0, this._prefferedInterval - (this._lastExecutionFinish - this._lastExecutionStart))); 
    }

    start(immediate: boolean): OverlapProtectedInterval {
        if(!this._active) {
            this._active = true;
            this._execute(immediate); 
        }
        return this;
    }

    stop(): OverlapProtectedInterval {
        if(this._active && this._timeout)
            clearTimeout(this._timeout); 
        this._timeout = null; 
        this._active = false;
        return this; 
    }
}

export const setInterval = (task: (...args: any[]) => Promise<void>, preferredInterval: number) => 
    new OverlapProtectedInterval(task, preferredInterval);