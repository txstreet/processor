import avro from 'avsc';

export const ETHTransactionsSchema = avro.Type.forSchema({
    name: 'ETHTransactionsCollection',
    type: 'record',
    fields: [
        { name: 'timestamp', type: 'long', default: 0 },
        { 
            name: 'collection', 
            type: {
                type: 'array', 
                items: { 
                    name: "ETHTransaction", 
                    type: "record", 
                    fields: [
                        { name: 'hash', type: ['string', 'null'], default: "" }, 
                        { name: 'from', type: ['string', 'null'], default: "" },
                        { name: 'insertedAt', type: ['long', 'null'], default: 0 }, 
                        { name: 'timestamp', type: ['long', 'null'], default: -1 }, 
                        { name: 'gas', type: ['long', 'null'], default: 0  }, 
                        { name: 'value', type: ['double', 'null'], default: 0  }, 
                        { name: 'gasPrice', type: ['long', 'null'], default: 0  }, 
                        { name: 'maxFeePerGas', type: ['long', 'null'], default: 0 },
                        { name: 'maxPriorityFeePerGas', type: ['long', 'null'], default: 0 },
                        { name: 'dropped', type: ['boolean', 'null'], default: false },
                        { name: 'processed', type: ['boolean', 'null'], default: false },
                        { name: 'extras', type: ['string', 'null'], default: "{}" },
                        { name: 'pExtras', type: ['string', 'null'], default: "{}" } 
                    ]
                } 
            } 
        }
    ]
})

// { baseFeePerGas: 1, gasUsed: 1, gasLimit: 1, difficulty: 1, size: 1, , gasUsedDif: 1, transactions: 1 } 
export const ETHBlocksSchema = avro.Type.forSchema({
    name: 'ETHBlocksCollection',
    type: 'record',
    fields: [
        { name: 'timestamp', type: 'long', default: 0 },
        { 
            name: 'collection', 
            type: {
                type: 'array', 
                items: { 
                    name: "ETHBlock", 
                    type: "record", 
                    fields: [
                        { name: 'hash', type: 'string' },
                        { name: 'height', type: 'long' },
                        { name: 'timestamp', type: 'long', default: 0 },
                        { name: 'gasUsedDif', type: ['double', 'null'], default: 0.0  },
                        { name: 'size', type: 'long', default: 0  },
                        { name: 'gasLimit', type: 'long', default: 0 },
                        { name: 'gasUsed', type: 'long', default: 0 },
                        { name: 'baseFeePerGas', type: ['long', 'null'], default: 0 },
                        { name: 'difficulty', type: 'string' },
                        { name: 'transactions', type: 'long', default: 0 }
                    ]
                } 
            } 
        }
    ]
})

export const XMRTransactionsSchema = avro.Type.forSchema({
    name: 'XMRTransactionsCollection',
    type: 'record',
    fields: [
        { name: 'timestamp', type: 'long', default: 0 },
        { 
            name: 'collection', 
            type: {
                type: 'array', 
                items: { 
                    name: "XMRTransaction", 
                    type: "record", 
                    fields: [
                        { name: 'hash', type: ['string', 'null'], default: "" }, 
                        { name: 'insertedAt', type: ['long', 'null'], default: 0 }, 
                        { name: 'fee', type: ['double', 'null'], default: 0 }, 
                        { name: 'size', type: ['double', 'null'], default: 0 }, 
                        { name: 'timestamp', type: ['double', 'null'], default: -1 }, 
                        { name: 'dropped', type: ['boolean', 'null'], default: false },
                        { name: 'processed', type: ['boolean', 'null'], default: false } 
                    ]
                } 
            } 
        }
    ]
})

export const XMRBlocksSchema = avro.Type.forSchema({
    name: 'XMRBlocksCollection',
    type: 'record',
    fields: [
        { name: 'timestamp', type: 'long', default: 0 },
        { 
            name: 'collection', 
            type: {
                type: 'array', 
                items: { 
                    name: "XMRBlock", 
                    type: "record", 
                    fields: [
                        { name: 'hash', type: 'string' },
                        { name: 'height', type: 'long' },
                        { name: 'timestamp', type: 'long', default: 0 },
                        { name: 'size', type: 'long', default: 0  },
                        { name: 'difficulty', type: 'double' },
                        { name: 'transactions', type: 'long', default: 0 }
                    ]
                } 
            } 
        }
    ]
})

export const BTCTransactionsSchema = avro.Type.forSchema({
    name: 'BTCTransactionsCollection',
    type: 'record',
    fields: [
        { name: 'timestamp', type: 'long', default: 0 },
        { 
            name: 'collection', 
            type: {
                type: 'array', 
                items: { 
                    name: "BTCTransaction", 
                    type: "record", 
                    fields: [
                        { name: 'hash', type: ['string', 'null'], default: "" }, 
                        { name: 'insertedAt', type: ['long', 'null'], default: 0 }, 
                        { name: 'fee', type: ['double', 'boolean', 'null'], default: 0 }, 
                        { name: 'size', type: ['double', 'null'], default: 0 }, 
                        { name: 'rsize', type: ['double', 'null'], default: 0 }, 
                        { name: 'timestamp', type: ['long', 'null'], default: -1 }, 
                        { name: 'dropped', type: ['boolean', 'null'], default: false },
                        { name: 'processed', type: ['boolean', 'null'], default: false } 
                    ]
                } 
            } 
        }
    ]
})

export const BTCBlocksSchema = avro.Type.forSchema({
    name: 'BTCBlocksCollection',
    type: 'record',
    fields: [
        { name: 'timestamp', type: 'long', default: 0 },
        { 
            name: 'collection', 
            type: {
                type: 'array', 
                items: { 
                    name: "BTCBlock", 
                    type: "record", 
                    fields: [
                        { name: 'hash', type: 'string' },
                        { name: 'height', type: 'long' },
                        { name: 'timestamp', type: 'long', default: 0 },
                        { name: 'size', type: 'long', default: 0  },
                        { name: 'difficulty', type: 'double' },
                        { name: 'transactions', type: 'long', default: 0 }
                    ]
                } 
            } 
        }
    ]
})
