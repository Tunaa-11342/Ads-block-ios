const options = {
    appid: '',
    securityKey: ''
};

const notifyName = "spotify歌词翻译2023.10.04-1";
const resStatus = $response.status ? $response.status : $response.statusCode;

if(resStatus !== 200) {
    $done({});
} else {
    const commonApi = new Env(notifyName);
    const isQX = commonApi.isQuanX();
    const binaryBody = isQX ? new Uint8Array($response.bodyBytes) : $response.body;

    const colorLyricsResponseObj = ColorLyricsResponse.fromBinary(binaryBody, { readUnknownField: true });
    const originLanguage = colorLyricsResponseObj.lyrics.language;

    if(!originLanguage) {
        $done({});
    } else if ('z1' !== originLanguage) {
        if (typeof $argument !== 'undefined') {
            try {
                const params = Object.fromEntries($argument.split('&').map(item => item.split('=')));
                Object.assign(options, params);
            } catch (error) {
                commonApi.msg(notifyName, '$argument解析失败', $argument);
            }
        }
        const { appid, securityKey } = options;

        const query = colorLyricsResponseObj.lyrics.lines
            .map(x => x.words)
            .filter(words => words && words !== '♪')
            .filter((v, i, a) => a.indexOf(v) === i)
            .join('\n');

        const salt = Date.now();
        const queryObj = {
            q: query,
            from: 'auto',
            to: 'zh',
            appid,
            salt,
            sign: md5(appid + query + salt + securityKey)
        };

        const requestBody = Object.entries(queryObj)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&');

        commonApi.post({
            url: "https://fanyi-api.baidu.com/api/trans/vip/translate",
            body: requestBody,
            headers: {
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
        }, (error, response, data) => {
            if(error) {
                commonApi.msg(notifyName, '百度翻译', `error错误${error}`);
                $done({});
            } else if(response.status !== 200) {
                commonApi.msg(notifyName, '百度翻译', `响应不为200:${response.status}`);
                $done({});
            } else {
                const baiduResult = JSON.parse(data);
                if(baiduResult.error_code && baiduResult.error_code !== '52000') {
                    if (baiduResult.error_code === '54003') {
                    } else if (baiduResult.error_code === '52003') {
                        commonApi.msg(notifyName, '百度翻译', `未授权用户,请检查appid和密钥配置:${data}`);
                    } else {
                        commonApi.msg(notifyName, '百度翻译', `其他错误:${data}`);
                    }
                    $done({});
                } else {
                    const transArr = baiduResult.trans_result.filter(trans => trans.src !== trans.dst)
                        .map(trans => [trans.src, trans.dst]);
                    const transMap = new Map(transArr);
                    colorLyricsResponseObj.lyrics.alternatives = [{
                        "language": "z1",
                        "lines": colorLyricsResponseObj.lyrics.lines.map(line => line.words)
                            .map(word => transMap.get(word) || word || '')
                    }];
                    const body = ColorLyricsResponse.toBinary(colorLyricsResponseObj);
                    if(isQX) {
                        $done({ bodyBytes: body.buffer.slice(body.byteOffset, body.byteLength + body.byteOffset) });
                    } else {
                        $done({ body });
                    }
                }
            }
        });
    } else {
        $done({});
    }
}

function Env(t, e) {
    class s {
        constructor(t) {
            this.env = t;
        }
        send(t, e = "GET") {
            t = "string" == typeof t ? { url: t } : t;
            let s = this.get;
            return "POST" === e && (s = this.post), new Promise((e, i) => {
                s.call(this, t, (t, s, r) => {
                    t ? i(t) : e(s);
                });
            });
        }
        get(t) {
            return this.send.call(this.env, t);
        }
        post(t) {
            return this.send.call(this.env, t, "POST");
        }
    }

    return new class {
        constructor(t, e) {
            this.name = t;
            this.http = new s(this);
            this.data = null;
            this.dataFile = "box.dat";
            this.logs = [];
            this.isMute = !1;
            this.isNeedRewrite = !1;
            this.logSeparator = "\n";
            this.encoding = "utf-8";
            this.startTime = (new Date).getTime();
            Object.assign(this, e);
            this.log("", `🔔${this.name}, 开始!`);
        }

        isNode() {
            return "undefined" != typeof module && !!module.exports;
        }

        isQuanX() {
            return "undefined" != typeof $task;
        }

        isSurge() {
            return "undefined" != typeof $httpClient && "undefined" == typeof $loon;
        }

        isLoon() {
            return "undefined" != typeof $loon;
        }

        isShadowrocket() {
            return "undefined" != typeof $rocket;
        }

        isStash() {
            return "undefined" != typeof $environment && $environment["stash-version"];
        }

        toObj(t, e = null) {
            try {
                return JSON.parse(t);
            } catch {
                return e;
            }
        }

        toStr(t, e = null) {
            try {
                return JSON.stringify(t);
            } catch {
                return e;
            }
        }

        getjson(t, e) {
            let s = e;
            const i = this.getdata(t);
            if (i) try { s = JSON.parse(this.getdata(t)); } catch { }
            return s;
        }

        setjson(t, e) {
            try {
                return this.setdata(JSON.stringify(t), e);
            } catch {
                return !1;
            }
        }

        getScript(t) {
            return new Promise(e => { this.get({ url: t }, (t, s, i) => e(i)); });
        }

        runScript(t, e) {
            return new Promise(s => {
                let i = this.getdata("@chavy_boxjs_userCfgs.httpapi");
                i = i ? i.replace(/\n/g, "").trim() : i;
                let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");
                r = r ? 1 * r : 20;
                r = e && e.timeout ? e.timeout : r;
                const [o, n] = i.split("@"), a = { url: `http://${n}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: r }, headers: { "X-Key": o, Accept: "*/*" } };
                this.post(a, (t, e, i) => s(i));
            }).catch(t => this.logErr(t));
        }

        loaddata() {
            if (!this.isNode()) return {};
            { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e); if (!s && !i) return {}; { const i = s ? t : e; try { return JSON.parse(this.fs.readFileSync(i)); } catch (t) { return {}; } } }
        }

        writedata() {
            if (this.isNode()) { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e), r = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, r) : i ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r); }
        }

        lodash_get(t, e, s) {
            const i = e.replace(/\[(\d+)\]/g, ".$1").split(".");
            let r = t;
            for (const t of i) if (r = Object(r)[t], void 0 === r) return s;
            return r;
        }

        lodash_set(t, e, s) {
            return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}, t)[e[e.length - 1]] = s, t);
        }

        getdata(t) {
            let e = this.getval(t);
            if (/^@/.test(t)) { const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : ""; if (r) try { const t = JSON.parse(r); e = t ? this.lodash_get(t, i, "") : e; } catch (t) { e = ""; } }
            return e;
        }

        setdata(t, e) {
            let s = !1;
            if (/^@/.test(e)) {
                const [, i, r] = /^@(.*?)\.(.*?)$/.exec(e), o = this.getval(i), n = i ? "null" === o ? null : o || "{}" : "{}";
                try {
                    const e = JSON.parse(n);
                    this.lodash_set(e, r, t), s = this.setval(JSON.stringify(e), i);
                } catch (e) {
                    const o = {};
                    this.lodash_set(o, r, t), s = this.setval(JSON.stringify(o), i);
                }
            } else s = this.setval(t, e);
            return s;
        }

        getval(t) {
            return this.isSurge() || this.isLoon() ? $persistentStore.read(t) : this.isQuanX() ? $prefs.valueForKey(t) : this.isNode() ? (this.data = this.loaddata(), this.data[t]) : this.data && this.data[t] || null;
        }

        setval(t, e) {
            return this.isSurge() || this.isLoon() ? $persistentStore.write(t, e) : this.isQuanX() ? $prefs.setValueForKey(t, e) : this.isNode() ? (this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0) : this.data && this.data[e] || null;
        }

        msg(e = t, s = "", i = "", r) {
            const o = t => {
                if (!t) return t;
                if ("string" == typeof t) return this.isLoon() ? t : this.isQuanX() ? { "open-url": t } : this.isSurge() ? { url: t } : void 0;
                if ("object" == typeof t) {
                    if (this.isLoon()) {
                        let e = t.openUrl || t.url || t["open-url"], s = t.mediaUrl || t["media-url"];
                        return { openUrl: e, mediaUrl: s };
                    }
                    if (this.isQuanX()) {
                        let e = t["open-url"] || t.url || t.openUrl, s = t["media-url"] || t.mediaUrl;
                        return { "open-url": e, "media-url": s };
                    }
                    if (this.isSurge()) {
                        let e = t.url || t.openUrl || t["open-url"];
                        return { url: e };
                    }
                }
            };

            if (this.isMute || (this.isSurge() || this.isLoon() ? $notification.post(e, s, i, o(r)) : this.isQuanX() && $notify(e, s, i, o(r)), !this.isMuteLog)) {
                let t = ["", "==============📣系统通知📣=============="];
                t.push(e), s && t.push(s), i && t.push(i), console.log(t.join("\n")), this.logs = this.logs.concat(t);
            }
        }

        log(...t) {
            t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator));
        }

        logErr(t, e) {
            const s = !this.isSurge() && !this.isQuanX() && !this.isLoon();
            s ? this.log("", `❗️${this.name}, 错误!`, t.stack) : this.log("", `❗️${this.name}, 错误!`, t);
        }

        wait(t) {
            return new Promise(e => setTimeout(e, t));
        }

        done(t = {}) {
            const e = (new Date).getTime(), s = (e - this.startTime) / 1e3;
            this.log("", `🔔${this.name}, 结束! 🕛 ${s} 秒`), this.log(), (this.isSurge() || this.isQuanX() || this.isLoon()) && $done(t);
        }
    }(t, e);
}
