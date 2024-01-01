
// import fs from 'fs';
import path from 'path'; 
import redis from "../../../databases/redis";

export default (path: string, contents: string, expireSeconds = 21600) => {
  return redis.setAsync(path, contents, "EX", expireSeconds);
}
