/**
 * @fileOverview v8 分析中间件
 */

import Monitor from './libs/monitor';

import auth = require('basic-auth');
import { V8ProfOptions } from '../typings/index';

export default function(options: V8ProfOptions) {
  let monitor: Monitor;

  return async function DarukMonitor(ctx: any, next: any) {
    if (ctx.request && /^\/monitor\//.test(ctx.request.url)) {
      // 访问监控路由需要通过验证
      const authRes = doAuth(ctx, options.auth);
      if (authRes) {
        try {
          if (!monitor) monitor = getMonitor();
          let result = monitor.getAnalytics(ctx);
          if (result) {
            ctx.body = await result;
          }
        } catch (e) {
          ctx.body = e.message;
        }
      }
    }
    await next();
  };
  // 封装到函数中，避免 v8 模块不存在报错
  // 只有开启监控时，才获取
  function getMonitor() {
    // const { v8AnalyticsPath, v8ProfilerPath } = options;
    return new Monitor();
  }
}

function doAuth(ctx: any, authOptions: { name: string; password: string }) {
  const credentials = auth(ctx.req);
  const { name, password } = authOptions;
  const errorCode = 401;
  if (credentials && name === credentials.name && password === credentials.pass) return true;
  ctx.status = errorCode;
  ctx.set('WWW-Authenticate', 'Basic realm="daruk"');
  ctx.body = 'Access denied';
  return false;
}
