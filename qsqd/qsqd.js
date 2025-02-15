// auth-capture.js
const key = "nz_qsqd";
if ($request.headers?.Authorization) {
  const token = $request.headers.Authorization.replace("Bearer ", "");
  $persistentStore.write(token, key);
  $notify("✅ Token Captured", "", token);
}
$done({});
