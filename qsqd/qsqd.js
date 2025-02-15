//泉舜签到
// nz_qsqd = {'Authorization账号1','Authorization账号二'}
// 功能：自动捕获Token + 签到 + 续期检查
//[rewrite_local]
//# Token捕获规则
//^https:\/\/api\.alldragon\.com\/mkt2\/ url script-response-body dragon_all_in_one.js
//[task_local]
//# 每日签到任务
//0 9 * * * dragon_all_in_one.js, tag=龙腾签到, img-url=airplane.circle.fill, enabled=true
//[mitm]
//hostname = api.alldragon.com

const AUTH_KEY = 'nz_qsqd';
const CHECKIN_URL = 'https://api.alldragon.com/mkt2/checkin/checkin.json';
const WARN_DAYS = 3; // 过期提醒阈值

// 判断执行模式
if (typeof $request !== 'undefined') {
  // 重写模式：捕获Token
  handleTokenCapture();
} else {
  // 任务模式：执行签到
  main();
}

function handleTokenCapture() {
  const newToken = $request.headers?.Authorization;
  if (!newToken) return $done({});

  let tokens = JSON.parse($persistentStore.read(AUTH_KEY) || [];
  
  // 去重检查
  if (!tokens.includes(newToken)) {
    tokens.push(newToken);
    $persistentStore.write(JSON.stringify(tokens), AUTH_KEY);
    $notify('🔑 令牌已更新', '龙腾出行Token捕获成功');
  }
  
  $done({});
}

async function main() {
  const tokens = JSON.parse($persistentStore.read(AUTH_KEY) || '[]');
  
  if (tokens.length === 0) {
    return $notify('⚠️ 未找到Token', '请先打开龙腾小程序', '操作步骤见通知');
  }

  for (const [index, token] of tokens.entries()) {
    // 有效性检查
    const { valid, msg } = checkToken(token);
    if (!valid) {
      $notify(`❌ 账号${index+1} 无效`, msg);
      continue;
    }

    // 执行签到
    const result = await checkin(token);
    handleResult(result, index+1);
    
    await sleep(2000); // 防并发限制
  }
}

function checkToken(token) {
  try {
    const payload = JSON.parse(
      $text.base64Decode(token.split('.')[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/'))
    );
    
    const expireTime = payload.exp * 1000;
    const remain = expireTime - Date.now();
    
    if (remain < 0) return { valid: false, msg: '已过期' };
    if (remain < 86400000 * WARN_DAYS) {
      $notify('⏳ Token即将过期', 
        `剩余 ${Math.ceil(remain/86400000)}天`, 
        `到期: ${new Date(expireTime).toLocaleDateString()}`);
    }
    
    return { valid: true, msg: `有效期剩余: ${Math.ceil(remain/86400000)}天` };
  } catch (e) {
    return { valid: false, msg: '格式错误' };
  }
}

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
      data: parseData(response.body),
      code: response.statusCode
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function parseData(body) {
  try {
    return JSON.parse(body);
  } catch {
    return { message: body.slice(0, 100) };
  }
}

function handleResult(result, index) {
  if (result.success && result.data?.code === 0) {
    const detail = `积分: ${result.data.data?.score || '无'}\n连续签到: ${result.data.data?.continueDay || '无'}`;
    $notify(`✅ 账号${index} 成功`, detail);
  } else {
    const errMsg = result.data?.message || result.error || '未知错误';
    $notify(`❌ 账号${index} 失败`, `Code: ${result.code}`, errMsg);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
