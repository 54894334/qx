
/*/[rewrite]
+ ^https:\/\/api\.alldragon\.com.* url script-request-header https://raw.githubusercontent.com/54894334/qx/refs/heads/main/qsqd/qsqd.ini
[mitm]
hostname = api.alldragon.com
 auth-capture.js*//
const key = "nz_qsqd";
if ($request.headers?.Authorization) {
  const token = $request.headers.Authorization.replace("Bearer ", "");
  $persistentStore.write(token, key);
  $notify("✅ Token Captured", "", token);
}
$done({});
