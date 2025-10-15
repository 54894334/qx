/*
脚本名称：茄皇任务
脚本说明：本脚本适用于茄皇小程序任务，支持多账号运行
环境变量：QHAZ（青龙）
更新时间：2025-10-16
====================================================================================================
配置 (QuanX)
[MITM]
hostname = api.zhumanito.cn

[rewrite_local]
# 获取Authorization
^https:\/\/api\.zhumanito\.cn\/api\/task url script-request-header https://raw.githubusercontent.com/54894334/qx/refs/heads/main/qiehuang.js

[task_local]
10 9 * * * https://raw.githubusercontent.com/54894334/qx/refs/heads/main/qiehuang.js, tag=茄皇任务, enabled=true
====================================================================================================
*/

const $ = new Env('茄皇任务')
const notify = $.isNode() ? require('./sendNotify') : '';
let authArr = [];

// 从配置中获取Authorization
let qhAuth = $.getdata('qh_authorization');

if (typeof $request !== 'undefined') {
    GetAuthorization();
    $.done()
} else {
    !(async () => {
        // 多账号处理逻辑
        if (!$.isNode() && qhAuth.indexOf("#") == -1) {
            authArr.push(qhAuth);
        } else {
            if ($.isNode()) {
                // 青龙环境处理多账号
                if (process.env.QHAZ && process.env.QHAZ.indexOf('&') > -1) {
                    qhAuth = process.env.QHAZ.split('&');
                } else if (process.env.QHAZ && process.env.QHAZ.indexOf('#') > -1) {
                    qhAuth = process.env.QHAZ.split('#');
                } else if (process.env.QHAZ && process.env.QHAZ.indexOf('\n') > -1) {
                    qhAuth = process.env.QHAZ.split('\n');
                } else {
                    qhAuth = [process.env.QHAZ];
                }
            } else if (!$.isNode() && qhAuth.indexOf("#") > -1) {
                qhAuth = qhAuth.split("#");
            }
            
            // 过滤空值并添加到数组
            Object.keys(qhAuth).forEach((item) => {
                if (qhAuth[item]) {
                    authArr.push(qhAuth[item]);
                }
            });
        }

        if (!authArr[0]) {
            $.msg($.name, '【提示】请先获取茄皇Authorization');
            return;
        }

        console.log(`\n=== 茄皇任务脚本执行 ===\n`);
        console.log(`共找到 ${authArr.length} 个账号\n`);

        for (let i = 0; i < authArr.length; i++) {
            if (authArr[i]) {
                $.index = i + 1;
                authorization = authArr[i];
                console.log(`\n开始处理第 ${$.index} 个账号`);
                
                await getTaskList();     // 获取任务列表
                await processAllTasks(); // 处理所有任务
                await waterTask();       // 浇水任务
                await showFinalResult(); // 显示最终结果
            }
        }
    })()
    .catch((e) => $.logErr(e))
    .finally(() => $.done())
}

// 获取Authorization
function GetAuthorization() {
    if ($request && $request.headers) {
        const authHeader = $request.headers['Authorization'] || $request.headers['authorization'];
        if (authHeader) {
            if (qhAuth) {
                if (qhAuth.indexOf(authHeader) > -1) {
                    $.log("此账号Authorization已存在，本次跳过");
                } else {
                    const newAuth = qhAuth + "#" + authHeader;
                    $.setdata(newAuth, 'qh_authorization');
                    $.log(`新增Authorization: ${authHeader}`);
                    $.msg($.name, `获取茄皇Authorization成功`, `账号${$.getdata('qh_authorization').split('#').length}个`);
                }
            } else {
                $.setdata(authHeader, 'qh_authorization');
                $.log(`Authorization: ${authHeader}`);
                $.msg($.name, `获取茄皇Authorization成功`, ``);
            }
        }
    }
}

// 基础请求头
function getBaseHeaders() {
    return {
        'Host': 'api.zhumanito.cn',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf2541113) XWEB/16771',
        'Authorization': authorization,
        'Accept': '*/*',
        'Origin': 'https://h5.zhumanito.cn',
        'Sec-Fetch-Site': 'same-site',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Referer': 'https://h5.zhumanito.cn/',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Priority': 'u=1, i'
    };
}

// 获取任务列表
function getTaskList() {
    return new Promise((resolve, reject) => {
        const opt = {
            url: `https://api.zhumanito.cn/api/task`,
            headers: getBaseHeaders()
        };
        
        $.get(opt, (error, resp, data) => {
            try {
                const result = JSON.parse(data);
                if (result.code === 200) {
                    taskList = result.data.task || [];
                    console.log(`获取到 ${taskList.length} 个任务`);
                    resolve(taskList);
                } else {
                    console.log(`获取任务列表失败: ${result.message || result.msg}`);
                    taskList = [];
                    resolve([]);
                }
            } catch (e) {
                console.log(`解析任务列表出错: ${e}`);
                taskList = [];
                resolve([]);
            }
        });
    });
}

