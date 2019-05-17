"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const EventEmitter = require("events");
const fs = require("fs");
const os = require("os");
const v8Analytics = require('v8-analytics');
const v8memAnalytics = require('v8-analytics/lib/mem_analysis.js');
const profiler = require('v8-profiler-node8');
const defaultPeriod = 2000;
const cpuFull = 100;
class Monitor extends EventEmitter {
    constructor() {
        super();
    }
    computeProcessCpu(pid, period) {
        const startTime = process.hrtime();
        const startUsage = process.cpuUsage();
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                let elapTimeMS = hrtimeToMS(process.hrtime(startTime));
                let elapUsageMS = usageToTotalUsageMS(process.cpuUsage(startUsage));
                let cpuPercent = ((cpuFull * elapUsageMS) / elapTimeMS).toFixed(1);
                let result = {
                    elapTimeMS,
                    elapUsageMS,
                    cpuPercent,
                    period
                };
                resolve(result);
            }, period);
        });
    }
    computeDeviceCpu() {
        const cpuUsage = os.cpus();
        const statics = { user: 0, sys: 0, idle: 0, all: 0 };
        cpuUsage.forEach((c) => {
            const times = c.times;
            const user = Number(times.user);
            const nice = Number(times.nice);
            const sys = Number(times.sys);
            const idle = Number(times.idle);
            const irq = Number(times.irq);
            statics.user = statics.user + user;
            statics.sys = statics.sys + sys;
            statics.idle = statics.idle + idle;
            statics.all = statics.all + user + nice + sys + idle + irq;
        });
        return {
            userPercent: (statics.user / statics.all).toFixed(2),
            sysPercent: (statics.sys / statics.all).toFixed(2),
            idlePercent: (statics.idle / statics.all).toFixed(2)
        };
    }
    computeMemoryUsage() {
        let memoryUsage = process.memoryUsage();
        return {
            rss: bytesToMB(memoryUsage.rss),
            heapTotal: bytesToMB(memoryUsage.heapTotal),
            heapUsed: bytesToMB(memoryUsage.heapUsed),
            external: bytesToMB(memoryUsage.external)
        };
    }
    computePerf(period) {
        this.deviceCpuProfiler = this.computeDeviceCpu();
        this.processMemoryUsage = this.computeMemoryUsage();
        return new Promise((resolve, reject) => {
            this.computeProcessCpu(process.pid, period).then((processProfiler) => {
                let res = {
                    cpu: {
                        device: this.deviceCpuProfiler,
                        process: processProfiler
                    },
                    memory: this.processMemoryUsage
                };
                resolve(res);
            });
        });
    }
    functionProfiler(period) {
        profiler.startProfiling('cpu', true);
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                let profile1 = profiler.stopProfiling();
                profile1.export((error, result) => {
                    createDir('profiler');
                    fs.writeFileSync('profiler/profile.cpu.json', result);
                    const execTime = 30;
                    let snapshotJson = JSON.parse(result);
                    let str = v8Analytics(snapshotJson, execTime);
                    profile1.delete();
                    resolve(str);
                });
            }, period);
        });
    }
    memSnapshot() {
        let snapshot = profiler.takeSnapshot();
        return new Promise((resolve) => {
            snapshot.export((error, result) => {
                createDir('profiler');
                fs.writeFileSync('profiler/profile.mem.heapsnapshot', result);
                snapshot.delete();
                resolve(result);
            });
        });
    }
    memSnapshotAnalytics() {
        return new Promise((resolve) => {
            this.memSnapshot().then((res) => {
                let json = JSON.parse(res);
                resolve(v8memAnalytics(json));
            });
        });
    }
    getAnalytics(ctx) {
        let url = ctx.request.url.split('?')[0];
        let period = ctx.query.period || defaultPeriod;
        switch (url) {
            case '/monitor/profiler':
                return this.computePerf(period);
            case '/monitor/profiler/function':
                return this.functionProfiler(period);
            case '/monitor/profiler/mem':
                ctx.set('Content-disposition', 'attachment;filename=' + 'profiler.mem.heapsnapshot');
                return this.memSnapshot();
            case '/monitor/profiler/mem-analytics':
                return this.memSnapshotAnalytics();
            default:
                return;
        }
    }
}
function usageToTotalUsageMS(elapUsage) {
    const unit = 1000;
    let elapUserMS = elapUsage.user / unit;
    let elapSystMS = elapUsage.system / unit;
    return elapUserMS + elapSystMS;
}
function hrtimeToMS(hrtime) {
    const unit1 = 1000;
    const unit2 = 1000000;
    return hrtime[0] * unit1 + hrtime[1] / unit2;
}
function bytesToMB(bytes) {
    const unit = 1024;
    return (bytes / unit / unit).toFixed(2);
}
function createDir(dirName) {
    if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName);
    }
}
exports.default = Monitor;
//# sourceMappingURL=monitor.js.map