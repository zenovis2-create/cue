import { writeHeartbeat } from './heartbeat.js';
const [path, start] = process.argv.slice(2);
if (!path || !start) throw new Error('heartbeat path and start time required');
const tick = (): void => writeHeartbeat(path, { pid: process.pid, start_time: start });
tick();
setInterval(tick, 30);
