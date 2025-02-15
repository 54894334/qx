/*[rewrite_local]
# Token捕获规则
^https:\/\/api\.alldragon\.com\/mkt2\/ url script-response-body  https://raw.githubusercontent.com/54894334/qx/refs/heads/main/qsqd/qsqd.js 

[task_local]
# 每日签到任务
0 9 * * * dragon_all_in_one.js, tag=龙腾签到, img-url=airplane.circle.fill, enabled=true

[mitm]
hostname = api.alldragon.com, servicewechat.com
// 修正版一体化脚本 (dragon_fixed.js)
const AUTH_KEY = 'dragon_auth';
const CHECKIN_URL = 'https://api.alldragon.com/mkt2/checkin/checkin.json';
const WARN_DAYS = 3;

// 统一错误处理
function errorHandler(error) {
  const msg = `${error.name}: ${error.message}`;
  $notify('❌ 脚本异常', msg, '查看日志详情');
  console.log(`Stack: ${error.stack}\n${JSON.stringify(error)}`);
}

// 入口分派
try {
  if (typeof $request !== 'undefined') {
    handleTokenCapture();
  } else {
    main().catch(errorHandler);
  }
} catch (e) {
  errorHandler(e);
}

// Token捕获函数
function handleTokenCapture() {
  try {
    const newToken = $request.headers?.Authorization;
    if (!newToken) return $done({});

    let tokens = JSON.parse($persistentStore.read(AUTH_KEY) || [];
    
    if (!tokens.includes(newToken)) {
      tokens.push(newToken);
      $persistentStore.write(JSON.stringify(tokens), AUTH_KEY);
      console.log(`New token captured: ${newToken.slice(0, 15)}...`);
    }
    
    $done({});
  } catch (e) {
    errorHandler(e);
    $done({});
  }
}

// 主签到逻辑
async function main() {
  try {
    const tokens = JSON.parse($persistentStore.read(AUTH_KEY) || '[]');
    if (tokens.length === 0) throw new Error('未找到存储的Token');

    for (const [index, token] of tokens.entries()) {
      console.log(`Processing account #${index + 1}`);
      
      // 有效性检查
      const validation = validateToken(token);
      if (!validation.valid) {
        $notify(`账号${index + 1} 异常`, validation.message);
        continue;
      }

      // 执行签到
      const result = await checkin(token);
      handleResult(result, index + 1);
      
      await sleep(2000);
    }
  } catch (e) {
    errorHandler(e);
  }
}

// Token验证
function validateToken(token) {
  try {
    const [_, payloadBase64] = token.split('.');
    if (!payloadBase64) return { valid: false, message: 'Token格式错误' };

    const payloadStr = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadStr);
    
    const expireTime = payload.exp * 1000;
    const remainDays = (expireTime - Date.now()) / 86400000;

    if (remainDays < 0) return { valid: false, message: 'Token已过期' };
    if (remainDays <= WARN_DAYS) {
      $notify('⏳ Token即将过期', 
        `剩余天数: ${Math.ceil(remainDays)}`, 
        `到期时间: ${new Date(expireTime).toLocaleDateString()}`);
    }
    
    return { valid: true, message: 'Token有效' };
  } catch (e) {
    return { valid: false, message: `验证失败: ${e.message}` };
  }
}

// 签到请求
async function checkin(token) {
  try {
    const response = await $task.fetch({
      url: CHECKIN_URL,
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.56(0x18003830) NetType/WIFI Language/zh_CN',
        'Referer': 'https://servicewechat.com/wx2940c7ac0144e13b/21/page-frame.html'
      },
      body: 'tenantId=4202&tenantCode=lyqs&clientType=3'
    });

    return {
      success: response.statusCode === 200,
      data: safeParse(response.body),
      code: response.statusCode
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// 辅助函数
function safeParse(json) {
  try { return JSON.parse(json); } 
  catch { return { raw: json.slice(0, 100) }; }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function handleResult(result, index) {
  if (result.success && result.data?.code === 0) {
    const detail = `积分: ${result.data.data?.score || '无'}\n连续签到: ${result.data.data?.continueDay || '无'}`;
    $notify(`✅ 账号${index} 成功`, detail);
  } else {
    const errMsg = result.data?.message || result.error || '未知错误';
    $notify(`❌ 账号${index} 失败`, `状态码: ${result.code}`, errMsg);
  }
}
