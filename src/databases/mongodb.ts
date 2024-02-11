import config from '../lib/utilities/config';
import { MongoClient } from 'mongodb';

type connectionResult = {
  connection: MongoClient,
  database: any, // Not `mongodb.Db`, that causes lots of compilation errors
};

let connection: MongoClient | undefined;

const getConnection = async (): Promise<connectionResult> => {
  if (!connection) connection = await establishConnection();
  const database = connection.db(config.mongodbDatabase);

  return {connection, database};
};

const establishConnection = async (): Promise<MongoClient> => {
  const client = new MongoClient(config.mongodbUri);
  return await client.connect();
};


export default getConnection;
