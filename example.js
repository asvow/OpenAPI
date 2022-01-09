const $ = API("APP", true); // API("APP") --> 无log输出
// 测试console
$.log("测试输出");
$.error("这是一条错误信息");

// 测试通知
$.error({
  message: "Test ERROR"
});
$.notify("标题");
$.notify("跳转测试", "Subtitle", "点击跳转", {
  "open-url": "http://www.bing.com",
});
$.notify("图片测试（QX有效）", "Subtitle", "", {
  "media-url":
    "https://avatars.githubusercontent.com/u/88471740",
});
$.notify("HELLO", "", "");

// 测试缓存
const key = "测试";
const data = "数据";
$.write(data, key);
$.write("Hello", "World");
$.log(`当前缓存：\n${JSON.stringify($.cache)}`);
if ($.read(key) !== data) {
  $.notify("缓存测试炸了！", "", "");
} else {
  $.log("缓存测试通过！");
}
$.delete(key);
if ($.read(key)) {
  $.log("缓存Key未删除！");
}

$.write("World", "#Hello");
if ($.read("#Hello") !== "World") {
  $.notify("缓存测试炸了！", "", "");
} else {
  $.log("缓存测试通过！");
}

$.delete("#Hello");
if ($.read("#Hello")) {
  $.log("缓存Key未删除！");
}

const obj = {
  hello: {
    world: "HELLO",
  },
};

$.write(obj, "obj");

// 测试请求
const headers = {
  "user-agent": "OpenAPI",
};
const rawBody = "This is expected to be sent back as part of response body.";
const jsonBody = {
  HELLO: "WORLD",
  FROM: "OpenAPI",
};

function assertEqual(a, b) {
  for (let [key, value] of Object.entries(a)) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}
!(async () => {
  await $.http
    .get({
      url: "https://postman-echo.com/get?foo1=bar1&foo2=bar2",
      headers,
    })
    .then((response) => {
      const body = JSON.parse(response.body);
      if (!assertEqual(headers, body.headers)) {
        console.log("ERROR: HTTP GET with header test failed!");
      } else {
        console.log("OK: HTTP GET with header test");
      }
    });

  await $.http
    .put({
      url: "https://postman-echo.com/put",
      body: rawBody,
      headers: {
        "content-type": "text/plain",
      },
    })
    .then((response) => {
      const body = JSON.parse(response.body);
      if (body.data !== rawBody) {
        console.log("ERROR: HTTP PUT with raw body test failed!");
      } else {
        console.log("OK: HTTP PUT with raw body test");
      }
    });

  await $.http
    .patch({
      url: "https://postman-echo.com/patch",
      body: JSON.stringify(jsonBody),
    })
    .then((response) => {
      const body = JSON.parse(response.body);
      if (!assertEqual(body.data, jsonBody)) {
        console.log("ERROR: HTTP PATCH with json body test failed!");
      } else {
        console.log("OK: HTTP PATCH with json body test");
      }
    });

  // timeout 测试，不要挂代理
  await $.http
    .get({
      url: "http://www.twitter.com",
      timeout: 100,
      events: {
        onTimeout: () => {
          $.error("OHHHHHHHH");
        }
      }
    })
    .then((response) => {
      console.log(response);
    })
    .catch((error) => {
      console.log(error);
    });

  // 高级用法，自定义HTTP对象，设置默认的baseURL，以及默认的请求选项
  const myHttp = HTTP("http://postman-echo.com", {
    // 这里可以设置默认的请求options，比如timeout，events等
  });
})().then(() => $.done());

// delay
$.wait(1000).then(() => $.log("等待1s"));

$.done();