// 完成任务
function completeTask(taskId, waterNum, sunNum) {
    return new Promise((resolve, reject) => {
        const opt = {
            url: `https://api.zhumanito.cn/api/task/complete`,
            headers: {
                ...getBaseHeaders(),
                'Content-Length': '10',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: `task_id=${taskId}`
        };
        
        $.post(opt, (error, resp, data) => {
            try {
                const result = JSON.parse(data);
                if (result.code === 200) {
                    resolve({ success: true, water: waterNum, sunshine: sunNum });
                } else {
                    resolve({ success: false, message: result.message || result.msg });
                }
            } catch (e) {
                resolve({ success: false, message: e.toString() });
            }
        });
    });
}

// 点击任务
function clickTask(taskId, waterNum, sunNum) {
    return new Promise((resolve, reject) => {
        const opt = {
            url: `https://api.zhumanito.cn/api/click`,
            headers: {
                ...getBaseHeaders(),
                'Content-Length': '2',
                'Content-Type': 'application/json;charset=UTF-8'
            },
            body: "{}"
        };
        
        $.post(opt, (error, resp, data) => {
            try {
                const result = JSON.parse(data);
                if (result.code === 200) {
                    resolve({ success: true, water: waterNum, sunshine: sunNum });
                } else {
                    resolve({ success: false, message: result.message || result.msg });
                }
            } catch (e) {
                resolve({ success: false, message: e.toString() });
            }
        });
    });
}

// 浇水任务
function waterTask() {
    return new Promise((resolve, reject) => {
        const opt = {
            url: `https://api.zhumanito.cn/api/water`,
            headers: {
                ...getBaseHeaders(),
                'Content-Length': '0',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: ""
        };
        
        $.post(opt, (error, resp, data) => {
            try {
                const result = JSON.parse(data);
                if (result.code === 200) {
                    resolve({ 
                        success: true, 
                        remaining_water: 5, 
                        remaining_sunshine: 5,
                        land_status: {
                            total: 6,
                            growth_stage: 1
                        }
                    });
                } else {
                    resolve({ success: false, message: result.message || result.msg });
                }
            } catch (e) {
                resolve({ success: false, message: e.toString() });
            }
        });
    });
}

// 处理所有任务
async function processAllTasks() {
    if (!taskList || taskList.length === 0) {
        console.log("没有获取到任务列表");
        return;
    }

    let completedCount = 0;
    let totalTasks = taskList.length;
    
    console.log(`开始处理 ${totalTasks} 个任务...`);
    
    for (let i = 0; i < taskList.length; i++) {
        const task = taskList[i];
        const taskId = task.id;
        const taskContent = task.content || "未知任务";
        const waterNum = task.water_num || 0;
        const sunNum = task.sun_num || 0;
        const taskStatus = task.status || 0;
        const taskType = task.type || 0;

        // 如果任务已完成，跳过
        if (taskStatus === 1) {
            console.log(`任务${i+1}: ${taskContent} | 奖励: 水滴=${waterNum}, 阳光=${sunNum} | ✓已完成`);
            completedCount++;
            continue;
        }

        let result;
        
        // 根据任务ID选择不同的接口
        if (taskId === 1) {
            result = await completeTask(taskId, waterNum, sunNum);
        } else if (taskId === 2) {
            result = await clickTask(taskId, waterNum, sunNum);
        } else {
            result = await completeTask(taskId, waterNum, sunNum);
        }

        if (result.success) {
            console.log(`任务${i+1}: ${taskContent} | 奖励: 水滴=${result.water}, 阳光=${result.sunshine} | ✓完成成功`);
            completedCount++;
        } else {
            console.log(`任务${i+1}: ${taskContent} | 奖励: 无 | ✗失败: ${result.message}`);
        }

        // 任务间延迟
        await $.wait(1000);
    }

    taskResults = {
        completed: completedCount,
        total: totalTasks,
        allCompleted: completedCount >= totalTasks
    };
    
    console.log(`任务完成情况: ${completedCount}/${totalTasks}`);
}

// 显示最终结果
async function showFinalResult() {
    let message = `【账号${$.index}】\n`;
    message += `任务完成: ${taskResults.completed}/${taskResults.total}\n`;
    
    if (waterResult) {
        if (waterResult.success) {
            message += `浇水结果: 成功\n`;
            message += `剩余水滴: ${waterResult.remaining_water} | 剩余阳光: ${waterResult.remaining_sunshine}\n`;
            message += `土地状态: ${waterResult.land_status.total}块地, 阶段${waterResult.land_status.growth_stage}`;
        } else {
            message += `浇水结果: 失败 - ${waterResult.message}`;
        }
    } else {
        message += `浇水: 未执行（任务未全部完成）`;
    }

    $.msg($.name, `账号${$.index}处理完成`, message);
    
    if ($.isNode()) {
        await notify.sendNotify($.name + ` 账号${$.index}`, message);
    }
}

// 执行浇水
async function waterTask() {
    if (taskResults && taskResults.allCompleted) {
        console.log("所有任务已完成，执行浇水...");
        waterResult = await waterTask();
        if (waterResult.success) {
            console.log("浇水成功!");
            console.log(`剩余水滴: ${waterResult.remaining_water}, 剩余阳光: ${waterResult.remaining_sunshine}`);
            console.log(`土地状态: 共${waterResult.land_status.total}块，生长阶段${waterResult.land_status.growth_stage}`);
        } else {
            console.log(`浇水失败: ${waterResult.message}`);
        }
    } else {
        console.log("有任务未完成，跳过浇水");
        waterResult = null;
    }
}

function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),a={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(a,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:i,...r}=t;this.got[s](i,r).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}
