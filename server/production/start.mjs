import { connectDatabase, verifySchema } from './database.mjs';
import { OperationsRepository } from './operations-repository.mjs';
import { startAttendanceWorker } from './attendance-worker.mjs';
import { createProductionServer } from './http.mjs';

export async function startProduction(config) {
  if (config.apiAdapter !== 'sql') throw new Error('The original-api adapter is not implemented. Choose the SQL adapter.');
  const pool = await connectDatabase(config);
  try {
    await verifySchema(pool);
    const repository = new OperationsRepository(pool);
    const server = createProductionServer({ repository, config });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.port, config.host, resolve); });
    console.log(`CLMS ${config.mode} SQL API listening on ${config.host}:${config.port}.`);
    const stopWorker = startAttendanceWorker(repository);
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      const deadline = setTimeout(() => process.exit(1), 15000); deadline.unref();
      server.close(async () => { await stopWorker(); await pool.close(); clearTimeout(deadline); });
    };
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
    return { server, pool };
  } catch (error) { await pool.close(); throw error; }
}
