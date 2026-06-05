cat > index.js << 'EOF'
const crypto = require('crypto');
const axios = require('axios');
const express = require('express');
const fs = require('fs');

const PREFIX = "!";
const ADMINS = ["61590442478936"];

const FB_EMAIL = "minhquangdz2012abc@gmail.com";
const FB_PASSWORD = "minhquangk12";

const GAME_IP = "211.253.26.47";
const GAME_PORT = "8093";
const KEY_AES2 = "gksekfidjrqjfwk1";
const IV_AES2 = "towerdefense_amo";

const SERVERS = {
    "1": { name: "AMO", display: "AMO (Mobile)" },
    "2": { name: "ATV", display: "ATV (Android TV)" }
};

const SOUL_LIST = {
    "1": { id: "SOUL_1", name: "Loki" },
    "2": { id: "SOUL_2", name: "Gibongi" },
    "3": { id: "SOUL_3", name: "Hell Knight" },
    "4": { id: "SOUL_4", name: "Nan-cheon" },
    "5": { id: "SOUL_5", name: "Dalma" },
    "6": { id: "SOUL_6", name: "Muk-hyang" },
    "7": { id: "SOUL_7", name: "Wolf King" },
    "8": { id: "SOUL_8", name: "Jormungand" }
};

const userSteps = {};
let api = null;
let botStartTime = Date.now();
let isReady = false;

function encryptAES2(data) {
    try {
        const cipher = crypto.createCipheriv("aes-128-cbc", KEY_AES2, IV_AES2);
        let encrypted = cipher.update(JSON.stringify(data), "utf8", "base64");
        encrypted += cipher.final("base64");
        return encrypted;
    } catch (e) { return null; }
}

function decryptAES2(cipherText) {
    try {
        const decipher = crypto.createDecipheriv("aes-128-cbc", KEY_AES2, IV_AES2);
        let decrypted = decipher.update(cipherText, "base64", "utf8");
        decrypted += decipher.final("utf8");
        return JSON.parse(decrypted.replace(/[\x00-\x1F\x7F-\x9F]/g, ""));
    } catch (e) { return null; }
}

