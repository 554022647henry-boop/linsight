import express, { type Request, type Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { apiRouter } from './routes/index.js';
import { initSchema } from './db/index.js';

// 启动时初始化 schema（幂等）
initSchema();

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// 健康检查
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'linsight-server', time: new Date().toISOString() });
});

// API 路由
app.use('/api', apiRouter);

// 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'not_found', message: 'Endpoint not found' });
});

// 错误处理
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'internal', message: err.message });
});

app.listen(PORT, () => {
  console.log(`[Linsight] server running at http://localhost:${PORT}`);
});
