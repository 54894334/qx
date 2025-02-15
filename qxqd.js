// 青龙脚本 - 泉舜签到
// 使用说明：需配置环境变量 ALLDRAGON_AUTH

const axios = require('axios');
const FormData = require('form-data');

// 基础配置
const CHECKIN_URL = 'https://api.alldragon.com/mkt2/checkin/checkin.json';
const NOTIFY_NAME = process.env.NOTIFY_NAME || 'Bark'; // 通知方式

// 多账户配置（通过环境变量）
const accounts = process.env.ALLDRAGON_AUTH ? 
  process.env.ALLDRAGON_AUTH.split('&') : [];

async function main() {
  if (accounts.length === 0) {
    console.error('❌ 未检测到有效配置，请设置环境变量 ALLDRAGON_AUTH');
    return;
  }

  for (const [index, authToken] of accounts.entries()) {
    try {
      console.log(`🚀 开始执行第 ${index + 1} 个账号签到`);
      const result = await checkin(authToken);
      handleResult(result, index + 1);
      await sleep(2000); // 账号间延迟
    } catch (error) {
      console.error(`❌ 第 ${index + 1} 个账号执行失败：`, error.message);
    }
  }
}

async function checkin(authToken) {
  const form = new FormData();
  form.append('tenantId', '4202');
  form.append('tenantCode', 'lyqs');
  form.append('clientType', '3');

  const headers = {
    'Authorization': authToken,
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.56(0x18003830) NetType/WIFI Language/zh_CN',
    'Referer': 'https://servicewechat.com/wx2940c7ac0144e13b/21/page-frame.html',
    ...form.getHeaders()
  };

  const response = await axios.post(CHECKIN_URL, form, {
    headers,
    timeout: 10000
  });

  return {
    status: response.status,
    data: response.data
  };
}

function handleResult(result, accountIndex) {
  const { status, data } = result;
  
  if (status === 200) {
    if (data.code === 0) {
      const msg = `✅ 账号${accountIndex} 签到成功
连续签到：${data.data?.continueDay || '未知'}
获得积分：${data.data?.score || '未知'}`;
      notify(msg);
      console.log(msg);
    } else {
      const errMsg = `⚠️ 账号${accountIndex} 异常 [${data.code}] ${data.message || ''}`;
      notify(errMsg);
      console.error(errMsg);
    }
  } else {
    const errMsg = `❌ 账号${accountIndex} 请求失败 [HTTP ${status}]`;
    notify(errMsg);
    console.error(errMsg);
  }
}
// 在checkin函数中添加：
const tokenExp = JSON.parse(Buffer.from(authToken.split('.')[1], 'base64').toString()).exp;
if (Date.now()/1000 > tokenExp - 86400) {
  notify(`⚠️ 账号${accountIndex} Token将在24小时后过期`);
}
// 通知功能
function notify(message) {
  if (process.env.BARK_TOKEN) {
    axios.post(`https://api.day.app/${process.env.BARK_TOKEN}/${encodeURIComponent(message)}`);
  }
  if (process.env.SERVERCHAN_KEY) {
    axios.get(`https://sctapi.ftqq.com/${process.env.SERVERCHAN_KEY}.send?title=龙腾签到&desp=${encodeURIComponent(message)}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
