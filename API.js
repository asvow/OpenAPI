/**
 * OpenAPI
 * @author: AsVow
 * @Modified form: Peng-YM
 * https://github.com/asvow/OpenAPI/blob/main/README.md
 */
function ENV() {
  const isQX = typeof $task !== 'undefined';
  const isLoon = typeof $loon !== 'undefined';
  const isSurge = typeof $httpClient !== 'undefined' && !isLoon;
  const isNode = typeof module !== 'undefined' && !!module.exports;
  const isRequest = typeof $request !== 'undefined';
  const isResponse = typeof $response !== 'undefined';
  const isScriptable = typeof importModule !== 'undefined';
  return {
    isQX,
    isLoon,
    isSurge,
    isNode,
    isRequest,
    isResponse,
    isScriptable
  };
}

function HTTP(defaultOptions = {
  baseURL: ''
}) {
  const {
    isQX,
    isLoon,
    isSurge,
    isNode,
    isScriptable,
  } = ENV();
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH'];
  const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/

  function send(method, options) {
    options = typeof options === 'string' ? {
      url: options
    } : options;
    const baseURL = defaultOptions.baseURL;
    if (baseURL && !URL_REGEX.test(options.url || '')) {
      options.url = baseURL ? baseURL + options.url : options.url;
    }
    if (options && options.body && options.headers && !options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }
    options = {
      ...defaultOptions,
      ...options
    };
    const timeout = options.timeout;
    const events = {
      ...{
        onRequest: () => {},
        onResponse: (resp) => resp,
        onTimeout: () => {},
      },
      ...options.events,
    };

    events.onRequest(method, options);

    let worker;
    if (isQX) {
      worker = $task.fetch({
        method,
        ...options
      });
    } else if (isLoon || isSurge || isNode) {
      worker = new Promise((resolve, reject) => {
        const request = isNode ? require('request') : $httpClient;
        request[method.toLowerCase()](options, (err, response, body) => {
          if (err) reject(err);
          else
            resolve({
              statusCode: response.status || response.statusCode,
              headers: response.headers,
              body,
            });
        });
      });
    } else if (isScriptable) {
      const request = new Request(options.url);
      request.method = method;
      request.headers = options.headers;
      request.body = options.body;
      worker = new Promise((resolve, reject) => {
        request
          .loadString()
          .then((body) => {
            resolve({
              statusCode: request.response.statusCode,
              headers: request.response.headers,
              body,
            });
          })
          .catch((err) => reject(err));
      });
    }

    let timeoutid;
    const timer = timeout ?
      new Promise((_, reject) => {
        timeoutid = setTimeout(() => {
          events.onTimeout();
          return reject(
            `${method} URL: ${options.url} exceeds the timeout ${timeout} ms`
          );
        }, timeout);
      }) :
      null;

    return (timer ?
      Promise.race([timer, worker]).then((res) => {
        clearTimeout(timeoutid);
        return res;
      }) :
      worker
    ).then((resp) => events.onResponse(resp));
  }

  const http = {};
  methods.forEach(
    (method) =>
    (http[method.toLowerCase()] = (options) => send(method, options))
  );
  return http;
}

