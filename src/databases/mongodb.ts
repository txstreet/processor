import { MongoClient } from 'mongodb';
const uri = process.env.MONGODB_URI || '';
const client = new MongoClient(uri);

var connection: MongoClient | undefined;

const createExportObject = async (database: string = process.env.MONGODB_DATABASE): Promise<any> => {
    if (connection) return { connection, database: connection.db(database) };
    connection = await client.connect();

    const db = connection.db(database);
    return { connection, database: db };
}

export default createExportObject;