// prettier-ignore
/*********************************** API *************************************/
function ENV(){const e='undefined'!=typeof $task,t='undefined'!=typeof $loon;return{isQX:e,isLoon:t,isSurge:'undefined'!=typeof $httpClient&&!t,isNode:'undefined'!=typeof module&&!!module.exports,isRequest:'undefined'!=typeof $request,isResponse:'undefined'!=typeof $response,isScriptable:'undefined'!=typeof importModule}}function HTTP(e={baseURL:''}){const{isQX:t,isLoon:s,isSurge:o,isNode:n,isScriptable:i}=ENV(),r=/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;const u={};return['GET','POST','PUT','DELETE','HEAD','OPTIONS','PATCH'].forEach(h=>u[h.toLowerCase()]=(u=>(function(u,h){h='string'==typeof h?{url:h}:h;const a=e.baseURL;a&&!r.test(h.url||'')&&(h.url=a?a+h.url:h.url),h&&h.body&&h.headers&&!h.headers['Content-Type']&&(h.headers['Content-Type']='application/x-www-form-urlencoded');const l=(h={...e,...h}).timeout,c={...{onRequest:()=>{},onResponse:e=>e,onTimeout:()=>{}},...h.events};let d,f;if(c.onRequest(u,h),t)d=$task.fetch({method:u,...h});else if(s||o||n)d=new Promise((e,t)=>{(n?require('request'):$httpClient)[u.toLowerCase()](h,(s,o,n)=>{s?t(s):e({statusCode:o.status||o.statusCode,headers:o.headers,body:n})})});else if(i){const e=new Request(h.url);e.method=u,e.headers=h.headers,e.body=h.body,d=new Promise((t,s)=>{e.loadString().then(s=>{t({statusCode:e.response.statusCode,headers:e.response.headers,body:s})}).catch(e=>s(e))})}const p=l?new Promise((e,t)=>{f=setTimeout(()=>(c.onTimeout(),t(`${u} URL: ${h.url} exceeds the timeout ${l} ms`)),l)}):null;return(p?Promise.race([p,d]).then(e=>(clearTimeout(f),e)):d).then(e=>c.onResponse(e))})(h,u))),u}function API(e='untitled',t=!1){const{isQX:s,isLoon:o,isSurge:n,isNode:i,isScriptable:r}=ENV();return new class{constructor(e,t){this.name=e,this.debug=t,this.http=HTTP(),this.env=ENV(),this.startTime=(new Date).getTime(),console.log(`\ud83d\udd14${e}, \u5f00\u59cb!`),this.node=(()=>{if(i){return{fs:require('fs')}}return null})(),this.initCache();Promise.prototype.delay=function(e){return this.then(function(t){return((e,t)=>new Promise(function(s){setTimeout(s.bind(null,t),e)}))(e,t)})}}initCache(){if(s&&(this.cache=JSON.parse($prefs.valueForKey(this.name)||'{}')),(o||n)&&(this.cache=JSON.parse($persistentStore.read(this.name)||'{}')),i){let e='root.json';this.node.fs.existsSync(e)||this.node.fs.writeFileSync(e,JSON.stringify({}),{flag:'wx'},e=>console.log(e)),this.root={},e=`${this.name}.json`,this.node.fs.existsSync(e)?this.cache=JSON.parse(this.node.fs.readFileSync(`${this.name}.json`)):(this.node.fs.writeFileSync(e,JSON.stringify({}),{flag:'wx'},e=>console.log(e)),this.cache={})}}persistCache(){const e=JSON.stringify(this.cache,null,2);s&&$prefs.setValueForKey(e,this.name),(o||n)&&$persistentStore.write(e,this.name),i&&(this.node.fs.writeFileSync(`${this.name}.json`,e,{flag:'w'},e=>console.log(e)),this.node.fs.writeFileSync('root.json',JSON.stringify(this.root,null,2),{flag:'w'},e=>console.log(e)))}write(e,t){if(this.log(`SET ${t}`),-1!==t.indexOf('#')){if(t=t.substr(1),n||o)return $persistentStore.write(e,t);if(s)return $prefs.setValueForKey(e,t);i&&(this.root[t]=e)}else this.cache[t]=e;this.persistCache()}read(e){return this.log(`READ ${e}`),-1===e.indexOf('#')?this.cache[e]:(e=e.substr(1),n||o?$persistentStore.read(e):s?$prefs.valueForKey(e):i?this.root[e]:void 0)}delete(e){if(this.log(`DELETE ${e}`),-1!==e.indexOf('#')){if(e=e.substr(1),n||o)return $persistentStore.write(null,e);if(s)return $prefs.removeValueForKey(e);i&&delete this.root[e]}else delete this.cache[e];this.persistCache()}notify(e,t='',i='',r={}){const u=r['open-url'],h=r['media-url'];if(i=i.replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm,''),!this.isMute&&(s&&$notify(e,t,i,r),n&&$notification.post(e,t,i+`${h?'\n\u591a\u5a92\u4f53:'+h:''}`,{url:u}),o)){let s={};u&&(s.openUrl=u),h&&(s.mediaUrl=h),'{}'===this.toStr(s)?$notification.post(e,t,i):$notification.post(e,t,i,s)}if(!this.isMuteLog){let s=['','==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============='];s.push(e),t&&s.push(t),i&&s.push(i),u&&s.push(`\u70b9\u51fb\u8df3\u8f6c: ${u}`),h&&s.push(`\u591a\u5a92\u4f53: ${h}`),console.log(s.join('\n'))}}log(e){this.debug&&console.log(`[${this.name}] LOG:\n${this.toStr(e)}`)}info(e){console.log(`[${this.name}] INFO:\n${this.toStr(e)}`)}error(e){console.log(`[${this.name}] ERROR:\n${this.toStr(e)}`)}wait(e){return new Promise(t=>setTimeout(t,e))}done(e={}){const t=((new Date).getTime()-this.startTime)/1e3;console.log(`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${t} \u79d2`),s||o||n?$done(e):i&&'undefined'!=typeof $context&&($context.headers=e.headers,$context.statusCode=e.statusCode,$context.body=e.body)}toObj(e){if('object'==typeof e||e instanceof Object)return e;try{return JSON.parse(e)}catch(t){return e}}toStr(e){if('string'==typeof e||e instanceof String)return e;try{return JSON.stringify(e)}catch(t){return e}}}(e,t)}
/*****************************************************************************/