async function sendRequest(url, data, isATV = false) {
    try {
        const postData = `DATA=${encodeURIComponent(data)}`;
        const headers = {
            'User-Agent': isATV ? 'busidol.atv.tower' : 'busidol.mobile.tower',
            'X-Requested-With': isATV ? 'busidol.atv.tower' : 'busidol.mobile.tower',
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        const response = await axios.post(url, postData, { headers, timeout: 30000 });
        return response.data;
    } catch (e) { return null; }
}

async function getUserData(uniq_id, host_id, isATV = false) {
    const url = isATV 
        ? `http://${GAME_IP}:${GAME_PORT}/TOWERDEFENCE_ATV/get_user_data_all_AES2.php`
        : `http://${GAME_IP}:${GAME_PORT}/TOWERDEFENCE_AMO/get_user_data_all_AES2.php`;
    
    const payload = {
        "UNIQ_ID": uniq_id,
        "HOST_ID": host_id,
        "MOBILE_CONNECT": "",
        "ANDROID_AD": "",
        "GICHAPO": isATV ? "선택된서버:한국서버 ping:205ms" : "선택된서버:베트남서버 ping:67ms",
        "LOCAL_KEY": null
    };
    if (isATV) payload.MODEL_NAME = "BeyondTV";
    
    const encrypted = encryptAES2(payload);
    if (!encrypted) return null;
    const response = await sendRequest(url, encrypted, isATV);
    if (!response) return null;
    const decrypted = decryptAES2(response);
    if (!decrypted) return null;
    
    let gichapo = decrypted.gichapo || decrypted.VALUE?.gichapo || decrypted.VALUE?.etc?.value?.gichapo;
    return {
        gichapo: gichapo,
        userName: decrypted.VALUE?.normal?.value?.USER_NAME || "",
        userLevel: decrypted.VALUE?.normal?.value?.SO_CODE || 0,
        runCount: decrypted.VALUE?.etc?.value?.run_count || 0,
        souls: decrypted.VALUE?.soul || {}
    };
}

async function addSoul(uniq_id, host_id, platform, soul_id, amount, run_count, comment, gichapo, isATV = false) {
    const url = isATV
        ? `http://${GAME_IP}:${GAME_PORT}/TOWERDEFENCE_ATV/put_myths_data_AES2.php`
        : `http://${GAME_IP}:${GAME_PORT}/TOWERDEFENCE_AMO/put_myths_data_AES2.php`;
    
    const payload = {
        "UNIQ_ID": uniq_id,
        "HOST_ID": host_id,
        "PLATFORM": platform,
        "HERO": soul_id,
        "QUEST": "0:0,0:0,0:0,0:0,0:0,0:0,0:0,0:0,0:0",
        "REWARD": "200000000:200000000:000000000",
        "FLOOR": 2,
        "PASS": "2000-01-01 00:00:00",
        "MAX_CLEAR": 0,
        "MAX_FIRST_CLEAR": 0,
        "SOUL": amount,
        "WHAT": ["SOUL"],
        "VALUE": { "SOUL": { [soul_id]: amount } },
        "RUN_COUNT": run_count,
        "COMMENT": comment,
        "MOBILE_CONNECT": "",
        "GICHAPO": gichapo
    };
    
    const encrypted = encryptAES2(payload);
    if (!encrypted) return null;
    const response = await sendRequest(url, encrypted, isATV);
    if (!response) return null;
    
    try {
        const decipher = crypto.createDecipheriv("aes-128-cbc", KEY_AES2, IV_AES2);
        let decrypted = decipher.update(response, "base64", "utf8");
        decrypted += decipher.final("utf8");
        return JSON.parse(decrypted.replace(/[\x00-\x1F\x7F-\x9F]/g, ""));
    } catch (e) {
        return { RESULT: "ERROR", VALUE: e.message };
    }
}

function formatNumber(num) {
    return num.toLocaleString('vi-VN');
}

async function getMyIP() {
    try {
        const res = await axios.get('https://api.ipify.org?format=json');
        return res.data.ip;
    } catch (e) { return 'Khong lay duoc'; }
}

function isAdmin(senderID) {
    return ADMINS.includes(senderID);
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
}

async function handleMessage(event) {
    const { senderID, threadID, body, isGroup } = event;
    const text = body?.trim() || "";
    
    if (!text.startsWith(PREFIX)) return;
    
    const args = text.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = args[0]?.toLowerCase();
    if (!cmd) return;
    
    // Lấy tên nhóm nếu là group
    let groupName = "";
    if (isGroup) {
        try {
            const threadInfo = await api.getThreadInfo(threadID);
            groupName = threadInfo.name || "Group";
        } catch(e) {}
    }
    
    if (cmd === "menu") {
        const menu = `╔══════════════════════════╗
║     SOUL HACK BOT       ║
╚══════════════════════════╝
━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 LENH:

!info <uniq> <host> [sv] - Xem thong tin
!add - Them soul (tung buoc)
!list - Danh sach soul
!server - Danh sach server
!ip - Xem IP bot

!restart - Khoi dong lai
!stats - Thong ke
━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CAN VPN HAN QUOC!`;
        return api.sendMessage(menu, threadID);
    }
    
    if (cmd === "list") {
        let msg = "💎 DANH SACH SOUL:\n━━━━━━━━━━━━━━━━━━\n";
        for (const [k, s] of Object.entries(SOUL_LIST)) {
            msg += `${k}. ${s.name} (${s.id})\n`;
        }
        return api.sendMessage(msg, threadID);
    }
    
    if (cmd === "server") {
        let msg = "🖥️ DANH SACH SERVER:\n1. AMO (Mobile)\n2. ATV (Android TV)";
        return api.sendMessage(msg, threadID);
    }
    
    if (cmd === "ip") {
        const ip = await getMyIP();
        return api.sendMessage(`🌐 IP Bot: ${ip}`, threadID);
    }
    
    if (cmd === "info") {
        const uniq = args[1];
        const host = args[2];
        const sv = args[3] || "1";
        
        if (!uniq || !host) return api.sendMessage("📝 !info <uniq_id> <host_id> [server]\n\nVi du: !info ATV259217 az555lqok@gmail.com 2", threadID);
        if (!SERVERS[sv]) return api.sendMessage("❌ Server 1-2!", threadID);
        
        await api.sendMessage("🔄 Dang lay thong tin...", threadID);
        const data = await getUserData(uniq, host, sv === "2");
        
        if (!data?.gichapo) {
            return api.sendMessage("❌ Khong tim thay! Kiem tra UNIQ_ID/HOST_ID va VPN!", threadID);
        }
        
        let msg = `📊 THONG TIN TAI KHOAN\n━━━━━━━━━━━━━━━━━━\n`;
        msg += `🖥️ ${SERVERS[sv].display}\n`;
        msg += `👤 ${data.userName || 'Khong co'}\n`;
        msg += `📊 Level: ${data.userLevel}\n`;
        msg += `🔄 Run: ${data.runCount}\n`;
        msg += `━━━━━━━━━━━━━━━━━━\n💎 SOUL:\n`;
        for (const [k, s] of Object.entries(SOUL_LIST)) {
            const amt = data.souls[s.id] || 0;
            msg += `${k}. ${s.name}: ${formatNumber(amt)}\n`;
        }
        return api.sendMessage(msg, threadID);
    }
    
    if (cmd === "add") {
        let step = userSteps[senderID];
        
        if (!step) {
            userSteps[senderID] = { step: "wait_server" };
            return api.sendMessage(`📡 CHON SERVER\n━━━━━━━━━━━━━━━━━━\n1. AMO (Mobile)\n2. ATV (Android TV)\n━━━━━━━━━━━━━━━━━━\n👉 Nhap so (1-2)\n!cancel de huy`, threadID);
        }
        
        if (step.step === "wait_server") {
            if (!SERVERS[text]) return api.sendMessage("❌ Chon 1 hoac 2!", threadID);
            step.server = text;
            step.isATV = (text === "2");
            step.step = "wait_uniq";
            return api.sendMessage(`✅ Da chon: ${SERVERS[text].display}\n━━━━━━━━━━━━━━━━━━\n🆔 Nhap UNIQ_ID:`, threadID);
        }
        
        if (step.step === "wait_uniq") {
            if (!text) return api.sendMessage("❌ Khong duoc trong!", threadID);
            step.uniq = text;
            step.step = "wait_host";
            return api.sendMessage(`✅ UNIQ_ID: ${text}\n━━━━━━━━━━━━━━━━━━\n📧 Nhap HOST_ID:`, threadID);
        }
        
        if (step.step === "wait_host") {
            if (!text) return api.sendMessage("❌ Khong duoc trong!", threadID);
            step.host = text;
            step.step = "loading";
            await api.sendMessage("🔄 Dang lay thong tin...", threadID);
            
            const data = await getUserData(step.uniq, step.host, step.isATV);
            
            if (!data?.gichapo) {
                delete userSteps[senderID];
                return api.sendMessage("❌ Khong tim thay! Kiem tra lai!", threadID);
            }
            
            step.userInfo = data;
            step.step = "wait_soul";
            
            let msg = `✅ THONG TIN TAI KHOAN\n━━━━━━━━━━━━━━━━━━\n`;
            msg += `👤 ${data.userName || 'Khong co'}\n📊 Level ${data.userLevel}\n🔄 Run ${data.runCount}\n`;
            msg += `━━━━━━━━━━━━━━━━━━\n💎 CHON SOUL (1-8):\n`;
            for (const [k, s] of Object.entries(SOUL_LIST)) {
                const amt = data.souls[s.id] || 0;
                msg += `${k}. ${s.name}: ${formatNumber(amt)}\n`;
            }
            return api.sendMessage(msg, threadID);
        }
        
        if (step.step === "wait_soul") {
            if (!SOUL_LIST[text]) return api.sendMessage("❌ Chon 1-8!", threadID);
            step.soul = SOUL_LIST[text];
            step.step = "wait_amount";
            return api.sendMessage(`✅ Da chon: ${step.soul.name}\n━━━━━━━━━━━━━━━━━━\n🔢 Nhap so luong:`, threadID);
        }
        
        if (step.step === "wait_amount") {
            let amount = parseInt(text);
            if (isNaN(amount) || amount <= 0) return api.sendMessage("❌ Nhap so hop le!", threadID);
            step.amount = amount;
            
            let newRun = step.userInfo.runCount - 1;
            if (newRun < 0) newRun = 0;
            step.newRun = newRun;
            step.comment = `${step.soul.id} 영혼석 우편함 수령 ${amount}`;
            step.step = "wait_confirm";
            
            const msg = `🔔 XAC NHAN\n━━━━━━━━━━━━━━━━━━\n`;
            msg += `🖥️ ${SERVERS[step.server].display}\n`;
            msg += `💎 ${step.soul.name}\n`;
            msg += `🔢 ${formatNumber(amount)}\n`;
            msg += `🔄 Run: ${newRun}\n`;
            msg += `━━━━━━━━━━━━━━━━━━\n✅ Nhap "yes" de xac nhan\n❌ Nhap "no" de huy`;
            return api.sendMessage(msg, threadID);
        }
        
        if (step.step === "wait_confirm") {
            if (text.toLowerCase() === "yes") {
                await api.sendMessage("🚀 Dang them soul...", threadID);
                const result = await addSoul(
                    step.uniq, step.host, step.isATV ? 'ATV' : 'AMO',
                    step.soul.id, step.amount, step.newRun, step.comment,
                    step.userInfo.gichapo, step.isATV
                );
                
                let msg = "";
                if (!result) msg = "❌ LOI KET NOI! Can VPN Han Quoc!";
                else if (result.RESULT === 'OK') {
                    const newAmt = result.VALUE?.SOUL?.[step.soul.id] || '?';
                    msg = `✅✅ THANH CONG! ✅✅\n━━━━━━━━━━━━━━━━━━\n💎 ${step.soul.name}\n➕ Da them: ${formatNumber(step.amount)}\n📊 Tong: ${formatNumber(newAmt)}`;
                } else {
                    msg = `❌ THAT BAI!\n🔴 ${result.VALUE || 'Khong ro'}`;
                }
                
                delete userSteps[senderID];
                return api.sendMessage(msg, threadID);
            } else {
                delete userSteps[senderID];
                return api.sendMessage("✅ Da huy!", threadID);
            }
        }
        return;
    }
    
    if (cmd === "cancel") {
        delete userSteps[senderID];
        return api.sendMessage("✅ Da huy thao tac!", threadID);
    }
    
    if (!isAdmin(senderID)) return;
    
    if (cmd === "restart") {
        await api.sendMessage("🔄 Dang khoi dong lai...", threadID);
        process.exit(0);
    }
    
    if (cmd === "stats") {
        const uptime = formatTime(Date.now() - botStartTime);
        const ip = await getMyIP();
        const stats = `📊 THONG KE BOT\n━━━━━━━━━━━━━━━━━━\n⏰ Uptime: ${uptime}\n🌐 IP: ${ip}\n👥 Sessions: ${Object.keys(userSteps).length}`;
        return api.sendMessage(stats, threadID);
    }
}

const app = express();
app.get('/', (req, res) => res.send('🤖 Bot dang chay!'));
app.listen(3000, () => console.log('🌐 Web server port 3000'));

async function startBot() {
    console.log("╔════════════════════════════════════╗");
    console.log("║     SOUL HACK BOT MESSENGER       ║");
    console.log("╚════════════════════════════════════╝");
    
    if (!FB_EMAIL || !FB_PASSWORD || FB_PASSWORD === "matkhau_cua_ban") {
        console.log("\n⚠️ VUI LONG NHAP EMAIL VA MAT KHAU FACEBOOK!");
        console.log("📌 Sua dong: const FB_EMAIL = '...'");
        console.log("   const FB_PASSWORD = '...'\n");
        return;
    }
    
    console.log(`📧 Dang nhap voi: ${FB_EMAIL}`);
    console.log("🔄 Dang ket noi...\n");
    
    try {
        const { default: login } = await import('fca-unofficial');
        
        login({ email: FB_EMAIL, password: FB_PASSWORD }, (err, _api) => {
            if (err) {
                console.log("❌ LOI DANG NHAP:", err);
                return;
            }
            
            api = _api;
            botStartTime = Date.now();
            isReady = true;
            
            console.log("✅ DANG NHAP THANH CONG!");
            getMyIP().then(ip => console.log(`🌐 IP Bot: ${ip}`));
            console.log("🎉 BOT SAN SANG!\n");
            console.log(`📝 Prefix: ${PREFIX}`);
            console.log(`👑 Admin: ${ADMINS.join(", ")}`);
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
            
            // Gửi tin nhắn thông báo vào tất cả các nhóm bot đang ở
            setTimeout(async () => {
                try {
                    const allThreads = await api.getThreadList(50, null, ['INBOX']);
                    for (const thread of allThreads) {
                        if (thread.isGroup) {
                            await api.sendMessage(`✅ 𝐁𝐎𝐓 𝐒𝐎𝐔𝐋 𝐇𝐀𝐂𝐊 𝐕𝐔̛̀𝐀 𝐊𝐄̂́𝐓 𝐍𝐎̂́𝐈 𝐓𝐇𝐀̀𝐍𝐇 𝐂𝐎̂𝐍𝐆!\n━━━━━━━━━━━━━━━━━━\n📌 𝐍𝐡𝐚̣̂𝐧 𝐥𝐞̣̂𝐧𝐡: !𝐦𝐞𝐧𝐮\n⚠️ 𝐂𝐚̂̀𝐧 𝐕𝐏𝐍 𝐇𝐚̀𝐧 𝐐𝐮𝐨̂́𝐜 đ𝐞̂̉ 𝐡𝐨𝐚̣𝐭 đ𝐨̣̂𝐧𝐠!`, thread.threadID);
                            console.log(`✅ Đã gửi thông báo vào nhóm: ${thread.name || thread.threadID}`);
                        }
                    }
                } catch(e) {
                    console.log("Khong the gui thong bao nhom:", e);
                }
            }, 3000);
            
            api.listen(async (err, event) => {
                if (err) {
                    console.log("Loi listen:", err);
                    return;
                }
                
                // Khi bot được thêm vào nhóm mới
                if (event.type === 'event' && event.event === 'add') {
                    if (event.addedParticipants.some(p => p.userFbId === api.getCurrentUserID())) {
                        const threadID = event.threadID;
                        const threadInfo = await api.getThreadInfo(threadID);
                        const groupName = threadInfo.name || "nhóm";
                        
                        await api.sendMessage(`✅ 𝐁𝐎𝐓 𝐒𝐎𝐔𝐋 𝐇𝐀𝐂𝐊 𝐕𝐔̛̀𝐀 𝐕𝐀̀𝐎 𝐍𝐇𝐎́𝐌!\n━━━━━━━━━━━━━━━━━━\n📌 𝐍𝐡𝐨́𝐦: ${groupName}\n📌 𝐍𝐡𝐚̣̂𝐧 𝐥𝐞̣̂𝐧𝐡: !𝐦𝐞𝐧𝐮\n⚠️ 𝐂𝐚̂̀𝐧 𝐕𝐏𝐍 𝐇𝐚̀𝐧 𝐐𝐮𝐨̂́𝐜 đ𝐞̂̉ 𝐡𝐨𝐚̣𝐭 đ𝐨̣̂𝐧𝐠!`, threadID);
                        console.log(`✅ Bot đã được thêm vào nhóm: ${groupName}`);
                    }
                }
                
                if (event.type === 'message' && event.body) {
                    try { 
                        await handleMessage(event); 
                    } catch(e) { 
                        console.log("Loi xu ly:", e); 
                    }
                }
            });
        });
    } catch (error) {
        console.log("❌ LOI:", error);
    }
}

startBot();
EOF
