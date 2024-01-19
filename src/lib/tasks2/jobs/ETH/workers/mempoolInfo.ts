import { setInterval } from "../../../utils/OverlapProtectedInterval";
import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import config from '../../../../utilities/config';
import { ETHWrapper } from '../../../../node-wrappers';

let lastExecutionResults = {
  'mempool-size': 0,
}; 

const start = () => {
  const wrapper = config.initEthWrapper();

  setInterval(async () => {
    await updateStatistics(wrapper)
  }, 1000).start(true);
}

const updateStatistics = async (wrapper: ETHWrapper) => {
  try {
    lastExecutionResults['mempool-size'] = await wrapper.mempoolSize();
  } catch (error) {
    console.error(error); 
  } finally {
    // Wrapping a try/catch inside of a finally looks a little messy, but it's
    // required to prevent a critical failure in the event of a database error.
    // We do this in finally so that we can make sure to update values that have
    // successfully updated in the event of an error.
    try {
      await saveStatistics();
    } catch (error) {
      console.error(error); 
    }
  }
};

const saveStatistics = async () => {
  const { database } = await mongodb();
  const collection = database.collection('statistics');

  if(process.env.UPDATE_DATABASES.toLowerCase() == "true") {
    // TODO: Optimize to not re-insert data to lower bandwidth consumption. 
    await collection.updateOne({ chain: 'ETH' }, { $set: lastExecutionResults }); 
    redis.publish('stats', JSON.stringify({ chain: "ETH", ...lastExecutionResults })); 
  } else {
    console.log('=========================')
    console.log(lastExecutionResults);
  }
};

start();