function API(name = 'untitled', debug = false) {
  const {
    isQX,
    isLoon,
    isSurge,
    isNode,
    isScriptable
  } = ENV();
  return new(class {
    constructor(name, debug) {
      this.name = name;
      this.debug = debug;

      this.http = HTTP();
      this.env = ENV();

      isNode && (this.isMute = process.env.isMute || this.isMute, this.isMuteLog = process.env.isMuteLog || this.isMuteLog);
      this.startTime = new Date().getTime();
      console.log(`🔔${name}, 开始!`);

      this.node = (() => {
        if (isNode) {
          const fs = require('fs');
          return {
            fs,
          };
        } else {
          return null;
        }
      })();

      this.initCache();

      const delay = (t, v) =>
        new Promise(function (resolve) {
          setTimeout(resolve.bind(null, v), t);
        });

      Promise.prototype.delay = function (t) {
        return this.then(function (v) {
          return delay(t, v);
        });
      };
    }

    // persistence
    // initialize cache
    initCache() {
      if (isQX) this.cache = JSON.parse($prefs.valueForKey(this.name) || '{}');
      if (isLoon || isSurge)
        this.cache = JSON.parse($persistentStore.read(this.name) || '{}');

      if (isNode) {
        // create a json for root cache
        let fpath = 'root.json';
        if (!this.node.fs.existsSync(fpath)) {
          this.node.fs.writeFileSync(
            fpath,
            JSON.stringify({}), {
              flag: 'wx'
            },
            (err) => console.log(err)
          );
        }
        this.root = {};

        // create a json file with the given name if not exists
        fpath = `${this.name}.json`;
        if (!this.node.fs.existsSync(fpath)) {
          this.node.fs.writeFileSync(
            fpath,
            JSON.stringify({}), {
              flag: 'wx'
            },
            (err) => console.log(err)
          );
          this.cache = {};
        } else {
          this.cache = JSON.parse(
            this.node.fs.readFileSync(`${this.name}.json`)
          );
        }
      }
    }

    // store cache
    persistCache() {
      const data = JSON.stringify(this.cache, null, 2);
      if (isQX) $prefs.setValueForKey(data, this.name);
      if (isLoon || isSurge) $persistentStore.write(data, this.name);
      if (isNode) {
        this.node.fs.writeFileSync(
          `${this.name}.json`,
          data, {
            flag: 'w'
          },
          (err) => console.log(err)
        );
        this.node.fs.writeFileSync(
          'root.json',
          JSON.stringify(this.root, null, 2), {
            flag: 'w'
          },
          (err) => console.log(err)
        );
      }
    }

    write(data, key) {
      this.log(`SET ${key}`);
      if (key.indexOf('#') !== -1) {
        key = key.substr(1);
        if (isSurge || isLoon) {
          return $persistentStore.write(data, key);
        }
        if (isQX) {
          return $prefs.setValueForKey(data, key);
        }
        if (isNode) {
          this.root[key] = data;
        }
      } else {
        this.cache[key] = data;
      }
      this.persistCache();
    }

    read(key) {
      this.log(`READ ${key}`);
      if (key.indexOf('#') !== -1) {
        key = key.substr(1);
        if (isSurge || isLoon) {
          return $persistentStore.read(key);
        }
        if (isQX) {
          return $prefs.valueForKey(key);
        }
        if (isNode) {
          return this.root[key];
        }
      } else {
        return this.cache[key];
      }
    }

    delete(key) {
      this.log(`DELETE ${key}`);
      if (key.indexOf('#') !== -1) {
        key = key.substr(1);
        if (isSurge || isLoon) {
          return $persistentStore.write(null, key);
        }
        if (isQX) {
          return $prefs.removeValueForKey(key);
        }
        if (isNode) {
          delete this.root[key];
        }
      } else {
        delete this.cache[key];
      }
      this.persistCache();
    }

    // notification
    notify(title, subtitle = '', content = '', options = {}) {
      const openURL = options['open-url'];
      const mediaURL = options['media-url'];
      content = content.replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm,'');

      if (!this.isMute) {
        if (isQX) $notify(title, subtitle, content, options);
        if (isSurge) {
          $notification.post(
            title,
            subtitle,
            content + `${mediaURL ? '\n多媒体:' + mediaURL : ''}`, {
              url: openURL,
            }
          );
        }
        if (isLoon) {
          let opts = {};
          if (openURL) opts['openUrl'] = openURL;
          if (mediaURL) opts['mediaUrl'] = mediaURL;
          if (this.toStr(opts) === '{}') {
            $notification.post(title, subtitle, content);
          } else {
            $notification.post(title, subtitle, content, opts);
          }
        }
        if (isNode) {
          new Promise(async(resolve) => {
            const content_ = (subtitle ? `${subtitle}\n` : '') +
            content +
            (openURL ? `\n点击跳转: ${openURL}` : '') +
            (mediaURL ? '\n多媒体: ' + mediaURL : '');
            await this.sendNotify(title, content_, {url: openURL});
          });
        }
      }
      if (!this.isMuteLog) {
        let logs = ['', '==============📣系统通知📣=============='];
        logs.push(title);
        subtitle ? logs.push(subtitle) : '';
        content ? logs.push(content) : '';
        openURL ? logs.push(`点击跳转: ${openURL}`) : '';
        mediaURL ? logs.push(`多媒体: ${mediaURL}`) : '';
        console.log(logs.join('\n'));
      }
    }

   /**
    * sendNotify 推送通知功能
    * @param text 通知头
    * @param desp 通知体
    * @param params 某些推送通知方式点击弹窗可跳转, 例：{ url: 'https://abc.com' }
    * @returns {Promise<unknown>}
    */
    sendNotify(text, desp, params = {}) {
      return new Promise(async(resolve) => {
        //提供9种通知
        this.querystring = require('querystring');
        this.timeout = this.timeout || '15000'; //超时时间(单位毫秒)
        desp += this.author || '\n\n仅供用于学习 https://ooxx.be/js'; //增加作者信息
        this.setParam();
        await Promise.all([
          this.serverNotify(text, desp), //微信server酱
          this.pushPlusNotify(text, desp), //pushplus(推送加)
        ]);
        //由于上述两种微信通知需点击进去才能查看到详情, 故text(标题内容)携带了通知概要, 方便区分消息来源
        text = text.match(/.*?(?=\s?-)/g) ? text.match(/.*?(?=\s?-)/g)[0] : text;
        await Promise.all([
          this.BarkNotify(text, desp, params), //iOS Bark APP
          this.tgBotNotify(text, desp), //Telegram 机器人
          this.ddBotNotify(text, desp), //钉钉机器人
          this.qywxBotNotify(text, desp), //企业微信机器人
          this.qywxamNotify(text, desp), //企业微信应用消息推送
          this.iGotNotify(text, desp, params), //iGot
          this.gobotNotify(text, desp), //go-cqhttp
        ]);
      });
    }

    setParam() {
      // 云端环境变量的判断与接收
      // 微信server酱
      this.SCKEY = process.env.SCKEY || this.SCKEY;
      // pushplus(推送加)
      this.PUSH_PLUS_TOKEN = process.env.PUSH_PLUS_TOKEN || this.PUSH_PLUS_TOKEN;
      this.PUSH_PLUS_USER = process.env.PUSH_PLUS_USER || this.PUSH_PLUS_USER;
      // iOS Bark APP
      this.BARK_PUSH = process.env.BARK_PUSH || this.BARK_PUSH;
      this.BARK_SOUND = process.env.BARK_SOUND || this.BARK_SOUND;
      this.BARK_GROUP = process.env.BARK_GROUP || 'AsVow';
      if (this.BARK_PUSH && !this.BARK_PUSH.includes('http')) {
        this.BARK_PUSH = `https://api.day.app/${this.BARK_PUSH}`;
      }
      // Telegram 机器人
      this.TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || this.TG_BOT_TOKEN;
      this.TG_USER_ID = process.env.TG_USER_ID || this.TG_USER_ID;
      this.TG_PROXY_AUTH = process.env.TG_PROXY_AUTH || this.TG_PROXY_AUTH;
      this.TG_PROXY_HOST = process.env.TG_PROXY_HOST || this.TG_PROXY_HOST;
      this.TG_PROXY_PORT = process.env.TG_PROXY_PORT || this.TG_PROXY_PORT;
      this.TG_API_HOST = process.env.TG_API_HOST || 'api.telegram.org';
      // 钉钉机器人
      this.DD_BOT_TOKEN = process.env.DD_BOT_TOKEN || this.DD_BOT_TOKEN;
      this.DD_BOT_SECRET = process.env.DD_BOT_SECRET || this.DD_BOT_SECRET;
      // 企业微信机器人
      this.QYWX_KEY = process.env.QYWX_KEY || this.QYWX_KEY;
      // 企业微信应用消息推送
      this.QYWX_AM = process.env.QYWX_AM || this.QYWX_AM;
      // iGot
      this.IGOT_PUSH_KEY = process.env.IGOT_PUSH_KEY || this.IGOT_PUSH_KEY;
      // go-cqhttp
      this.GOBOT_URL = process.env.GOBOT_URL || this.GOBOT_URL;
      this.GOBOT_TOKEN = process.env.GOBOT_TOKEN || this.GOBOT_TOKEN;
      this.GOBOT_QQ = process.env.GOBOT_QQ || this.GOBOT_QQ;
    }

    serverNotify(text, desp, time = 2100) {
      return new Promise((resolve) => {
        if (this.SCKEY) {
          //微信server酱推送通知一个\n不会换行，需要两个\n才能换行，故做此替换
          desp = desp.replace(/[\n\r]/g, '\n\n');
          const options = {
            url: this.SCKEY.includes('SCT') ? `https://sctapi.ftqq.com/${this.SCKEY}.send` : `https://sc.ftqq.com/${this.SCKEY}.send`,
            body: `text=${text}&desp=${desp}`,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: this.timeout
          };
          setTimeout(() => {
            this.http.post(options)
              .then((resp) => {
                const data = this.toObj(resp.body);
                //server酱和Server酱·Turbo版的返回json格式不太一样
                if (data.errno === 0 || data.data.errno === 0) {
                  console.log('server酱发送通知消息成功🎉\n');
                } else if (data.errno === 1024) {
                  // 一分钟内发送相同的内容会触发
                  console.log(`server酱发送通知消息异常: ${data.errmsg}\n`);
                } else {
                  console.log(`server酱发送通知消息异常\n${this.toStr(data)}`);
                }
              })
              .catch((err) => {
                console.log('server酱发送通知调用API失败！！\n');
                this.error(err);
              })
              .finally(() => {
                resolve();
              });
          }, time);
        } else {
          //console.log('\n\n您未提供server酱的SCKEY，取消微信推送消息通知🚫\n');
          resolve();
        }
      });
    }

    pushPlusNotify(text, desp) {
      return new Promise((resolve) => {
        if (this.PUSH_PLUS_TOKEN) {
          desp = desp.replace(/[\n\r]/g, '<br>'); // 默认为html, 不支持plaintext
          const body = {
            token: `${this.PUSH_PLUS_TOKEN}`,
            title: `${text}`,
            content: `${desp}`,
            topic: `${this.PUSH_PLUS_USER}`,
          };
          const options = {
            url: `https://www.pushplus.plus/send`,
            body: this.toStr(body),
            headers: {
              'Content-Type': ' application/json',
            },
            timeout: this.timeout
          };
          this.http.post(options)
            .then((resp) => {
              const data = this.toObj(resp.body);
              if (data.code === 200) {
                console.log(`push+发送${this.PUSH_PLUS_USER ? '一对多' : '一对一'}通知消息完成。\n`);
              } else {
                console.log(`push+发送${this.PUSH_PLUS_USER ? '一对多' : '一对一'}通知消息失败：${data.msg}\n`);
              }
            })
            .catch((err) => {
              console.log(`push+发送${this.PUSH_PLUS_USER ? '一对多' : '一对一'}通知消息失败！！\n`);
              this.error(err);
            })
             .finally(() => {
              resolve();
            });
        } else {
          //console.log('您未提供push+推送所需的PUSH_PLUS_TOKEN，取消push+推送消息通知🚫\n');
          resolve();
        }
      });
    }

    BarkNotify(text, desp, params = {}) {
      return new Promise((resolve) => {
        if (this.BARK_PUSH) {
          const options = {
            url: `${this.BARK_PUSH}/${encodeURIComponent(text)}/${encodeURIComponent(
              desp
            )}?sound=${this.BARK_SOUND}&group=${this.BARK_GROUP}&${this.querystring.stringify(params)}`,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: this.timeout
          };
          this.http.get(options)
            .then((resp) => {
              const data = this.toObj(resp.body);
              if (data.code === 200) {
                console.log('Bark APP发送通知消息成功🎉\n');
              } else {
                console.log(`${data.message}\n`);
              }
            })
            .catch((err) => {
              console.log('Bark APP发送通知调用API失败！！\n');
              this.error(err);
            })
             .finally(() => {
              resolve();
            });
        } else {
          //console.log('您未提供Bark的APP推送BARK_PUSH，取消Bark推送消息通知🚫\n');
          resolve();
        }
      });
    }

    tgBotNotify(text, desp) {
      return new Promise((resolve) => {
        if (this.TG_BOT_TOKEN && this.TG_USER_ID) {
          const options = {
            url: `https://${this.TG_API_HOST}/bot${this.TG_BOT_TOKEN}/sendMessage`,
            body: `chat_id=${this.TG_USER_ID}&text=${text}\n\n${desp}&disable_web_page_preview=true`,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: this.timeout
          };
          if (this.TG_PROXY_HOST && this.TG_PROXY_PORT) {
            const proxy = {
                host: this.TG_PROXY_HOST,
                port: this.TG_PROXY_PORT * 1,
                proxyAuth: this.TG_PROXY_AUTH,
             };
            Object.assign(options, { proxy });
          }
          this.http.post(options)
            .then((resp) => {
              const data = this.toObj(resp.body);
              if (data.ok) {
                console.log('Telegram发送通知消息成功🎉。\n');
              } else if (data.error_code === 400) {
                console.log('请主动给bot发送一条消息并检查接收用户ID是否正确。\n');
              } else if (data.error_code === 401) {
                console.log('Telegram bot token 填写错误。\n');
              }
            })
            .catch((err) => {
              console.log('Telegram发送通知消息失败！！\n');
              this.error(err);
             })
            .finally(() => {
              resolve();
            });
        } else {
          //console.log('您未提供telegram机器人推送所需的TG_BOT_TOKEN和TG_USER_ID，取消telegram推送消息通知🚫\n');
          resolve();
        }
       });
     }

    ddBotNotify(text, desp) {
      return new Promise((resolve) => {
        const options = {
          url: `https://oapi.dingtalk.com/robot/send?access_token=${this.DD_BOT_TOKEN}`,
          json: {
            msgtype: 'text',
            text: {
              content: ` ${text}\n\n${desp}`,
            },
          },
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: this.timeout
        };
        if (this.DD_BOT_TOKEN && this.DD_BOT_SECRET) {
          const crypto = require('crypto');
          const dateNow = Date.now();
          const hmac = crypto.createHmac('sha256', this.DD_BOT_SECRET);
          hmac.update(`${dateNow}\n${this.DD_BOT_SECRET}`);
          const result = encodeURIComponent(hmac.digest('base64'));
          options.url = `${options.url}&timestamp=${dateNow}&sign=${result}`;
          this.http.post(options)
            .then((resp) => {
              const data = this.toObj(resp.body);
              if (data.errcode === 0) {
                console.log('钉钉发送通知消息成功🎉。\n');
              } else {
                console.log(`${data.errmsg}\n`);
              }
            })
            .catch((err) => {
              console.log('钉钉发送通知消息失败！！\n');
              this.error(err);
            })
             .finally(() => {
              resolve();
            });
        } else if (this.DD_BOT_TOKEN) {
          this.http.post(options)
            .then((resp) => {
              const data = this.toObj(resp.body);
              if (data.errcode === 0) {
                console.log('钉钉发送通知消息完成。\n');
              } else {
                console.log(`${data.errmsg}\n`);
              }
            })
            .catch((err) => {
              console.log('钉钉发送通知消息失败！！\n');
              this.error(err);
            })
             .finally(() => {
              resolve();
            });
        } else {
          //console.log('您未提供钉钉机器人推送所需的DD_BOT_TOKEN或者DD_BOT_SECRET，取消钉钉推送消息通知🚫\n');
          resolve();
        }
      });
    }

    qywxBotNotify(text, desp) {
      return new Promise((resolve) => {
        const options = {
          url: `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${this.QYWX_KEY}`,
          json: {
            msgtype: 'text',
            text: {
              content: ` ${text}\n\n${desp}`,
            },
          },
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: this.timeout
        };
        if (this.QYWX_KEY) {
          this.http.post(options)
            .then((resp) => {            
              const data = this.toObj(resp.body);
              if (data.errcode === 0) {
                console.log('企业微信发送通知消息成功🎉。\n');
              } else {
                console.log(`${data.errmsg}\n`);
              }
            })
            .catch((err) => {
              console.log('企业微信发送通知消息失败！！\n');
              this.error(err);
            })
             .finally(() => {
              resolve();
            });
        } else {
          //console.log('您未提供企业微信机器人推送所需的QYWX_KEY，取消企业微信推送消息通知🚫\n');
          resolve();
        }
      });
    }

    ChangeUserId(desp) {
      this.QYWX_AM_AY = this.QYWX_AM.split(',');
      if (this.QYWX_AM_AY[2]) {
        const userIdTmp = this.QYWX_AM_AY[2].split('|');
        let userId = '';
        for (let i = 0; i < userIdTmp.length; i++) {
          const count = '账号' + (i + 1);
          const count2 = '签到号 ' + (i + 1);
          if (desp.match(count2)) {
            userId = userIdTmp[i];
          }
        }
        if (!userId) userId = this.QYWX_AM_AY[2];
        return userId;
      } else {
        return '@all';
      }
    }

    qywxamNotify(text, desp) {
      return new Promise((resolve) => {
        if (this.QYWX_AM) {
          this.QYWX_AM_AY = this.QYWX_AM.split(',');
          const options_accesstoken = {
            url: `https://qyapi.weixin.qq.com/cgi-bin/gettoken`,
            json: {
              corpid: `${this.QYWX_AM_AY[0]}`,
              corpsecret: `${this.QYWX_AM_AY[1]}`,
            },
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: this.timeout
          };
          let options;
          this.http.post(options_accesstoken)
            .then((resp) => {
              const html = desp.replace(/\n/g, '<br/>');
              const json = this.toObj(resp.body);
              const accesstoken = json.access_token;

              switch (this.QYWX_AM_AY[4]) {
                case '0':
                  options = {
                    msgtype: 'textcard',
                    textcard: {
                      title: `${text}`,
                      description: `${desp}`,
                      url: 'https://ooxx.be/js',
                      btntxt: '更多',
                    },
                  };
                  break;

                case '1':
                  options = {
                    msgtype: 'text',
                    text: {
                      content: `${text}\n\n${desp}`,
                    },
                  };
                  break;

                default:
                  options = {
                    msgtype: 'mpnews',
                    mpnews: {
                      articles: [
                        {
                          title: `${text}`,
                          thumb_media_id: `${this.QYWX_AM_AY[4]}`,
                          author: `智能助手`,
                          content_source_url: ``,
                          content: `${html}`,
                          digest: `${desp}`,
                        },
                      ],
                    },
                  };
              }
              if (!this.QYWX_AM_AY[4]) {
                //如不提供第四个参数,则默认进行文本消息类型推送
                options = {
                  msgtype: 'text',
                  text: {
                    content: `${text}\n\n${desp}`,
                  },
                };
              }
              options = {
                url: `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accesstoken}`,
                json: {
                  touser: `${this.ChangeUserId(desp)}`,
                  agentid: `${this.QYWX_AM_AY[3]}`,
                  safe: '0',
                  ...options,
                },
                headers: {
                  'Content-Type': 'application/json',
                },
              };
            })

            this.http.post(options)
              .then((resp) => {              
                const data = this.toObj(data);
                if (data.errcode === 0) {
                  console.log('成员ID:' + this.ChangeUserId(desp) + '企业微信应用消息发送通知消息成功🎉。\n');
                } else {
                  console.log(`${data.errmsg}\n`);
                }
              })
              .catch((err) => {
                console.log('成员ID:' + this.ChangeUserId(desp) + '企业微信应用消息发送通知消息失败！！\n');
                this.error(err);
              })
               .finally(() => {
                resolve();
              });
        } else {
          //console.log('您未提供企业微信应用消息推送所需的QYWX_AM，取消企业微信应用消息推送消息通知🚫\n');
          resolve();
        }
      });
    }

    iGotNotify(text, desp, params = {}) {
      return new Promise((resolve) => {
        if (this.IGOT_PUSH_KEY) {
          // 校验传入的IGOT_PUSH_KEY是否有效
          this.IGOT_PUSH_KEY_REGX = new RegExp('^[a-zA-Z0-9]{24}$');
          if (!this.IGOT_PUSH_KEY_REGX.test(this.IGOT_PUSH_KEY)) {
            console.log('您所提供的IGOT_PUSH_KEY无效\n');
            resolve();
            return;
          }
          const options = {
            url: `https://push.hellyw.com/${this.IGOT_PUSH_KEY.toLowerCase()}`,
            body: `title=${text}&content=${desp}&${this.querystring.stringify(params)}`,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: this.timeout
          };
          this.http.post(options)
            .then((resp) => {
              const data = this.toObj(resp.body);
              if (data.ret === 0) {
                console.log('iGot发送通知消息成功🎉\n');
              } else {
                console.log(`iGot发送通知消息失败：${data.errMsg}\n`);
              }
            })
            .catch((err) => {
              console.log('iGot发送通知调用API失败！！\n');
              this.error(err);
            })
             .finally(() => {
              resolve();
            });
        } else {
          //console.log('您未提供iGot的推送IGOT_PUSH_KEY，取消iGot推送消息通知🚫\n');
          resolve();
        }
      });
    }

    gobotNotify(text, desp, time = 2100) {
      return new Promise((resolve) => {
        if (this.GOBOT_URL) {
          const options = {
            url: `${this.GOBOT_URL}?access_token=${this.GOBOT_TOKEN}&${this.GOBOT_QQ}`,
            body: `message=${text}\n${desp}`,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: this.timeout
          };
          setTimeout(() => {
            this.http.post(options)
              .then((resp) => {               
                const data = this.toObj(resp.body);
                if (data.retcode === 0) {
                  console.log('go-cqhttp发送通知消息成功🎉\n');
                } else if (data.retcode === 100) {
                  console.log(`go-cqhttp发送通知消息异常: ${data.errmsg}\n`);
                } else {
                  console.log(`go-cqhttp发送通知消息异常\n${this.toStr(data)}`);
                }
              })
              .catch((err) => {
                console.log('发送go-cqhttp通知调用API失败！！\n');
                this.error(err);
              })
             .finally(() => {
              resolve();
            });
          }, time);
        } else {
          //console.log('您未提供Gobot的GOBOT_URL、GOBOT_TOKEN、GOBOT_QQ，取消go-cqhttp推送消息通知🚫\n');
          resolve();
        }
      });
    }

    // other helper functions
    log(msg) {
      if (this.debug) console.log(`[${this.name}] LOG:\n${this.toStr(msg)}`);
    }

    info(msg) {
      console.log(`[${this.name}] INFO:\n${this.toStr(msg)}`);
    }

    error(msg) {
      console.log(`[${this.name}] ERROR:\n${this.toStr(msg)}`);
    }

    wait(millisec) {
      return new Promise((resolve) => setTimeout(resolve, millisec));
    }

    done(value = {}) {
      const endTime = new Date().getTime();
      const costTime = (endTime - this.startTime) / 1000;
      console.log(`🔔${this.name}, 结束! 🕛 ${costTime} 秒`);
      if (isQX || isLoon || isSurge) {
        $done(value);
      } else if (isNode) {
        if (typeof $context !== 'undefined') {
          $context.headers = value.headers;
          $context.statusCode = value.statusCode;
          $context.body = value.body;
        }
      }
    }

    toObj(obj_or_str) {
      if (typeof obj_or_str === 'object' || obj_or_str instanceof Object)
        return obj_or_str;
      else
      try {
        return JSON.parse(obj_or_str)
      } catch (err) {
        return obj_or_str;
      }
    }

    toStr(obj_or_str) {
      if (typeof obj_or_str === 'string' || obj_or_str instanceof String)
        return obj_or_str;
      else
      try {
        return JSON.stringify(obj_or_str)
      } catch (err) {
        return obj_or_str;
      }
    }
  })(name, debug);
}